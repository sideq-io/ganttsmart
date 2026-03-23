import { useEffect, useRef, useState } from 'react';
import type { Task } from '@/types';
import { Avatar } from '@/utils/avatar';

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

const priorityColors: Record<string, string> = {
  Urgent: '#f85149',
  High: '#ffa657',
  Medium: '#d2992a',
  Low: '#8b949e',
  None: '#484f58',
};

const statusDotColors: Record<string, string> = {
  started: '#58a6ff',
  unstarted: '#484f58',
  completed: '#238636',
  canceled: '#8b949e',
  triage: '#d2992a',
  backlog: '#484f58',
};

export default function Tooltip() {
  const [state, setState] = useState<TooltipState>({ task: null, x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalTooltipSetter = setState;
    return () => {
      globalTooltipSetter = null;
    };
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
  const statusDotColor = statusDotColors[task.statusType] || '#484f58';
  const priorityColor = priorityColors[task.priority] || '#484f58';

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
      className="fixed bg-bg-header border border-border-secondary rounded-xl py-4 px-5 z-100 pointer-events-none max-w-[480px] min-w-[300px] w-max"
      style={{ left, top, boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)' }}
    >
      {/* Header: Avatar + ID + Title */}
      <div className="flex items-start gap-3 mb-3.5">
        <Avatar name={task.assignee} size="md" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wide mb-0.5" style={{ color: priorityColor }}>
            {task.id}
          </div>
          <div className="text-sm font-semibold text-text-primary leading-snug truncate">{task.title}</div>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs mb-3">
        {/* Priority */}
        <div>
          <div className="text-text-muted text-[10px] mb-0.5">Priority</div>
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${priorityColor}20`,
              color: priorityColor,
              border: `1px solid ${priorityColor}40`,
            }}
          >
            {task.priority}
          </span>
        </div>

        {/* Status */}
        <div>
          <div className="text-text-muted text-[10px] mb-0.5">Status</div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: statusDotColor }} />
            {task.status}
          </span>
        </div>

        {/* Assignee */}
        <div>
          <div className="text-text-muted text-[10px] mb-0.5">Assignee</div>
          <div className="flex items-center gap-1.5">
            <Avatar name={task.assignee} size="sm" />
            <span className="text-[11px] text-text-secondary font-medium">{task.assignee}</span>
          </div>
        </div>

        {/* Due date */}
        <div>
          <div className="text-text-muted text-[10px] mb-0.5">Due</div>
          <div className="text-[11px] font-medium text-text-secondary tabular-nums">
            {task.startDate && <span className="text-text-muted">{formatDateShort(task.startDate)} → </span>}
            {formatDateShort(task.due)}
            <span className="ml-1" style={{ color: overdue ? '#f85149' : daysLeft <= 14 ? '#ffa657' : undefined }}>
              ({overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`})
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {task.totalChildren > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
            <span>Progress</span>
            <span>
              {task.completedChildren}/{task.totalChildren} subtasks ({task.progress}%)
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-border-primary overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      {/* Blocking info */}
      {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.blocks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-high/10 text-high border border-high/20">
              Blocks {task.blocks.join(', ')}
            </span>
          )}
          {task.blockedBy.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-urgent/10 text-urgent border border-urgent/20">
              Blocked by {task.blockedBy.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {desc && (
        <div className="text-xs text-text-secondary leading-relaxed border-t border-border-secondary/50 pt-2.5 mt-1 whitespace-pre-wrap break-words">
          {desc}
        </div>
      )}
    </div>
  );
}
