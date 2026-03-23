import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchIssues, fetchProjects, fetchWorkflowStates, updateIssueDueDate, updateIssueStartDate, updateIssueState } from '../api/linear';
import { toast, toastError, toastSuccess } from '../components/Toast';
import { DEFAULT_DAY_WIDTH, MAX_DAY_WIDTH, MIN_DAY_WIDTH } from '../types';
import type { Filters, GroupBy, Milestone, Project, Task, WorkflowState } from '../types';

const DEFAULT_PRIORITIES = new Set([0, 1, 2, 3, 4]);
const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function useLinearData(linearToken: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem('linear_selected_project') || '',
  );
  const [projectName, setProjectName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [workflowStates, setWorkflowStates] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filters, setFilters] = useState<Filters>({
    assignee: '',
    status: '',
    priorities: new Set(DEFAULT_PRIORITIES),
    search: '',
  });

  const initialLoadDone = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Undo stack: stores previous task snapshots
  const undoStackRef = useRef<Array<{ tasks: Task[]; label: string }>>([]);

  const assignees = useMemo(() => [...new Set(tasks.map((t) => t.assignee))].sort(), [tasks]);
  const statuses = useMemo(() => [...new Set(tasks.map((t) => t.status))].sort(), [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!filters.priorities.has(t.priorityVal)) return false;
      if (filters.assignee && t.assignee !== filters.assignee) return false;
      if (filters.status && t.status !== filters.status) return false;
      if (filters.search) {
        const hay = `${t.id} ${t.title} ${t.assignee} ${t.status}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });
  }, [tasks, filters]);

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
      toastError(`Failed to load projects: ${(e as Error).message}`);
      throw e;
    }
  }, [linearToken]);

  // Silent refresh for polling (no loading spinner, no error clearing)
  const silentRefresh = useCallback(
    async (projectId: string) => {
      if (!linearToken || !projectId) return;
      try {
        const result = await fetchIssues(linearToken, projectId);
        setTasks(result.tasks);
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        );
      } catch {
        // Silent — don't spam toasts on poll failures
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
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        );
        if (result.tasks.length > 0 && result.tasks[0].teamId) {
          try {
            const states = await fetchWorkflowStates(linearToken, result.tasks[0].teamId);
            setWorkflowStates(states);
          } catch {
            // Non-critical
          }
        }
      } catch (e) {
        const msg = (e as Error).message;
        setError(msg);
        setTasks([]);
        setMilestones([]);
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
      setFilters({ assignee: '', status: '', priorities: new Set(DEFAULT_PRIORITIES), search: '' });
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

  // Optimistic reschedule (due date) with rollback + undo
  const reschedule = useCallback(
    async (taskUuid: string, newDueDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const task = tasks.find((t) => t.uuid === taskUuid);
      setTasks((prev) =>
        prev.map((t) => (t.uuid === taskUuid ? { ...t, due: newDueDate } : t)),
      );

      try {
        await updateIssueDueDate(linearToken, taskUuid, newDueDate);
        pushUndo(prevTasks, `${task?.id || ''} due date`);
        toast(`Due date updated`, 'success', { label: 'Undo', onClick: () => {
          setTasks(prevTasks);
          if (task) updateIssueDueDate(linearToken, taskUuid, task.due).catch(() => {});
        }});
      } catch (e) {
        setTasks(prevTasks);
        toastError(
          `Failed to update due date: ${(e as Error).message}`,
          () => reschedule(taskUuid, newDueDate),
        );
      }
    },
    [linearToken, tasks, pushUndo],
  );

  // Optimistic reschedule (start date) with rollback + undo
  const rescheduleStart = useCallback(
    async (taskUuid: string, newStartDate: string) => {
      if (!linearToken) return;

      const prevTasks = tasks;
      const task = tasks.find((t) => t.uuid === taskUuid);
      setTasks((prev) =>
        prev.map((t) => (t.uuid === taskUuid ? { ...t, startDate: newStartDate } : t)),
      );

      try {
        await updateIssueStartDate(linearToken, taskUuid, newStartDate);
        pushUndo(prevTasks, `${task?.id || ''} start date`);
        toast(`Start date updated`, 'success', { label: 'Undo', onClick: () => {
          setTasks(prevTasks);
          if (task?.startDate) updateIssueStartDate(linearToken, taskUuid, task.startDate).catch(() => {});
        }});
      } catch (e) {
        setTasks(prevTasks);
        toastError(
          `Failed to update start date: ${(e as Error).message}`,
          () => rescheduleStart(taskUuid, newStartDate),
        );
      }
    },
    [linearToken, tasks, pushUndo],
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
        prev.map((t) =>
          t.uuid === taskUuid ? { ...t, status: nextState.name, statusType: nextState.type } : t,
        ),
      );

      try {
        await updateIssueState(linearToken, taskUuid, nextState.id);
        pushUndo(prevTasks, `${task.id} status`);
        toast(`Status → ${nextState.name}`, 'success', { label: 'Undo', onClick: () => {
          setTasks(prevTasks);
          if (prevState) updateIssueState(linearToken, taskUuid, prevState.id).catch(() => {});
        }});
      } catch (e) {
        setTasks(prevTasks);
        toastError(
          `Failed to update status: ${(e as Error).message}`,
          () => cycleStatus(taskUuid),
        );
      }
    },
    [linearToken, workflowStates, tasks, pushUndo],
  );

  // Initial load when token is available
  useEffect(() => {
    if (!linearToken || initialLoadDone.current) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        const p = await loadProjects();
        if (!p?.length) return;
        const target = selectedProjectId && p.find((x) => x.id === selectedProjectId)
          ? selectedProjectId
          : p[0].id;
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
    filteredTasks,
    milestones,
    workflowStates,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
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
    cycleStatus,
    undo,
  };
}
