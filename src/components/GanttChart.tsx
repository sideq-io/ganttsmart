import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {GroupBy, Milestone, Task} from '@/types';
import {Avatar} from '@/utils/avatar';
import {daysBetween, isWeekend} from '@/utils/date';
import DependencyArrows from './DependencyArrows';
import GanttRow from './GanttRow';

interface Props {
  tasks: Task[];
  doneTasks?: Task[];
  milestones: Milestone[];
  loading: boolean;
  error: string;
  dayWidth: number;
  groupBy: GroupBy;
  onReschedule?: (taskUuid: string, newDueDate: string) => Promise<void>;
  onRescheduleStart?: (taskUuid: string, newStartDate: string) => Promise<void>;
  onCycleStatus?: (taskUuid: string) => Promise<void>;
  onCreateRelation?: (sourceTaskId: string, targetTaskId: string) => Promise<void>;
}

export interface ColumnWidths {
  task: number;
  priority: number;
  due: number;
}

const DEFAULT_WIDTHS: ColumnWidths = {task: 360, priority: 90, due: 110};
const MIN_WIDTHS: ColumnWidths = {task: 200, priority: 60, due: 80};

function groupTasks(tasks: Task[], groupBy: GroupBy): { key: string; label: string; tasks: Task[] }[] {
  if (groupBy === 'none') return [{key: '__all', label: '', tasks}];

  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    let key: string;
    if (groupBy === 'assignee') key = t.assignee;
    else if (groupBy === 'priority') key = t.priority;
    else key = t.status;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, tasks]) => ({key, label: key, tasks}));
}

// Resize handle component
function ResizeHandle({onResize}: { onResize: (delta: number) => void }) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;

      const onMove = (ev: MouseEvent) => {
        onResize(ev.clientX - startX);
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [onResize],
  );

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 group hover:bg-accent/30 transition-colors"
      onMouseDown={handleMouseDown}
    >
      <div className="absolute right-0 top-0 bottom-0 w-px bg-border-primary group-hover:bg-accent transition-colors"/>
    </div>
  );
}

