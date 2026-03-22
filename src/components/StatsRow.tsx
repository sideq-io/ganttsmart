import type { Task } from '../types';

interface Props {
  tasks: Task[];
}

export default function StatsRow({ tasks }: Props) {
  if (!tasks.length) return null;

  const counts: Record<number, number> = {};
  tasks.forEach((t) => {
    counts[t.priorityVal] = (counts[t.priorityVal] || 0) + 1;
  });

  const dues = tasks.map((t) => new Date(t.due + 'T00:00:00').getTime());
  const spanDays = Math.round((Math.max(...dues) - Math.min(...dues)) / 86400000);

  const cards: { label: string; value: number | string; colorClass: string }[] = [];
  if (counts[1]) cards.push({ label: 'Urgent', value: counts[1], colorClass: 'text-urgent' });
  if (counts[2]) cards.push({ label: 'High', value: counts[2], colorClass: 'text-high' });
  if (counts[3]) cards.push({ label: 'Medium', value: counts[3], colorClass: 'text-medium' });
  if (counts[4]) cards.push({ label: 'Low', value: counts[4], colorClass: 'text-low' });
  cards.push({ label: 'Total Span', value: `${spanDays} days`, colorClass: 'text-white' });

  return (
    <div className="flex gap-4 mb-8 flex-wrap">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-bg-card border border-border-primary rounded-[10px] py-4.5 px-6 min-w-[150px] flex-1"
        >
          <div className={`text-2xl font-bold mb-1 ${c.colorClass}`}>{c.value}</div>
          <div className="text-xs text-text-secondary uppercase tracking-wider">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
