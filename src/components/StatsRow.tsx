import React from 'react';
import type { Task } from '@/types';

interface Props {
  tasks: Task[];
}

const priorityColors: Record<string, string> = {
  Urgent: '#f85149',
  High: '#ffa657',
  Medium: '#d2992a',
  Low: '#8b949e',
};

// Small SVG icons for each stat
function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <path d="M12 23c-3.866 0-7-3.134-7-7 0-3.162 2.255-5.87 3.5-7.5.386-.505 1.114-.505 1.5 0 .57.746 1.199 1.67 1.5 2.5.076-.74.5-2.5 2-4.5.386-.514 1.114-.514 1.5 0C16.745 9.13 19 11.838 19 16c0 3.866-3.134 7-7 7z" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="3" y="12" width="4" height="9" rx="1" />
      <rect x="10" y="7" width="4" height="14" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

const iconMap: Record<string, () => React.JSX.Element> = {
  Urgent: FlameIcon,
  High: ArrowUpIcon,
  Medium: BarChartIcon,
  Low: ArrowDownIcon,
  'Total Span': CalendarIcon,
};

export default function StatsRow({ tasks }: Props) {
  if (!tasks.length) return null;

  const counts: Record<number, number> = {};
  tasks.forEach((t) => {
    counts[t.priorityVal] = (counts[t.priorityVal] || 0) + 1;
  });

  const dues = tasks.map((t) => new Date(t.due + 'T00:00:00').getTime());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const spanDays = Math.max(0, Math.round((Math.max(...dues) - today.getTime()) / 86400000));

  const cards: { label: string; value: number | string; color: string }[] = [];
  if (counts[1]) cards.push({ label: 'Urgent', value: counts[1], color: priorityColors.Urgent });
  if (counts[2]) cards.push({ label: 'High', value: counts[2], color: priorityColors.High });
  if (counts[3]) cards.push({ label: 'Medium', value: counts[3], color: priorityColors.Medium });
  if (counts[4]) cards.push({ label: 'Low', value: counts[4], color: priorityColors.Low });
  cards.push({ label: 'Total Span', value: `${spanDays} days`, color: '#58a6ff' });

  return (
    <div className="flex gap-4 mb-8 flex-wrap print:hidden">
      {cards.map((c) => {
        const Icon = iconMap[c.label];
        return (
          <div
            key={c.label}
            className="bg-bg-card border border-border-primary rounded-xl py-4.5 px-6 min-w-[150px] flex-1 transition-all duration-200 hover:border-border-secondary"
            style={{ borderTopColor: c.color, borderTopWidth: 2 }}
          >
            <div className="flex items-center gap-2 mb-1">
              {Icon && (
                <span style={{ color: c.color }}>
                  <Icon />
                </span>
              )}
              <span className="text-2xl font-extrabold tabular-nums" style={{ color: c.color }}>
                {c.value}
              </span>
            </div>
            <div className="text-xs text-text-secondary font-medium tracking-wide">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}