export default function GanttChart({
                                     tasks,
                                     doneTasks = [],
                                     milestones,
                                     loading,
                                     error,
                                     dayWidth,
                                     groupBy,
                                     onReschedule,
                                     onRescheduleStart,
                                     onCycleStatus,
                                     onCreateRelation,
                                   }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [doneVisible, setDoneVisible] = useState(false);
  const [colWidths, setColWidths] = useState<ColumnWidths>(DEFAULT_WIDTHS);
  const ganttRef = useRef<HTMLDivElement>(null);
  const baseWidthsRef = useRef<ColumnWidths>(DEFAULT_WIDTHS);

  // Connection drag state (imperative for performance — no re-renders during mousemove)
  const innerRef = useRef<HTMLDivElement>(null);
  const connectionSvgRef = useRef<SVGSVGElement>(null);
  const connectionPathRef = useRef<SVGPathElement>(null);
  const connectingFromRef = useRef<string | null>(null);
  const connectingSourcePos = useRef<{ x: number; y: number } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectStart = useCallback(
    (taskId: string, _e: React.MouseEvent) => {
      const container = innerRef.current;
      if (!container) return;

      connectingFromRef.current = taskId;
      setIsConnecting(true);

      // Find source bar position
      const bar = container.querySelector(`[data-task-bar="${taskId}"]`) as HTMLElement | null;
      if (!bar) return;
      const containerRect = container.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      connectingSourcePos.current = {
        x: barRect.right - containerRect.left,
        y: barRect.top + barRect.height / 2 - containerRect.top,
      };

      // Show connection SVG
      const svg = connectionSvgRef.current;
      if (svg) {
        svg.style.display = '';
        svg.setAttribute('width', String(container.scrollWidth));
        svg.setAttribute('height', String(container.scrollHeight));
      }

      document.body.style.cursor = 'crosshair';

      const onMove = (ev: MouseEvent) => {
        const src = connectingSourcePos.current;
        const path = connectionPathRef.current;
        if (!src || !path || !container) return;

        const rect = container.getBoundingClientRect();
        const mx = ev.clientX - rect.left;
        const my = ev.clientY - rect.top;

        const dx = mx - src.x;
        const cx = Math.min(Math.max(Math.abs(dx) * 0.4, 20), 60);
        const d =
          dx > 30
            ? `M ${src.x} ${src.y} C ${src.x + cx} ${src.y}, ${mx - cx} ${my}, ${mx} ${my}`
            : `M ${src.x} ${src.y} C ${src.x + 40} ${src.y}, ${src.x + 40} ${(src.y + my) / 2}, ${(src.x + mx) / 2} ${(src.y + my) / 2} S ${mx - 40} ${my}, ${mx} ${my}`;
        path.setAttribute('d', d);

        // Highlight target bar under cursor
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const targetBar = el?.closest('[data-task-bar]') as HTMLElement | null;
        container.querySelectorAll('[data-task-bar]').forEach((b) => b.classList.remove('ring-2', 'ring-accent'));
        if (targetBar && targetBar.getAttribute('data-task-bar') !== taskId) {
          targetBar.classList.add('ring-2', 'ring-accent');
        }
      };

      const onUp = (ev: MouseEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';

        // Clean up highlights
        container.querySelectorAll('[data-task-bar]').forEach((b) => b.classList.remove('ring-2', 'ring-accent'));

        // Hide connection SVG
        const svg = connectionSvgRef.current;
        if (svg) svg.style.display = 'none';

        // Check if dropped on a valid target
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const targetBar = el?.closest('[data-task-bar]') as HTMLElement | null;
        const targetId = targetBar?.getAttribute('data-task-bar');

        connectingFromRef.current = null;
        connectingSourcePos.current = null;
        setIsConnecting(false);

        if (targetId && targetId !== taskId && onCreateRelation) {
          // Source blocks target
          onCreateRelation(taskId, targetId);
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [onCreateRelation],
  );

  // Clean up connection state on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Column resize handlers — store base on first drag, apply delta
  const makeResizeHandler = useCallback(
    (col: keyof ColumnWidths) => {
      let baseSet = false;
      return (delta: number) => {
        if (!baseSet) {
          baseWidthsRef.current = {...colWidths};
          baseSet = true;
          // Reset on mouseup
          const resetBase = () => {
            baseSet = false;
            document.removeEventListener('mouseup', resetBase);
          };
          document.addEventListener('mouseup', resetBase);
        }
        setColWidths((prev) => ({
          ...prev,
          [col]: Math.max(baseWidthsRef.current[col] + delta, MIN_WIDTHS[col]),
        }));
      };
    },
    [colWidths],
  );

  // All computation must happen before early returns to respect Rules of Hooks
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [tasks]); // recompute when tasks change (new day boundary)

  // Detect dependency violations: blocked task starts before blocker is due
  const depViolations = useMemo(() => {
    const violations = new Map<string, string[]>(); // blocked taskId → list of violated blocker IDs
    const taskMap = new Map(tasks.map((t) => [t.id, t]));

    const addViolation = (blockedId: string, blockerId: string) => {
      if (!violations.has(blockedId)) violations.set(blockedId, []);
      const list = violations.get(blockedId)!;
      if (!list.includes(blockerId)) list.push(blockerId);
    };

    for (const task of tasks) {
      // Check via blockedBy: does this task start before its blockers are due?
      for (const blockerId of task.blockedBy) {
        const blocker = taskMap.get(blockerId);
        if (!blocker) continue;
        const taskStart = task.startDate ? new Date(task.startDate + 'T00:00:00') : today;
        const blockerDue = new Date(blocker.due + 'T00:00:00');
        if (taskStart <= blockerDue) addViolation(task.id, blockerId);
      }

      // Check via blocks: do the tasks this one blocks start before this one is due?
      for (const blockedId of task.blocks) {
        const blocked = taskMap.get(blockedId);
        if (!blocked) continue;
        const blockedStart = blocked.startDate ? new Date(blocked.startDate + 'T00:00:00') : today;
        const blockerDue = new Date(task.due + 'T00:00:00');
        if (blockedStart <= blockerDue) addViolation(blockedId, task.id);
      }
    }
    return violations;
  }, [tasks, today]);

  const {chartStart, totalDays} = useMemo(() => {
    if (!tasks.length) return {chartStart: today, totalDays: 0};

    const allDates: number[] = [today.getTime()];
    tasks.forEach((t) => {
      allDates.push(new Date(t.due + 'T00:00:00').getTime());
      if (t.startDate) allDates.push(new Date(t.startDate + 'T00:00:00').getTime());
    });
    milestones.forEach((m) => {
      if (m.targetDate) allDates.push(new Date(m.targetDate + 'T00:00:00').getTime());
    });

    const minDate = new Date(Math.min(...allDates));
    const maxDate = new Date(Math.max(...allDates));
    const chartStart = new Date(minDate);
    chartStart.setDate(chartStart.getDate() - 2);
    const chartEnd = new Date(maxDate);
    chartEnd.setDate(chartEnd.getDate() + 3);
    const dataDays = daysBetween(chartStart, chartEnd);

    const fixedCols = colWidths.task + colWidths.priority + colWidths.due;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth - 80 : 1200;
    const minDaysToFill = Math.ceil(Math.max(viewportWidth - fixedCols, 0) / dayWidth);
    const totalDays = Math.max(dataDays, minDaysToFill);

    return {chartStart, totalDays};
  }, [tasks, milestones, today, colWidths, dayWidth]);

  // Calendar header (memoized)
  const {months, daysCells} = useMemo(() => {
    const months: { label: string; days: number }[] = [];
    const daysCells: { date: Date; isWeekend: boolean; isToday: boolean }[] = [];

    let currentMonth = '';
    let currentMonthCount = 0;

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(chartStart);
      d.setDate(d.getDate() + i);
      const mk = d.toLocaleDateString('en-US', {month: 'long', year: 'numeric'});

      if (mk !== currentMonth) {
        if (currentMonth) months.push({label: currentMonth, days: currentMonthCount});
        currentMonth = mk;
        currentMonthCount = 0;
      }
      currentMonthCount++;

      daysCells.push({
        date: d,
        isWeekend: isWeekend(d),
        isToday: d.getTime() === today.getTime(),
      });
    }
    if (currentMonth) months.push({label: currentMonth, days: currentMonthCount});

    return {months, daysCells};
  }, [chartStart, totalDays, today]);

  // Milestone positions (memoized)
  const milestonesInRange = useMemo(
    () =>
      milestones
        .filter((m) => m.targetDate)
        .map((m) => {
          const mDate = new Date(m.targetDate! + 'T00:00:00');
          const dayOffset = daysBetween(chartStart, mDate);
          return {...m, dayOffset};
        })
        .filter((m) => m.dayOffset >= 0 && m.dayOffset <= totalDays),
    [milestones, chartStart, totalDays],
  );

  const fixedColsWidth = colWidths.task + colWidths.priority + colWidths.due;
  const groups = useMemo(() => groupTasks(tasks, groupBy), [tasks, groupBy]);

  // Early returns — after all hooks
  if (loading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-20 text-text-secondary">
          <div
            className="w-10 h-10 mx-auto mb-4 border-3 border-border-primary border-t-accent rounded-full animate-spin"/>
          <div className="text-sm">Fetching issues from Linear...</div>
          <p className="text-xs text-text-muted mt-1">This may take a few seconds</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-20 px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-urgent/10 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="text-urgent"
            >
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-2">Something went wrong</h3>
          <p className="text-sm text-text-secondary mb-1 max-w-md mx-auto">{error}</p>
          <p className="text-xs text-text-muted">
            Press <kbd
            className="px-1.5 py-0.5 bg-bg-hover rounded border border-border-secondary text-[10px]">R</kbd>{' '}
            to retry
          </p>
        </div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-16 px-6">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="text-accent"
            >
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <h3 className="text-base font-semibold text-text-primary mb-2">No tasks to display</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto mb-4">
            This could mean your current filters don't match any tasks, or the selected project has no issues with due
            dates.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-text-muted">
            <span>Try:</span>
            <span className="px-2 py-1 bg-bg-hover rounded-md border border-border-primary">Clear filters</span>
            <span className="px-2 py-1 bg-bg-hover rounded-md border border-border-primary">
              Add due dates in Linear
            </span>
            <span className="px-2 py-1 bg-bg-hover rounded-md border border-border-primary">Switch project</span>
          </div>
        </div>
      </div>
    );
  }

  const thBase =
    'py-3.5 text-[11px] font-medium tracking-wide text-text-secondary text-left border-b border-border-primary bg-bg-header sticky top-0 z-5 relative select-none';

  return (
    <div
      ref={ganttRef}
      id="gantt-export-target"
      className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto print:overflow-visible print:border-0"
    >
      <div ref={innerRef} className="relative" style={{minWidth: '100%'}}>
        <table className="border-collapse" style={{width: fixedColsWidth + totalDays * dayWidth}}>
          <thead>
          <tr>
            <th className={`${thBase} px-4`} style={{width: colWidths.task, minWidth: MIN_WIDTHS.task}}>
              Task
              <ResizeHandle onResize={makeResizeHandler('task')}/>
            </th>
            <th className={`${thBase} px-3`} style={{width: colWidths.priority, minWidth: MIN_WIDTHS.priority}}>
              Priority
              <ResizeHandle onResize={makeResizeHandler('priority')}/>
            </th>
            <th className={`${thBase} px-4`} style={{width: colWidths.due, minWidth: MIN_WIDTHS.due}}>
              Due Date
              <ResizeHandle onResize={makeResizeHandler('due')}/>
            </th>
            <th className="p-0 border-b border-border-primary bg-bg-header sticky top-0 z-5">
              <div className="flex border-b border-border-primary">
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary py-2.5 text-center border-r border-border-primary"
                    style={{width: m.days * dayWidth}}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div className="flex relative">
                {daysCells.map((d, i) => (
                  <div
                    key={i}
                    className={`text-[10px] text-center py-1.5 shrink-0 ${
                      d.isToday
                        ? 'text-accent font-bold bg-accent/[0.06]'
                        : d.isWeekend
                          ? 'bg-white/[0.02] text-border-secondary'
                          : 'text-text-muted'
                    }`}
                    style={{
                      width: dayWidth,
                      borderRight: '1px solid rgba(33,38,45,0.5)',
                    }}
                  >
                    <div className="leading-none">{d.date.getDate()}</div>
                    <div
                      className={`text-[8px] leading-none mt-0.5 ${d.isToday ? 'text-accent' : 'text-text-muted/70'}`}
                    >
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.date.getDay()]}
                    </div>
                  </div>
                ))}
                {milestonesInRange.map((m) => (
                  <div
                    key={m.id}
                    className="absolute top-0 z-10 flex flex-col items-center pointer-events-auto"
                    style={{
                      left: m.dayOffset * dayWidth + dayWidth / 2 - 6,
                      top: -2,
                    }}
                    title={`${m.name}${m.targetDate ? ` — ${m.targetDate}` : ''}`}
                  >
                    <div
                      className="w-3 h-3 rotate-45 border-2 border-accent bg-accent/30"
                      style={{boxShadow: '0 0 6px rgba(88,166,255,0.4)'}}
                    />
                  </div>
                ))}
              </div>
            </th>
          </tr>
          </thead>
          <tbody>
          {groups.map((group) => (
            <GroupRows
              key={group.key}
              group={group}
              groupBy={groupBy}
              showHeader={groupBy !== 'none'}
              isCollapsed={collapsed.has(group.key)}
              onToggle={() => toggleCollapse(group.key)}
              chartStart={chartStart}
              totalDays={totalDays}
              today={today}
              dayWidth={dayWidth}
              colWidths={colWidths}
              onReschedule={onReschedule}
              onRescheduleStart={onRescheduleStart}
              onCycleStatus={onCycleStatus}
              onConnectStart={onCreateRelation ? handleConnectStart : undefined}
              isConnecting={isConnecting}
              depViolations={depViolations}
            />
          ))}
          </tbody>
        </table>

        {groupBy === 'none' && (
          <DependencyArrows tasks={tasks} containerRef={innerRef} depViolations={depViolations}/>
        )}

        {/* Connection line overlay — updated imperatively during drag for performance */}
        <svg
          ref={connectionSvgRef}
          className="absolute top-0 left-0 pointer-events-none z-[4]"
          style={{display: 'none', overflow: 'visible'}}
        >
          <defs>
            <marker id="dep-arrow-temp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#58a6ff" opacity="0.9"/>
            </marker>
          </defs>
          <path
            ref={connectionPathRef}
            fill="none"
            stroke="#58a6ff"
            strokeWidth="2"
            strokeDasharray="8 4"
            opacity="0.8"
            markerEnd="url(#dep-arrow-temp)"
          />
        </svg>
      </div>

      {/* Completed tasks section */}
      {doneTasks.length > 0 && (
        <div className="border-t border-border-primary">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
            onClick={() => setDoneVisible((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-muted shrink-0 transition-transform duration-200"
                style={{transform: doneVisible ? 'rotate(90deg)' : 'rotate(0deg)'}}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              <span className="font-medium">Completed</span>
              <span className="text-xs text-text-muted bg-bg-hover rounded-full px-2 py-0.5">{doneTasks.length}</span>
            </div>
            <span className="text-xs text-text-muted">{doneVisible ? 'Hide' : 'Show'}</span>
          </button>

          {doneVisible && (
            <table
              className="border-collapse opacity-60 hover:opacity-100 transition-opacity"
              style={{width: fixedColsWidth + totalDays * dayWidth}}
            >
              <tbody>
              {doneTasks.map((task) => (
                <GanttRow
                  key={task.id}
                  task={task}
                  chartStart={chartStart}
                  totalDays={totalDays}
                  today={today}
                  dayWidth={dayWidth}
                  colWidths={colWidths}
                  isDone
                />
              ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// Sub-component for group rows
function GroupRows({
                     group,
                     groupBy,
                     showHeader,
                     isCollapsed,
                     onToggle,
                     chartStart,
                     totalDays,
                     today,
                     dayWidth,
                     colWidths,
                     onReschedule,
                     onRescheduleStart,
                     onCycleStatus,
                     onConnectStart,
                     isConnecting,
                     depViolations,
                   }: {
  group: { key: string; label: string; tasks: Task[] };
  groupBy: GroupBy;
  showHeader: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  chartStart: Date;
  totalDays: number;
  today: Date;
  dayWidth: number;
  colWidths: ColumnWidths;
  onReschedule?: (taskUuid: string, newDueDate: string) => Promise<void>;
  onRescheduleStart?: (taskUuid: string, newStartDate: string) => Promise<void>;
  onCycleStatus?: (taskUuid: string) => Promise<void>;
  onConnectStart?: (taskId: string, e: React.MouseEvent) => void;
  isConnecting?: boolean;
  depViolations?: Map<string, string[]>;
}) {
  return (
    <>
      {showHeader && (
        <tr className="cursor-pointer hover:bg-accent/[0.04] transition-colors" onClick={onToggle}>
          <td
            colSpan={4}
            className="py-2.5 px-4 border-b border-border-primary bg-bg-header/50 text-xs font-semibold text-text-secondary"
          >
            <div className="flex items-center gap-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-muted shrink-0 transition-transform duration-200"
                style={{transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'}}
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              {groupBy === 'assignee' && <Avatar name={group.label} size="sm"/>}
              {group.label}
              <span className="text-text-muted font-normal">({group.tasks.length})</span>
            </div>
          </td>
        </tr>
      )}
      {!isCollapsed &&
        group.tasks.map((task) => (
          <GanttRow
            key={task.id}
            task={task}
            chartStart={chartStart}
            totalDays={totalDays}
            today={today}
            dayWidth={dayWidth}
            colWidths={colWidths}
            onReschedule={onReschedule}
            onRescheduleStart={onRescheduleStart}
            onCycleStatus={onCycleStatus}
            onConnectStart={onConnectStart}
            isConnecting={isConnecting}
            depViolation={depViolations?.get(task.id)}
          />
        ))}
    </>
  );
}
