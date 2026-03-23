import type { Task } from '@/types';

interface Props {
  tasks: Task[];
  chartStart: Date;
  today: Date;
  dayWidth: number;
  totalDays: number;
  fixedColsWidth: number;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const ROW_HEIGHT = 58; // approximate row height in pixels
const HEADER_HEIGHT = 76; // approximate header height

export default function DependencyArrows({ tasks, chartStart, today, dayWidth, totalDays, fixedColsWidth }: Props) {
  // Build task index map for fast lookup
  const taskIndex = new Map<string, number>();
  tasks.forEach((t, i) => taskIndex.set(t.id, i));

  // Collect all arrows: from blocker's bar end → blocked task's bar start
  const arrows: { fromX: number; fromY: number; toX: number; toY: number }[] = [];

  tasks.forEach((task) => {
    const blockerIdx = taskIndex.get(task.id);
    if (blockerIdx === undefined) return;

    for (const blockedId of task.blocks) {
      const blockedIdx = taskIndex.get(blockedId);
      if (blockedIdx === undefined) continue;

      const blockedTask = tasks[blockedIdx];

      // Calculate bar end X of blocker
      const blockerDue = new Date(task.due + 'T00:00:00');
      const blockerEndDay = daysBetween(chartStart, blockerDue);
      const fromX = fixedColsWidth + blockerEndDay * dayWidth;

      // Calculate bar start X of blocked
      let toX: number;
      if (blockedTask.startDate) {
        const startDay = daysBetween(chartStart, new Date(blockedTask.startDate + 'T00:00:00'));
        toX = fixedColsWidth + startDay * dayWidth;
      } else {
        const todayDay = daysBetween(chartStart, today);
        toX = fixedColsWidth + todayDay * dayWidth;
      }

      const fromY = HEADER_HEIGHT + blockerIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toY = HEADER_HEIGHT + blockedIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      arrows.push({ fromX, fromY, toX, toY });
    }
  });

  if (arrows.length === 0) return null;

  const svgWidth = fixedColsWidth + totalDays * dayWidth;
  const svgHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none z-[3]"
      width={svgWidth}
      height={svgHeight}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#f85149" opacity="0.7" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        // Draw a curved path
        const dx = Math.abs(a.toX - a.fromX);
        const controlOffset = Math.max(dx * 0.3, 20);

        const path = `M ${a.fromX} ${a.fromY} C ${a.fromX + controlOffset} ${a.fromY}, ${a.toX - controlOffset} ${a.toY}, ${a.toX} ${a.toY}`;
        // If same row or close, use simpler path
        const simplePath = Math.abs(a.fromY - a.toY) < 5;

        return (
          <path
            key={i}
            d={simplePath ? `M ${a.fromX} ${a.fromY} L ${a.toX} ${a.toY}` : path}
            fill="none"
            stroke="#f85149"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            opacity="0.5"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}
