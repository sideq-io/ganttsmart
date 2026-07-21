export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Monday of the week containing the given date (local midnight preserved). */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export interface TimeCell {
  start: Date;
  days: number;
}

/**
 * Split the chart range into timeline cells for the given scale.
 * Day: one cell per day. Week: cells break on Mondays. Month: cells break on the 1st.
 * The first and last cells are clamped to the chart range, so widths always sum to totalDays.
 */
export function buildTimeCells(chartStart: Date, totalDays: number, scale: 'day' | 'week' | 'month'): TimeCell[] {
  const cells: TimeCell[] = [];
  if (scale === 'day') {
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(chartStart);
      d.setDate(d.getDate() + i);
      cells.push({ start: d, days: 1 });
    }
    return cells;
  }

  let cursor = new Date(chartStart);
  let remaining = totalDays;
  while (remaining > 0) {
    let next: Date;
    if (scale === 'week') {
      next = startOfWeek(cursor);
      next.setDate(next.getDate() + 7);
    } else {
      next = new Date(cursor);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
    }
    const days = Math.min(daysBetween(cursor, next), remaining);
    cells.push({ start: cursor, days });
    cursor = next;
    remaining -= days;
  }
  return cells;
}
