import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Task } from '@/types';

export interface TaskBaseline {
  issue_id: string;
  planned_start: string | null;
  planned_due: string;
  first_seen_at: string;
}

export interface ChangeEvent {
  issue_id: string;
  field_changed: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

/** Get the current user ID from the local session (no network call). */
async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/**
 * Manages planning history: captures baselines on first load and logs change events.
 * Baselines are the first-seen dates for each task — the "original plan".
 * Change events are logged when due dates, start dates, or statuses are modified.
 */
export function usePlanningHistory(projectId: string) {
  const [baselines, setBaselines] = useState<Map<string, TaskBaseline>>(new Map());
  const baselinesSynced = useRef(false);
  const projectRef = useRef(projectId);

  // Reset when project changes
  useEffect(() => {
    if (projectRef.current !== projectId) {
      projectRef.current = projectId;
      baselinesSynced.current = false;
      setBaselines(new Map());
    }
  }, [projectId]);

  // Load existing baselines from DB
  const loadBaselines = useCallback(async () => {
    if (!projectId) return;
    const userId = await getUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from('task_baselines')
      .select('issue_id, planned_start, planned_due, first_seen_at')
      .eq('user_id', userId)
      .eq('project_id', projectId);

    if (error) {
      console.warn('Failed to load baselines:', error.message);
      return;
    }

    const map = new Map<string, TaskBaseline>();
    for (const row of data || []) {
      map.set(row.issue_id, row);
    }
    setBaselines(map);
    return map;
  }, [projectId]);

  // Sync baselines: for any task we haven't seen before, store its current dates as the baseline
  const syncBaselines = useCallback(
    async (tasks: Task[]) => {
      if (!projectId || baselinesSynced.current) return;

      const userId = await getUserId();
      if (!userId) return;
      baselinesSynced.current = true;

      // Load current baselines first
      let currentBaselines = baselines;
      if (currentBaselines.size === 0) {
        const loaded = await loadBaselines();
        if (loaded) currentBaselines = loaded;
      }

      // Find tasks that don't have baselines yet
      const newBaselines = tasks.filter((t) => !currentBaselines.has(t.id));
      if (newBaselines.length === 0) return;

      const rows = newBaselines.map((t) => ({
        user_id: userId,
        issue_id: t.id,
        project_id: projectId,
        planned_start: t.startDate,
        planned_due: t.due,
      }));

      const { error } = await supabase
        .from('task_baselines')
        .upsert(rows, { onConflict: 'user_id,issue_id', ignoreDuplicates: true });

      if (error) {
        console.warn('Failed to save baselines:', error.message);
        return;
      }

      // Update local state
      const updated = new Map(currentBaselines);
      for (const t of newBaselines) {
        updated.set(t.id, {
          issue_id: t.id,
          planned_start: t.startDate,
          planned_due: t.due,
          first_seen_at: new Date().toISOString(),
        });
      }
      setBaselines(updated);
    },
    [projectId, baselines, loadBaselines],
  );

  // Log a field change to issue_change_history
  const logChange = useCallback(
    async (issueId: string, field: string, oldValue: string | null, newValue: string | null) => {
      if (!projectId) return;
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase.from('issue_change_history').insert({
        user_id: userId,
        issue_id: issueId,
        project_id: projectId,
        field_changed: field,
        old_value: oldValue,
        new_value: newValue,
      });

      if (error) {
        console.warn('Failed to log change:', error.message);
      }
    },
    [projectId],
  );

  // Log a status transition
  const logStatusTransition = useCallback(
    async (issueId: string, fromStatus: string | null, toStatus: string) => {
      if (!projectId) return;
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase.from('status_transition_log').insert({
        user_id: userId,
        issue_id: issueId,
        project_id: projectId,
        from_status: fromStatus,
        to_status: toStatus,
      });

      if (error) {
        console.warn('Failed to log status transition:', error.message);
      }
    },
    [projectId],
  );

  // Fetch change history for a specific task
  const getTaskHistory = useCallback(
    async (issueId: string): Promise<ChangeEvent[]> => {
      if (!projectId) return [];
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('issue_change_history')
        .select('issue_id, field_changed, old_value, new_value, changed_at')
        .eq('user_id', userId)
        .eq('issue_id', issueId)
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('Failed to fetch task history:', error.message);
        return [];
      }
      return data || [];
    },
    [projectId],
  );

  return {
    baselines,
    syncBaselines,
    logChange,
    logStatusTransition,
    getTaskHistory,
  };
}
