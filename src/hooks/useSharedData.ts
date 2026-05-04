import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_DAY_WIDTH, MAX_DAY_WIDTH, MIN_DAY_WIDTH } from '@/types';
import type { Filters, GroupBy, Milestone, Task } from '@/types';

const DEFAULT_PRIORITIES = new Set([0, 1, 2, 3, 4]);

export function useSharedData(shareToken: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [projectName, setProjectName] = useState('');
  const [cachedAt, setCachedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [dayWidth, setDayWidth] = useState(DEFAULT_DAY_WIDTH);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [filters, setFilters] = useState<Filters>({
    assignee: '',
    status: '',
    priorities: new Set(DEFAULT_PRIORITIES),
    search: '',
    dateFrom: '',
    dateTo: '',
  });

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

  const fetchSharedData = useCallback(
    async (password?: string) => {
      setLoading(true);
      setError('');
      setPasswordError('');

      try {
        const { data, error: fnError } = await supabase.functions.invoke('share-roadmap', {
          body: { action: 'get', shareToken, password },
        });

        if (fnError) throw new Error(fnError.message);

        if (data.needsPassword && !data.cachedData) {
          setNeedsPassword(true);
          setProjectName(data.projectName || '');
          if (data.error) setPasswordError(data.error);
          return;
        }

        if (data.error) {
          setError(data.error);
          return;
        }

        if (data.expired) {
          setError('This shared link has expired.');
          return;
        }

        setNeedsPassword(false);
        setProjectName(data.projectName);
        setTasks(data.cachedData?.tasks || []);
        setDoneTasks(data.cachedData?.doneTasks || []);
        setMilestones(data.cachedData?.milestones || []);
        setCachedAt(data.cachedAt);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [shareToken],
  );

  const submitPassword = useCallback(
    (password: string) => {
      fetchSharedData(password);
    },
    [fetchSharedData],
  );

  const zoomIn = useCallback(() => {
    setDayWidth((w) => Math.min(w + 7, MAX_DAY_WIDTH));
  }, []);

  const zoomOut = useCallback(() => {
    setDayWidth((w) => Math.max(w - 7, MIN_DAY_WIDTH));
  }, []);

  useEffect(() => {
    if (shareToken) fetchSharedData();
  }, [shareToken, fetchSharedData]);

  return {
    tasks,
    doneTasks,
    filteredTasks,
    milestones,
    projectName,
    cachedAt,
    assignees,
    statuses,
    loading,
    error,
    needsPassword,
    passwordError,
    submitPassword,
    dayWidth,
    groupBy,
    filters,
    setFilters,
    setGroupBy,
    zoomIn,
    zoomOut,
  };
}
