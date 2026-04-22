import type { Task } from '@/types';

interface Props {
  tasks: Task[];
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function computeSpan(tasks: Task[]): number {
  const dates: number[] = [];
  for (const t of tasks) {
    if (t.startDate) {
      const d = new Date(t.startDate + 'T00:00:00').getTime();
      if (!Number.isNaN(d)) dates.push(d);
    }
    if (t.due) {
      const d = new Date(t.due + 'T00:00:00').getTime();
      if (!Number.isNaN(d)) dates.push(d);
    }
  }
  if (dates.length < 2) return 0;
  return Math.max(0, Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000));
}

export default function StatsRow({ tasks }: Props) {
  if (!tasks.length) return null;

  const active = tasks.filter((t) => t.statusType !== 'completed' && t.statusType !== 'canceled').length;
  const inProgress = tasks.filter((t) => t.statusType === 'started').length;
  const completed = tasks.filter((t) => t.statusType === 'completed').length;
  const span = computeSpan(tasks);

  const cards = [
    {
      label: 'Active',
      value: active,
      color: 'var(--color-accent)',
      Icon: FlagIcon,
    },
    {
      label: 'In Progress',
      value: inProgress,
      color: 'var(--color-medium)',
      Icon: PlayIcon,
    },
    {
      label: 'Completed',
      value: completed,
      color: 'var(--color-low)',
      Icon: CheckIcon,
    },
    {
      label: 'Total Span',
      value: `${span}d`,
      color: 'var(--color-accent-light)',
      Icon: CalendarIcon,
    },
  ];

  return (
    <div className="shrink-0 border-b border-border-primary bg-bg-primary print:hidden">
      <div className="flex items-stretch gap-0 px-4 py-2 overflow-x-auto">
        {cards.map((c, i) => {
          const Icon = c.Icon;
          return (
            <div
              key={c.label}
              className={`flex items-center gap-3 px-4 py-1.5 shrink-0 ${i > 0 ? 'border-l border-border-primary' : ''}`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color }}
              >
                <Icon />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-semibold text-text-primary tabular-nums">{c.value}</span>
                <span className="text-[10.5px] uppercase tracking-wider text-text-muted font-medium">
                  {c.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
