import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';

function stripMarkdown(md: string): string {
  return md
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#+\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '\u2022 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface TooltipState {
  task: Task | null;
  x: number;
  y: number;
}

let globalTooltipSetter: ((s: TooltipState | ((prev: TooltipState) => TooltipState)) => void) | null = null;

export function showTooltip(task: Task, x: number, y: number) {
  globalTooltipSetter?.({ task, x, y });
}
export function hideTooltip() {
  globalTooltipSetter?.({ task: null, x: 0, y: 0 });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Tooltip() {
  const [state, setState] = useState<TooltipState>({ task: null, x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalTooltipSetter = setState;
    return () => { globalTooltipSetter = null; };
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (state.task) {
        setState((prev) => ({ ...prev, x: e.clientX, y: e.clientY }));
      }
    };
    document.addEventListener('mousemove', onMove);
    return () => document.removeEventListener('mousemove', onMove);
  }, [state.task]);

  if (!state.task) return null;

  const { task, x, y } = state;
  const dueDate = new Date(task.due + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
  const overdue = daysLeft < 0;
  const desc = task.description ? stripMarkdown(task.description) : '';

  // Position
  let left = x + 16;
  let top = y - 10;
  if (ref.current) {
    const rect = ref.current.getBoundingClientRect();
    if (left + rect.width > window.innerWidth - 12) left = x - rect.width - 16;
    if (top + rect.height > window.innerHeight - 12) top = window.innerHeight - rect.height - 12;
    if (top < 12) top = 12;
  }

  return (
    <div
      ref={ref}
      className="fixed bg-bg-header border border-border-secondary rounded-[10px] py-4 px-5 z-100 pointer-events-none max-w-[520px] min-w-[280px] w-max"
      style={{ left, top, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
    >
      <div className="text-sm font-semibold text-white mb-2.5">
        {task.id} &mdash; {task.title}
      </div>
      <div className="text-xs text-text-secondary leading-[1.7] mb-2.5">
        Priority: <strong>{task.priority}</strong> &middot;{' '}
        {task.startDate && (
          <>
            Start: <strong>{formatDateShort(task.startDate)}</strong> &middot;{' '}
          </>
        )}
        Due: <strong>{formatDateShort(task.due)}</strong> &middot;{' '}
        Status: <strong>{task.status}</strong>
        <br />
        Assignee: <strong>{task.assignee}</strong> &middot;{' '}
        {overdue ? (
          <span className="text-urgent">Overdue by {Math.abs(daysLeft)} days</span>
        ) : (
          <>
            Days remaining: <strong>{daysLeft}</strong>
          </>
        )}
        {task.totalChildren > 0 && (
          <>
            <br />
            Progress: <strong>{task.completedChildren}/{task.totalChildren} subtasks ({task.progress}%)</strong>
          </>
        )}
        {task.blocks.length > 0 && (
          <>
            <br />
            Blocks: <strong>{task.blocks.join(', ')}</strong>
          </>
        )}
        {task.blockedBy.length > 0 && (
          <>
            <br />
            Blocked by: <strong className="text-urgent">{task.blockedBy.join(', ')}</strong>
          </>
        )}
      </div>
      {desc && (
        <div className="text-xs text-[#c9d1d9] leading-relaxed border-t border-border-primary pt-2.5 whitespace-pre-wrap break-words">
          {desc}
        </div>
      )}
    </div>
  );
}
