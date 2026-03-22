import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchIssues, fetchProjects, testAuth } from '../api/linear';
import { DEFAULT_DAY_WIDTH, MAX_DAY_WIDTH, MIN_DAY_WIDTH } from '../types';
import type { Filters, Milestone, Project, Task } from '../types';

const DEFAULT_PRIORITIES = new Set([0, 1, 2, 3, 4]);

export function useLinearData() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('linear_api_key') || '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => localStorage.getItem('linear_selected_project') || '',
  );
  const [projectName, setProjectName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState('');
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [filters, setFilters] = useState<Filters>({
    assignee: '',
    status: '',
    priorities: new Set(DEFAULT_PRIORITIES),
    search: '',
  });

  const isAuthenticated = !!apiKey;
  const initialLoadDone = useRef(false);

  // Derived: unique assignees and statuses from current tasks
  const assignees = useMemo(() => [...new Set(tasks.map((t) => t.assignee))].sort(), [tasks]);
  const statuses = useMemo(() => [...new Set(tasks.map((t) => t.status))].sort(), [tasks]);

  // Filtered tasks
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

  const authenticate = useCallback(async (key: string) => {
    await testAuth(key);
    localStorage.setItem('linear_api_key', key);
    setApiKey(key);
  }, []);

  const logout = useCallback(() => {
    setApiKey('');
    setTasks([]);
    setProjects([]);
    setProjectName('');
    setMilestones([]);
    localStorage.removeItem('linear_api_key');
  }, []);

  const loadProjects = useCallback(async () => {
    if (!apiKey) return;
    const p = await fetchProjects(apiKey);
    setProjects(p);
    return p;
  }, [apiKey]);

  const loadIssues = useCallback(
    async (projectId: string) => {
      if (!apiKey || !projectId) return;
      setLoading(true);
      setError('');
      try {
        const result = await fetchIssues(apiKey, projectId);
        setTasks(result.tasks);
        setProjectName(result.projectName);
        setMilestones(result.milestones);
        setLastSynced(
          new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        );
      } catch (e) {
        setError((e as Error).message);
        setTasks([]);
        setMilestones([]);
      } finally {
        setLoading(false);
      }
    },
    [apiKey],
  );

  const selectProject = useCallback(
    (id: string) => {
      setSelectedProjectId(id);
      localStorage.setItem('linear_selected_project', id);
      setFilters({ assignee: '', status: '', priorities: new Set(DEFAULT_PRIORITIES), search: '' });
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

  // Initial load
  useEffect(() => {
    if (!apiKey || initialLoadDone.current) return;
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
  }, [apiKey, selectedProjectId, loadProjects, loadIssues]);

  return {
    isAuthenticated,
    projects,
    selectedProjectId,
    projectName,
    tasks,
    filteredTasks,
    milestones,
    assignees,
    statuses,
    loading,
    error,
    lastSynced,
    dayWidth,
    filters,
    setFilters,
    authenticate,
    logout,
    selectProject,
    refresh,
    zoomIn,
    zoomOut,
  };
}
