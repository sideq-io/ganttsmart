import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DebounceCancelled,
  createIssueRelation,
  removeIssueRelation,
  fetchIssues,
  fetchProjects,
  fetchWorkflowStates,
  updateIssueDueDate,
  updateIssueStartDate,
  updateIssueState,
  updateMilestoneTargetDate,
} from '@/api/linear';
import { toast, toastError, toastSuccess } from '@/components/Toast';
import { DEFAULT_DAY_WIDTH, MAX_DAY_WIDTH, MIN_DAY_WIDTH, TIME_SCALE_FACTORS } from '@/types';
import type { Filters, GroupBy, Milestone, Project, Task, TimeScale, WorkflowState } from '@/types';

const DEFAULT_PRIORITIES = new Set([0, 1, 2, 3, 4]);
const POLL_INTERVAL_MS = 30_000; // 30 seconds

const customOrderKey = (projectId: string) => `linear_custom_order_${projectId}`;

/** Read the persisted custom display order for a project (task uuids). Exported for ShareDialog. */
export function loadCustomOrder(projectId: string): string[] {
  if (!projectId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(customOrderKey(projectId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useLinearData(linearToken: string, onAuthError?: () => void) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem('linear_selected_project') || '',
  );
  const [projectName, setProjectName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [unscheduledTasks, setUnscheduledTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [workflowStates, setWorkflowStates] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [timeScale, setTimeScaleState] = useState<TimeScale>(() => {
    const s = localStorage.getItem('gantt_time_scale');
    return s === 'week' || s === 'month' ? s : 'day';
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filters, setFilters] = useState<Filters>({
    assignee: '',
    status: '',
    priorities: new Set(DEFAULT_PRIORITIES),
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  const initialLoadDone = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingMutations = useRef(0); // guards polling from overwriting optimistic state

  // Undo stack: stores previous task snapshots
  const undoStackRef = useRef<Array<{ tasks: Task[]; label: string }>>([]);

  const assignees = useMemo(() => [...new Set(tasks.map((t) => t.assignee))].sort(), [tasks]);
  const statuses = useMemo(() => [...new Set(tasks.map((t) => t.status))].sort(), [tasks]);

  // Custom display order (uuids), persisted per project. Empty = default sort from the API.
  const [customOrder, setCustomOrder] = useState<string[]>(() =>
    loadCustomOrder(localStorage.getItem('linear_selected_project') || ''),
  );

  useEffect(() => {
    setCustomOrder(loadCustomOrder(selectedProjectId));
  }, [selectedProjectId]);

  // Tasks in display order: saved positions first, unknown (new) tasks keep their
  // default priority/due order after them. Sort is stable, so ties preserve fetch order.
  const orderedTasks = useMemo(() => {
    if (customOrder.length === 0) return tasks;
    const pos = new Map(customOrder.map((uuid, i) => [uuid, i]));
    return [...tasks].sort((a, b) => {
      const ai = pos.get(a.uuid);
      const bi = pos.get(b.uuid);
      if (ai === undefined && bi === undefined) return 0;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  }, [tasks, customOrder]);

  const filteredTasks = useMemo(() => {
    return orderedTasks.filter((t) => {
      if (!filters.priorities.has(t.priorityVal)) return false;
      if (filters.assignee && t.assignee !== filters.assignee) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.search) {
        const hay = `${t.id} ${t.title} ${t.assignee} ${t.status}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [orderedTasks, filters]);

  // Move a task next to another in the display order and persist it.
  const reorderTask = useCallback(
    (draggedUuid: string, targetUuid: string, placeAfter: boolean) => {
      if (draggedUuid === targetUuid) return;
      const order = orderedTasks.map((t) => t.uuid);
      const from = order.indexOf(draggedUuid);
      if (from === -1) return;
      order.splice(from, 1);
      const targetIdx = order.indexOf(targetUuid);
      if (targetIdx === -1) return;
      order.splice(placeAfter ? targetIdx + 1 : targetIdx, 0, draggedUuid);
      setCustomOrder(order);
      if (selectedProjectId) {
        try {
          localStorage.setItem(customOrderKey(selectedProjectId), JSON.stringify(order));
        } catch {
          // localStorage full/unavailable — order still applies for this session
        }
      }
    },
    [orderedTasks, selectedProjectId],
  );

  // Push to undo stack and show toast with Undo action
  const pushUndo = useCallback((prevTasks: Task[], label: string) => {
    undoStackRef.current.push({ tasks: prevTasks, label });
    // Keep max 20 undo entries
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }, []);

  const undo = useCallback(() => {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    setTasks(entry.tasks);
    toastSuccess(`Undone: ${entry.label}`);
  }, []);

  const loadProjects = useCallback(async () => {
    if (!linearToken) return;
    try {
      const p = await fetchProjects(linearToken);
      setProjects(p);
      return p;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('authentication expired')) {
        toastError('Linear session expired. Reconnecting...');
        onAuthError?.();
        return [];
      }
      toastError(`Failed to load projects: ${msg}`);
      throw e;
    }
  }, [linearToken]);

  // Silent refresh for polling (no loading spinner, no error clearing)
  // Skips if there are pending mutations to avoid overwriting optimistic state
  const silentRefresh = useCallback(
    async (projectId: string) => {
      if (!linearToken || !projectId) return;
      if (pendingMutations.current > 0) return; // don't clobber optimistic state
      try {
        const result = await fetchIssues(linearToken, projectId);
        setTasks(result.tasks);
        setDoneTasks(result.doneTasks);
        setUnscheduledTasks(result.unscheduledTasks);
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {
        // Auto-disconnect on auth expiry, otherwise silent
        if ((e as Error).message?.includes('authentication expired')) {
          onAuthError?.();
        }
      }
    },
    [linearToken],
  );

  const loadIssues = useCallback(
    async (projectId: string) => {
      if (!linearToken || !projectId) return;
      setLoading(true);
      setError('');
      try {
        const result = await fetchIssues(linearToken, projectId);
        setTasks(result.tasks);
        setDoneTasks(result.doneTasks);
        setUnscheduledTasks(result.unscheduledTasks);
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        const seedTeamId = result.tasks[0]?.teamId || result.unscheduledTasks[0]?.teamId;
        if (seedTeamId) {
          try {
            const states = await fetchWorkflowStates(linearToken, seedTeamId);
            setWorkflowStates(states);
          } catch {
            // Non-critical
          }
        }
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        setTasks([]);
        setDoneTasks([]);
        setUnscheduledTasks([]);
        setMilestones([]);
        if (msg.includes('authentication expired')) {
          toastError('Linear session expired. Reconnecting...');
          onAuthError?.();
          return;
        }
        toastError(`Failed to load issues: ${msg}`, () => loadIssues(projectId));
      } finally {
        setLoading(false);
      }
    },
    [linearToken],
  );

  const selectProject = useCallback(
    (id: string) => {
      setSelectedProjectId(id);
      localStorage.setItem('linear_selected_project', id);
      setFilters({ assignee: '', status: '', priorities: new Set(DEFAULT_PRIORITIES), search: '', dateFrom: '', dateTo: '' });
      undoStackRef.current = []; // Clear undo on project switch
      loadIssues(id);
    },
    [loadIssues],
  );

  const refresh = useCallback(() => {
    if (selectedProjectId) loadIssues(selectedProjectId);
  }, [selectedProjectId, loadIssues]);

  const zoomIn = useCallback(() => {
    setDayWidth((w) => Math.min(w + 7, MAX_DAY_WIDTH));
  }, []);

  const zoomOut = useCallback(() => {
    setDayWidth((w) => Math.max(w - 7, MIN_DAY_WIDTH));
  }, []);

  const setTimeScale = useCallback((scale: TimeScale) => {
    setTimeScaleState(scale);
    try {
      localStorage.setItem('gantt_time_scale', scale);
    } catch {
      // localStorage unavailable — scale still applies for this session
    }
  }, []);

  // Effective px-per-day: week/month views compress the axis
  const effectiveDayWidth = dayWidth * TIME_SCALE_FACTORS[timeScale];

  // Optimistic reschedule (due date) with rollback + undo.
  // Also handles "promoting" an unscheduled task: if the uuid lives in unscheduledTasks,
  // we move it into tasks with the new explicit due date.
  const reschedule = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const prevUnscheduled = unscheduledTasks;
      const fromUnscheduled = unscheduledTasks.find((t) => t.uuid === taskUuid);
      const task = tasks.find((t) => t.uuid === taskUuid) || fromUnscheduled;

      if (fromUnscheduled) {
        // Promote: remove from unscheduled, add to scheduled with explicit due date
        setUnscheduledTasks((prev) => prev.filter((t) => t.uuid !== taskUuid));
        setTasks((prev) => [...prev, { ...fromUnscheduled, due: newDueDate, isDueImplicit: undefined }]);
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.uuid === taskUuid ? { ...t, due: newDueDate, isDueImplicit: undefined } : t)),
        );
      }

      pendingMutations.current++;
      try {
        await updateIssueDueDate(linearToken, taskUuid, newDueDate);
        pushUndo(prevTasks, `${task?.id || ''} due date`);
        toast(`Due date updated`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            setUnscheduledTasks(prevUnscheduled);
            if (task && task.due && !task.isDueImplicit) {
              updateIssueDueDate(linearToken, taskUuid, task.due).catch(() => {});
            }
          },
        });
      } catch (e) {
        if (e instanceof DebounceCancelled) return; // superseded by a newer drag — don't rollback
        setTasks(prevTasks);
        setUnscheduledTasks(prevUnscheduled);
        toastError(`Failed to update due date: ${(e as Error).message}`, () => reschedule(taskUuid, newDueDate));
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, unscheduledTasks, pushUndo],
  );

  // Optimistic reschedule (start date) with rollback + undo
  const rescheduleStart = useCallback(
    async (taskUuid: string, newStartDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const task = tasks.find((t) => t.uuid === taskUuid);
      setTasks((prev) => prev.map((t) => (t.uuid === taskUuid ? { ...t, startDate: newStartDate } : t)));

      pendingMutations.current++;
      try {
        await updateIssueStartDate(linearToken, taskUuid, newStartDate);
        pushUndo(prevTasks, `${task?.id || ''} start date`);
        toast(`Start date updated`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            if (task?.startDate) updateIssueStartDate(linearToken, taskUuid, task.startDate).catch(() => {});
          },
        });
      } catch (e) {
        if (e instanceof DebounceCancelled) return; // superseded by a newer drag
        setTasks(prevTasks);
        toastError(`Failed to update start date: ${(e as Error).message}`, () =>
          rescheduleStart(taskUuid, newStartDate),
        );
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, pushUndo],
  );

  // Optimistic milestone move (drag on the chart) with rollback + undo
  const updateMilestoneDate = useCallback(
    async (milestoneId: string, newTargetDate: string) => {
      if (!linearToken) return;

      const prevMilestones = milestones;
      const milestone = milestones.find((m) => m.id === milestoneId);
      if (!milestone) return;

      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, targetDate: newTargetDate } : m)),
      );

      pendingMutations.current++;
      try {
        await updateMilestoneTargetDate(linearToken, milestoneId, newTargetDate);
        toast(`${milestone.name} moved`, 'success', {
          label: 'Undo',
          onClick: () => {
            setMilestones(prevMilestones);
            if (milestone.targetDate) {
              updateMilestoneTargetDate(linearToken, milestoneId, milestone.targetDate).catch(() => {});
            }
          },
        });
      } catch (e) {
        if (e instanceof DebounceCancelled) return; // superseded by a newer drag
        setMilestones(prevMilestones);
        toastError(`Failed to move milestone: ${(e as Error).message}`, () =>
          updateMilestoneDate(milestoneId, newTargetDate),
        );
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, milestones],
  );

  // Optimistic status cycle with rollback + undo
  const cycleStatus = useCallback(
    async (taskUuid: string) => {
      if (!linearToken || workflowStates.length === 0) return;
      const task = tasks.find((t) => t.uuid === taskUuid);
      if (!task) return;

      const typeOrder = ['unstarted', 'started', 'completed'];
      const currentTypeIdx = typeOrder.indexOf(task.statusType);
      const nextType = typeOrder[Math.min(currentTypeIdx + 1, typeOrder.length - 1)];

      const nextState = workflowStates.find((s) => s.type === nextType);
      if (!nextState || nextState.name === task.status) return;

      const prevTasks = tasks;
      const prevState = workflowStates.find((s) => s.name === task.status);
      setTasks((prev) =>
        prev.map((t) => (t.uuid === taskUuid ? { ...t, status: nextState.name, statusType: nextState.type } : t)),
      );

      pendingMutations.current++;
      try {
        await updateIssueState(linearToken, taskUuid, nextState.id);
        pushUndo(prevTasks, `${task.id} status`);
        toast(`Status → ${nextState.name}`, 'success', {
          label: 'Undo',
          onClick: () => {
            setTasks(prevTasks);
            if (prevState) updateIssueState(linearToken, taskUuid, prevState.id).catch(() => {});
          },
        });
      } catch (e) {
        setTasks(prevTasks);
        toastError(`Failed to update status: ${(e as Error).message}`, () => cycleStatus(taskUuid));
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, workflowStates, tasks, pushUndo],
  );

  // Create a "blocks" relation between two tasks
  const createRelation = useCallback(
    async (sourceTaskId: string, targetTaskId: string) => {
      if (!linearToken) return;

      const sourceTask = tasks.find((t) => t.id === sourceTaskId);
      const targetTask = tasks.find((t) => t.id === targetTaskId);
      if (!sourceTask || !targetTask) return;

      // Prevent duplicate
      if (sourceTask.blocks.includes(targetTaskId)) {
        toast(`${sourceTaskId} already blocks ${targetTaskId}`, 'info');
        return;
      }

      // Prevent circular
      if (targetTask.blocks.includes(sourceTaskId)) {
        toastError(`Cannot create circular dependency: ${targetTaskId} already blocks ${sourceTaskId}`);
        return;
      }

      const prevTasks = tasks;
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === sourceTaskId) return { ...t, blocks: [...t.blocks, targetTaskId] };
          if (t.id === targetTaskId) return { ...t, blockedBy: [...t.blockedBy, sourceTaskId] };
          return t;
        }),
      );

      pendingMutations.current++;
      try {
        await createIssueRelation(linearToken, sourceTask.uuid, targetTask.uuid);
        pushUndo(prevTasks, `${sourceTaskId} blocks ${targetTaskId}`);
        toastSuccess(`${sourceTaskId} now blocks ${targetTaskId}`);
      } catch (e) {
        setTasks(prevTasks);
        toastError(`Failed to create relation: ${(e as Error).message}`);
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, pushUndo],
  );

  // Remove a "blocks" relation between two tasks
  // sourceTaskId = blocker identifier, targetTaskId = blocked identifier
  const removeRelation = useCallback(
    async (sourceTaskId: string, targetTaskId: string) => {
      if (!linearToken) return;

      const sourceTask = tasks.find((t) => t.id === sourceTaskId);
      const targetTask = tasks.find((t) => t.id === targetTaskId);
      if (!sourceTask || !targetTask) return;

      const prevTasks = tasks;
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === sourceTaskId) return { ...t, blocks: t.blocks.filter((id) => id !== targetTaskId) };
          if (t.id === targetTaskId) return { ...t, blockedBy: t.blockedBy.filter((id) => id !== sourceTaskId) };
          return t;
        }),
      );

      pendingMutations.current++;
      try {
        await removeIssueRelation(linearToken, sourceTask.uuid, targetTask.uuid);
        pushUndo(prevTasks, `${sourceTaskId} no longer blocks ${targetTaskId}`);
        toastSuccess(`Removed: ${sourceTaskId} → ${targetTaskId}`);
      } catch (e) {
        setTasks(prevTasks);
        toastError(`Failed to remove relation: ${(e as Error).message}`);
      } finally {
        pendingMutations.current--;
      }
    },
    [linearToken, tasks, pushUndo],
  );

  // Initial load when token is available
  useEffect(() => {
    if (!linearToken || initialLoadDone.current) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        const p = await loadProjects();
        if (!p?.length) return;
        const target = selectedProjectId && p.find((x) => x.id === selectedProjectId) ? selectedProjectId : p[0].id;
        setSelectedProjectId(target);
        localStorage.setItem('linear_selected_project', target);
        await loadIssues(target);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [linearToken, selectedProjectId, loadProjects, loadIssues]);

  // Polling: auto-refresh every 30s (only when tab is visible)
  useEffect(() => {
    if (!linearToken || !selectedProjectId) return;

    const startPolling = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentRefresh(selectedProjectId);
        }
      }, POLL_INTERVAL_MS);
    };

    startPolling();

    // Restart polling when tab becomes visible (in case interval drifted while hidden)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        silentRefresh(selectedProjectId);
        startPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [linearToken, selectedProjectId, silentRefresh]);

  // Ctrl+Z / Cmd+Z undo handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo]);

  return {
    projects,
    selectedProjectId,
    projectName,
    tasks,
    doneTasks,
    unscheduledTasks,
    filteredTasks,
    milestones,
    workflowStates,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
    effectiveDayWidth,
    timeScale,
    setTimeScale,
    groupBy,
    filters,
    setFilters,
    setGroupBy,
    selectProject,
    refresh,
    zoomIn,
    zoomOut,
    reschedule,
    rescheduleStart,
    updateMilestoneDate,
    cycleStatus,
    createRelation,
    removeRelation,
    reorderTask,
    undo,
  };
}
