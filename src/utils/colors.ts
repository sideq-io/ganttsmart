export const priorityColors: Record<string, string> = {
  Urgent: '#ef4444',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#22c55e',
  None: '#a1a1aa',
};

export const statusDotColors: Record<string, string> = {
  started: '#7c5cfc',
  unstarted: '#52525b',
  completed: '#22c55e',
  canceled: '#a1a1aa',
  triage: '#f59e0b',
  backlog: '#52525b',
};

export const barGradients: Record<string, string> = {
  urgent: 'linear-gradient(135deg, #b91c1c, #ef4444)',
  high: 'linear-gradient(135deg, #c2410c, #f97316)',
  medium: 'linear-gradient(135deg, #b45309, #f59e0b)',
  low: 'linear-gradient(135deg, #15803d, #22c55e)',
  none: 'linear-gradient(135deg, #52525b, #a1a1aa)',
};

export const barShadows: Record<string, string> = {
  urgent: '0 2px 8px rgba(239,68,68,0.3)',
  high: '0 2px 8px rgba(249,115,22,0.3)',
  medium: '0 2px 8px rgba(245,158,11,0.3)',
  low: '0 2px 8px rgba(34,197,94,0.25)',
  none: '0 2px 8px rgba(82,82,91,0.2)',
};

export const idColors: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#22c55e',
  none: '#a1a1aa',
};

export const priorityBadgeClasses: Record<string, string> = {
  urgent: 'bg-urgent/15 text-urgent border border-urgent/25',
  high: 'bg-high/15 text-high border border-high/25',
  medium: 'bg-medium/15 text-medium border border-medium/25',
  low: 'bg-low/15 text-low border border-low/25',
  none: 'bg-none/15 text-none border border-none/25',
};

export function priorityClass(val: number): string {
  if (val === 1) return 'urgent';
  if (val === 2) return 'high';
  if (val === 3) return 'medium';
  if (val === 4) return 'low';
  return 'none';
}
