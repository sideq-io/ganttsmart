import type { Milestone, Task } from '../types';
import DependencyArrows from './DependencyArrows';
import GanttRow from './GanttRow';

interface Props {
  tasks: Task[];
  milestones: Milestone[];
  loading: boolean;
  error: string;
  dayWidth: number;
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function GanttChart({ tasks, milestones, loading, error, dayWidth }: Props) {
  if (loading) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-20 text-text-secondary">
          <div className="w-10 h-10 mx-auto mb-4 border-3 border-border-primary border-t-accent rounded-full animate-spin" />
          <div>Fetching issues from Linear...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-20 text-text-muted">
          <h3 className="text-base text-text-secondary mb-2">Error fetching data</h3>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
        <div className="text-center py-12 text-text-muted">
          <h3 className="text-sm text-text-secondary mb-1.5">No matching tasks</h3>
          <p className="text-xs">Try adjusting your filters or search query.</p>
        </div>
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect all relevant dates for chart range
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
  const totalDays = daysBetween(chartStart, chartEnd);

  // Calendar header
  const months: { label: string; days: number }[] = [];
  const daysCells: { date: Date; isWeekend: boolean; isToday: boolean }[] = [];

  let currentMonth = '';
  let currentMonthCount = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(chartStart);
    d.setDate(d.getDate() + i);
    const mk = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    if (mk !== currentMonth) {
      if (currentMonth) months.push({ label: currentMonth, days: currentMonthCount });
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
  if (currentMonth) months.push({ label: currentMonth, days: currentMonthCount });

  // Milestone positions
  const milestonesInRange = milestones
    .filter((m) => m.targetDate)
    .map((m) => {
      const mDate = new Date(m.targetDate! + 'T00:00:00');
      const dayOffset = daysBetween(chartStart, mDate);
      return { ...m, dayOffset };
    })
    .filter((m) => m.dayOffset >= 0 && m.dayOffset <= totalDays);

  // Fixed column widths
  const fixedColsWidth = 320 + 100 + 110; // task + priority + due date

  return (
    <div className="bg-bg-card rounded-xl border border-border-primary overflow-x-auto">
      <div className="relative">
        <table className="w-max border-collapse">
          <thead>
            <tr>
              <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-primary bg-bg-header sticky top-0 z-5 w-[320px] min-w-[320px]">
                Task
              </th>
              <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-primary bg-bg-header sticky top-0 z-5 w-[100px] min-w-[100px]">
                Priority
              </th>
              <th className="py-3.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-text-secondary text-left border-b border-border-primary bg-bg-header sticky top-0 z-5 w-[110px] min-w-[110px]">
                Due Date
              </th>
              <th className="p-0 border-b border-border-primary bg-bg-header sticky top-0 z-5">
                {/* Month row */}
                <div className="flex border-b border-border-primary">
                  {months.map((m, i) => (
                    <div
                      key={i}
                      className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary py-2.5 text-center border-r border-border-primary"
                      style={{ width: m.days * dayWidth }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Days row with milestones */}
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
                      {d.date.getDate()}
                    </div>
                  ))}
                  {/* Milestone diamonds */}
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
                        style={{ boxShadow: '0 0 6px rgba(88,166,255,0.4)' }}
                      />
                    </div>
                  ))}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <GanttRow
                key={task.id}
                task={task}
                chartStart={chartStart}
                totalDays={totalDays}
                today={today}
                dayWidth={dayWidth}
              />
            ))}
          </tbody>
        </table>

        {/* Dependency arrows overlay */}
        <DependencyArrows
          tasks={tasks}
          chartStart={chartStart}
          today={today}
          dayWidth={dayWidth}
          totalDays={totalDays}
          fixedColsWidth={fixedColsWidth}
        />
      </div>
    </div>
  );
}
