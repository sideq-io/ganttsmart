import type { Task } from '../types';
import { hideTooltip, showTooltip } from './Tooltip';

interface Props {
  task: Task;
  chartStart: Date;
  totalDays: number;
  today: Date;
  dayWidth: number;
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

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttRow({ task, chartStart, totalDays, today, dayWidth }: Props) {
  const pCls = priorityClass(task.priorityVal);
  const dueDate = new Date(task.due + 'T00:00:00');
  const daysLeft = daysBetween(today, dueDate);
  const overdue = daysLeft < 0;

  const hasStartDate = !!task.startDate;
  const taskStartDate = hasStartDate ? new Date(task.startDate + 'T00:00:00') : null;

  // Bar position
  let barLeft: number;
  let barWidth: number;
  let overdueWidth = 0;

  if (hasStartDate && taskStartDate) {
    // Start date mode: bar from startDate to dueDate
    const startDay = daysBetween(chartStart, taskStartDate);
    const endDay = daysBetween(chartStart, dueDate);
    barLeft = startDay * dayWidth;
    barWidth = Math.max((endDay - startDay) * dayWidth, dayWidth);
    if (overdue) {
      // Show overdue extension past the due date
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

  // Bar label
  let barLabel: string;
  if (task.totalChildren > 0) {
    barLabel = `${task.completedChildren}/${task.totalChildren}`;
  } else {
    barLabel = overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d`;
  }

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

  // Progress bar width (percentage of main bar)
  const progressWidth = task.totalChildren > 0 ? `${task.progress}%` : undefined;

  return (
    <tr className="transition-colors hover:bg-accent/[0.04]">
      {/* Task info */}
      <td className="py-3.5 px-4 min-w-[320px] max-w-[320px] w-[320px] border-b border-border-primary align-middle">
        <div className="text-[11px] font-semibold mb-0.5 tracking-wide" style={{ color: idColors[pCls] }}>
          {task.id}
          {(task.blocks.length > 0 || task.blockedBy.length > 0) && (
            <span className="ml-1.5 text-[9px] text-text-muted font-normal">
              {task.blocks.length > 0 && `blocks ${task.blocks.length}`}
              {task.blocks.length > 0 && task.blockedBy.length > 0 && ' · '}
              {task.blockedBy.length > 0 && `blocked by ${task.blockedBy.length}`}
            </span>
          )}
        </div>
        <div className="text-[13px] font-medium text-text-primary leading-snug whitespace-nowrap overflow-hidden text-ellipsis max-w-[280px]">
          {task.title}
        </div>
        <div className="text-[10px] text-text-muted mt-0.5">
          {task.status} &middot; {task.assignee}
          {task.totalChildren > 0 && (
            <span className="ml-1">
              &middot; {task.completedChildren}/{task.totalChildren} subtasks
            </span>
          )}
        </div>
      </td>

      {/* Priority */}
      <td className="py-3 px-4 w-[100px] min-w-[100px] border-b border-border-primary align-middle">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold py-0.5 px-2.5 rounded-full tracking-wide ${priorityBadgeClasses[pCls]}`}
        >
          {task.priority}
        </span>
      </td>

      {/* Due date */}
      <td className="py-3 px-4 text-xs text-text-secondary w-[110px] min-w-[110px] whitespace-nowrap border-b border-border-primary align-middle">
        {hasStartDate && (
          <>
            <span className="text-[10px] text-text-muted">{formatDate(task.startDate!)}</span>
            <span className="text-[10px] text-text-muted"> → </span>
          </>
        )}
        {formatDate(task.due)}
        <br />
        <span
          className="text-[10px]"
          style={{
            color: overdue ? '#f85149' : daysLeft <= 14 ? '#ffa657' : '#484f58',
          }}
        >
          {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days left`}
        </span>
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
            className={`absolute h-[26px] rounded-md top-[3px] flex items-center justify-end pr-2 text-[10px] font-semibold text-white/70 z-[2] min-w-[20px] cursor-default transition-[filter,transform] duration-150 hover:brightness-120 hover:scale-y-110 ${overdue && !hasStartDate ? 'animate-pulse-bar' : ''}`}
            style={{
              left: barLeft,
              width: barWidth,
              background: overdue && !hasStartDate ? 'linear-gradient(135deg, #da3633, #f85149)' : barGradients[pCls],
              boxShadow: overdue && !hasStartDate ? '0 2px 12px rgba(248,81,73,0.5)' : barShadows[pCls],
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => showTooltip(task, e.clientX, e.clientY)}
            onMouseLeave={hideTooltip}
          >
            {/* Progress fill */}
            {progressWidth && (
              <div
                className="absolute left-0 top-0 bottom-0 rounded-md opacity-30 bg-white"
                style={{ width: progressWidth }}
              />
            )}
            <span className="relative z-[1]">{barLabel}</span>
          </div>

          {/* Overdue extension (when task has start date and is overdue) */}
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
