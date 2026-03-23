import { useCallback, useRef, useState } from 'react';
import type { Task } from '../types';
import type { ColumnWidths } from './GanttChart';
import { Avatar } from '../utils/avatar';
import { openDetailPanel } from './DetailPanel';

interface Props {
  task: Task;
  chartStart: Date;
  totalDays: number;
  today: Date;
  dayWidth: number;
  colWidths: ColumnWidths;
  onReschedule?: (taskUuid: string, newDueDate: string) => Promise<void>;
  onRescheduleStart?: (taskUuid: string, newStartDate: string) => Promise<void>;
  onCycleStatus?: (taskUuid: string) => Promise<void>;
}

function priorityClass(val: number): string {
  if (val === 1) return 'urgent';
  if (val === 2) return 'high';
  if (val === 3) return 'medium';
  if (val === 4) return 'low';
  return 'none';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

const barGradients: Record<string, string> = {
  urgent: 'linear-gradient(135deg, #da3633, #f85149)',
  high: 'linear-gradient(135deg, #d47519, #ffa657)',
  medium: 'linear-gradient(135deg, #9e6a03, #d2992a)',
  low: 'linear-gradient(135deg, #484f58, #8b949e)',
  none: 'linear-gradient(135deg, #30363d, #484f58)',
};

const barShadows: Record<string, string> = {
  urgent: '0 2px 8px rgba(248,81,73,0.3)',
  high: '0 2px 8px rgba(255,166,87,0.3)',
  medium: '0 2px 8px rgba(210,153,34,0.3)',
  low: '0 2px 8px rgba(139,148,158,0.2)',
  none: '0 2px 8px rgba(72,79,88,0.2)',
};

const idColors: Record<string, string> = {
  urgent: '#f85149',
  high: '#ffa657',
  medium: '#d2992a',
  low: '#8b949e',
  none: '#8b949e',
};

const priorityBadgeClasses: Record<string, string> = {
  urgent: 'bg-urgent/15 text-urgent border border-urgent/25',
  high: 'bg-high/15 text-high border border-high/25',
  medium: 'bg-medium/15 text-medium border border-medium/25',
  low: 'bg-low/15 text-low border border-low/25',
  none: 'bg-none/15 text-none border border-none/25',
};

// Status type → dot color
const statusDotColors: Record<string, string> = {
  started: '#58a6ff',
  unstarted: '#484f58',
  completed: '#238636',
  canceled: '#8b949e',
  triage: '#d2992a',
  backlog: '#484f58',
};

// Priority SVG icons (tiny inline)
function PriorityIcon({ val }: { val: number }) {
  const cls = 'inline-block shrink-0';
  if (val === 1) return (
    <svg className={cls} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1.5a.5.5 0 01.5.5v5.793l2.146-2.147a.5.5 0 01.708.708l-3 3a.5.5 0 01-.708 0l-3-3a.5.5 0 11.708-.708L7.5 7.793V2a.5.5 0 01.5-.5z" transform="rotate(180 8 8)" />
      <path d="M3.5 13a.5.5 0 01.5-.5h8a.5.5 0 010 1H4a.5.5 0 01-.5-.5z" transform="rotate(180 8 8)" />
    </svg>
  );
  if (val === 2) return (
    <svg className={cls} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3l4 5H4l4-5z" />
    </svg>
  );
  if (val === 3) return (
    <svg className={cls} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="7" width="10" height="2" rx="1" />
    </svg>
  );
  if (val === 4) return (
    <svg className={cls} width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 13l-4-5h8l-4 5z" />
    </svg>
  );
  return (
    <svg className={cls} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="4" />
    </svg>
  );
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttRow({ task, chartStart, totalDays, today, dayWidth, colWidths, onReschedule, onRescheduleStart, onCycleStatus }: Props) {
  const pCls = priorityClass(task.priorityVal);
  const dueDate = new Date(task.due + 'T00:00:00');
  const daysLeft = daysBetween(today, dueDate);
  const overdue = daysLeft < 0;

  const hasStartDate = !!task.startDate;
  const taskStartDate = hasStartDate ? new Date(task.startDate + 'T00:00:00') : null;

  // Drag state — due date (right edge)
  const [dragDelta, setDragDelta] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number } | null>(null);

  // Drag state — start date (left edge)
  const [startDragDelta, setStartDragDelta] = useState(0);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const startDragRef = useRef<{ startX: number } | null>(null);

  // Drag state — whole bar (move both dates)
  const [moveDelta, setMoveDelta] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const moveRef = useRef<{ startX: number } | null>(null);
  const didDragRef = useRef(false);

  const isAnyDrag = isDragging || isDraggingStart || isMoving;

  // Bar position
  let barLeft: number;
  let barWidth: number;
  let overdueWidth = 0;

  if (hasStartDate && taskStartDate) {
    const startDay = daysBetween(chartStart, taskStartDate);
    const endDay = daysBetween(chartStart, dueDate);
    barLeft = startDay * dayWidth;
    barWidth = Math.max((endDay - startDay) * dayWidth, dayWidth);
    if (overdue) {
      overdueWidth = Math.abs(daysLeft) * dayWidth;
    }
  } else if (overdue) {
    const barEndDay = daysBetween(chartStart, dueDate);
    barLeft = barEndDay * dayWidth;
    barWidth = Math.abs(daysLeft) * dayWidth;
  } else {
    const barStartDay = daysBetween(chartStart, today);
    const barEndDay = daysBetween(chartStart, dueDate);
    barLeft = barStartDay * dayWidth;
    barWidth = Math.max((barEndDay - barStartDay) * dayWidth, dayWidth);
  }

  // Apply due date drag (extends/shrinks right edge), start drag (moves left edge), or whole-bar move
  const displayBarWidth = Math.max(barWidth + dragDelta - startDragDelta, dayWidth);
  const displayBarLeft = barLeft + startDragDelta + moveDelta;

  // Calculate new dates from drag deltas
  const dragDays = Math.round(dragDelta / dayWidth);
  const newDueDate = dragDays !== 0 ? (() => {
    const d = new Date(dueDate);
    d.setDate(d.getDate() + dragDays);
    return d;
  })() : null;

  // For start date drag: use existing start date as base, or the bar's visual start position
  const startDragDays = Math.round(startDragDelta / dayWidth);
  const barStartBaseDate = taskStartDate || (() => {
    // Derive from bar's left position (barLeft / dayWidth days from chartStart)
    const d = new Date(chartStart);
    d.setDate(d.getDate() + Math.round(barLeft / dayWidth));
    return d;
  })();
  const newStartDate = startDragDays !== 0 ? (() => {
    const d = new Date(barStartBaseDate);
    d.setDate(d.getDate() + startDragDays);
    return d;
  })() : null;

  const moveDays = Math.round(moveDelta / dayWidth);

  let barLabel: string;
  if (isDragging && newDueDate) {
    barLabel = newDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (isDraggingStart && newStartDate) {
    barLabel = newStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (isMoving && moveDays !== 0) {
    barLabel = `${moveDays > 0 ? '+' : ''}${moveDays}d`;
  } else if (task.totalChildren > 0) {
    barLabel = `${task.completedChildren}/${task.totalChildren}`;
  } else {
    barLabel = overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`;
  }

  function formatDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Due date drag (right edge)
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX };
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setDragDelta(ev.clientX - dragRef.current.startX);
    };

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setIsDragging(false);

      if (dragRef.current && onReschedule) {
        const delta = ev.clientX - dragRef.current.startX;
        const days = Math.round(delta / dayWidth);
        if (days !== 0) {
          const nd = new Date(dueDate);
          nd.setDate(nd.getDate() + days);
          await onReschedule(task.uuid, formatDateStr(nd));
        }
      }
      dragRef.current = null;
      setDragDelta(0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dayWidth, dueDate, onReschedule, task.uuid]);

  // Start date drag (left edge)
  const handleStartDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startDragRef.current = { startX: e.clientX };
    setIsDraggingStart(true);

    const onMove = (ev: MouseEvent) => {
      if (!startDragRef.current) return;
      setStartDragDelta(ev.clientX - startDragRef.current.startX);
    };

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setIsDraggingStart(false);

      if (startDragRef.current && onRescheduleStart) {
        const delta = ev.clientX - startDragRef.current.startX;
        const days = Math.round(delta / dayWidth);
        if (days !== 0) {
          // Use existing start date or derive from bar's visual left edge
          const base = taskStartDate || (() => {
            const d = new Date(chartStart);
            d.setDate(d.getDate() + Math.round(barLeft / dayWidth));
            return d;
          })();
          const nd = new Date(base);
          nd.setDate(nd.getDate() + days);
          await onRescheduleStart(task.uuid, formatDateStr(nd));
        }
      }
      startDragRef.current = null;
      setStartDragDelta(0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dayWidth, taskStartDate, onRescheduleStart, task.uuid, chartStart, barLeft]);

  // Whole bar move (shift both start and due dates)
  const handleMoveStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    moveRef.current = { startX: e.clientX };
    didDragRef.current = false;
    setIsMoving(true);

    const onMove = (ev: MouseEvent) => {
      if (!moveRef.current) return;
      const delta = ev.clientX - moveRef.current.startX;
      if (Math.abs(delta) > 3) didDragRef.current = true;
      setMoveDelta(delta);
    };

    const onUp = async (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setIsMoving(false);

      if (moveRef.current) {
        const delta = ev.clientX - moveRef.current.startX;
        const days = Math.round(delta / dayWidth);
        if (days !== 0) {
          // Update due date
          if (onReschedule) {
            const nd = new Date(dueDate);
            nd.setDate(nd.getDate() + days);
            await onReschedule(task.uuid, formatDateStr(nd));
          }
          // Update start date
          if (onRescheduleStart) {
            const base = taskStartDate || (() => {
              const d = new Date(chartStart);
              d.setDate(d.getDate() + Math.round(barLeft / dayWidth));
              return d;
            })();
            const ns = new Date(base);
            ns.setDate(ns.getDate() + days);
            await onRescheduleStart(task.uuid, formatDateStr(ns));
          }
        }
      }
      moveRef.current = null;
      setMoveDelta(0);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [dayWidth, dueDate, taskStartDate, onReschedule, onRescheduleStart, task.uuid, chartStart, barLeft]);

  // Background day cells
  const bgDays: { isWeekend: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    bgDays.push({
      isWeekend: isWeekend(d),
      isToday: d.getTime() === today.getTime(),
    });
  }

  const progressWidth = task.totalChildren > 0 ? `${task.progress}%` : undefined;
  const statusDotColor = statusDotColors[task.statusType] || '#484f58';

  return (
    <tr
      className="transition-colors duration-150 hover:bg-accent/[0.03] border-l-2 border-l-transparent hover:border-l-accent focus-within:bg-accent/[0.04] focus-within:border-l-accent"
      tabIndex={0}
      role="row"
      aria-label={`${task.id}: ${task.title}, ${task.priority} priority, due ${formatDate(task.due)}, ${task.status}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(task.url, '_blank');
        }
        if (e.key === 's' && onCycleStatus) {
          e.preventDefault();
          onCycleStatus(task.uuid);
        }
        // Arrow key navigation between rows
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
          next?.focus();
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement;
          prev?.focus();
        }
      }}
    >
      {/* Task info */}
      <td className="py-3 px-4 border-b border-border-primary align-middle overflow-hidden" style={{ width: colWidths.task, minWidth: 200, maxWidth: colWidths.task }}>
        <div className="flex items-start gap-2.5">
          <Avatar name={task.assignee} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <a
                href={task.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold tracking-wide hover:underline"
                style={{ color: idColors[pCls] }}
              >
                {task.id}
              </a>
              {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-text-muted shrink-0" aria-label={
                  (task.blocks.length > 0 ? `Blocks ${task.blocks.length}` : '') +
                  (task.blocks.length > 0 && task.blockedBy.length > 0 ? ' · ' : '') +
                  (task.blockedBy.length > 0 ? `Blocked by ${task.blockedBy.length}` : '')
                }>
                  <path d="M4.5 2A2.5 2.5 0 002 4.5v1a.5.5 0 001 0v-1A1.5 1.5 0 014.5 3h1a.5.5 0 000-1h-1zm6 0a.5.5 0 000 1h1A1.5 1.5 0 0113 4.5v1a.5.5 0 001 0v-1A2.5 2.5 0 0011.5 2h-1zm-8 8a.5.5 0 01.5.5v1A1.5 1.5 0 004.5 13h1a.5.5 0 010 1h-1A2.5 2.5 0 012 11.5v-1a.5.5 0 01.5-.5zm11 0a.5.5 0 01.5.5v1a2.5 2.5 0 01-2.5 2.5h-1a.5.5 0 010-1h1a1.5 1.5 0 001.5-1.5v-1a.5.5 0 01.5-.5z" />
                </svg>
              )}
            </div>
            <div className="text-[13px] font-medium text-text-primary leading-snug truncate" style={{ maxWidth: colWidths.task - 60 }}>
              {task.title}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {/* Status chip */}
              <button
                onClick={() => onCycleStatus?.(task.uuid)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-bg-hover border border-border-primary hover:border-accent hover:text-accent cursor-pointer transition-colors text-text-secondary"
                title="Click to cycle status"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusDotColor }}
                />
                {task.status}
              </button>
              {/* Assignee name */}
              <span className="text-[10.5px] text-text-secondary">{task.assignee}</span>
              {/* Subtask count */}
              {task.totalChildren > 0 && (
                <span className="text-[10px] text-text-muted">
                  {task.completedChildren}/{task.totalChildren} subtasks
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Priority */}
      <td className="py-3 px-3 border-b border-border-primary align-middle" style={{ width: colWidths.priority, minWidth: 60 }}>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold py-0.5 px-2 rounded-full tracking-wide ${priorityBadgeClasses[pCls]}`}
        >
          <PriorityIcon val={task.priorityVal} />
          {task.priority}
        </span>
      </td>

      {/* Due date */}
      <td className="py-3 px-4 text-xs text-text-secondary whitespace-nowrap border-b border-border-primary align-middle tabular-nums" style={{ width: colWidths.due, minWidth: 80 }}>
        <div className="flex flex-col">
          {hasStartDate && (
            <span className="text-[10px] text-text-muted">{formatDate(task.startDate!)} →</span>
          )}
          <span>{formatDate(task.due)}</span>
          <span
            className="text-[10px]"
            style={{
              color: overdue ? '#f85149' : daysLeft <= 14 ? '#ffa657' : undefined,
            }}
          >
            {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days left`}
          </span>
        </div>
      </td>

      {/* Chart */}
      <td className="py-2.5 relative border-b border-border-primary align-middle">
        <div className="relative h-8 flex items-center" style={{ width: totalDays * dayWidth }}>
          {/* Background grid */}
          <div className="absolute inset-0 flex">
            {bgDays.map((d, i) => (
              <div
                key={i}
                className={`shrink-0 h-full ${d.isWeekend ? 'bg-white/[0.015]' : ''} ${d.isToday ? 'bg-accent/5' : ''}`}
                style={{
                  width: dayWidth,
                  borderRight: d.isToday
                    ? '1px dashed rgba(88,166,255,0.3)'
                    : '1px solid rgba(33,38,45,0.3)',
                }}
              />
            ))}
          </div>

          {/* Main bar */}
          <div
            className={`gantt-bar absolute h-[26px] rounded-md top-[3px] flex items-center justify-end pr-2 text-[10px] font-semibold text-white/70 z-[2] min-w-[20px] transition-[filter,transform] duration-150 hover:brightness-120 hover:scale-y-110 ${overdue && !hasStartDate ? 'bar-overdue animate-pulse-bar' : `bar-${pCls}`} ${isAnyDrag ? '!transition-none !transform-none opacity-80' : ''} ${(onReschedule || onRescheduleStart) ? (isMoving ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}`}
            style={{
              left: displayBarLeft,
              width: displayBarWidth,
              background: overdue && !hasStartDate ? 'linear-gradient(135deg, #da3633, #f85149)' : barGradients[pCls],
              boxShadow: overdue && !hasStartDate ? '0 2px 12px rgba(248,81,73,0.5)' : barShadows[pCls],
              overflow: 'hidden',
            }}
            onClick={() => { if (!didDragRef.current) openDetailPanel(task); }}
            onMouseDown={(onReschedule || onRescheduleStart) ? handleMoveStart : undefined}
          >
            {/* Left drag handle (start date — works for setting new or editing existing) */}
            {onRescheduleStart && (
              <div
                className="absolute left-0 top-0 bottom-0 w-[6px] cursor-col-resize z-[3] hover:bg-white/20 rounded-l-md"
                onMouseDown={handleStartDragStart}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {progressWidth && (
              <div
                className="absolute left-0 top-0 bottom-0 rounded-md opacity-30 bg-white"
                style={{ width: progressWidth }}
              />
            )}
            <span className="relative z-[1]">{barLabel}</span>

            {onReschedule && (
              <div
                className="absolute right-0 top-0 bottom-0 w-[6px] cursor-col-resize z-[3] hover:bg-white/20 rounded-r-md"
                onMouseDown={handleDragStart}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>

          {/* Overdue extension */}
          {hasStartDate && overdue && overdueWidth > 0 && (
            <div
              className="absolute h-[26px] rounded-r-md top-[3px] animate-pulse-bar z-[2]"
              style={{
                left: barLeft + barWidth,
                width: overdueWidth,
                background: 'linear-gradient(135deg, #da3633, #f85149)',
                boxShadow: '0 2px 12px rgba(248,81,73,0.5)',
                opacity: 0.7,
              }}
            />
          )}
        </div>
      </td>
    </tr>
  );
}
