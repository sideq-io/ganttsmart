// Curated palette of modern, saturated colors that work on both dark and light backgrounds
const AVATAR_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#a855f7', // purple
  '#e11d48', // crimson
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getAvatarProps(name: string): { initials: string; bgColor: string } {
  const trimmed = name.trim();
  if (!trimmed || trimmed === 'Unassigned') {
    return { initials: '?', bgColor: '#6e7781' };
  }

  const parts = trimmed.split(/\s+/);
  let initials: string;
  if (parts.length >= 2) {
    initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  } else {
    initials = trimmed.slice(0, 2).toUpperCase();
  }

  const bgColor = AVATAR_COLORS[hashString(trimmed) % AVATAR_COLORS.length];

  return { initials, bgColor };
}

const SIZES = {
  sm: { container: 20, font: 9 },
  md: { container: 24, font: 10 },
  lg: { container: 32, font: 12 },
} as const;

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const { initials, bgColor } = getAvatarProps(name);
  const s = SIZES[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full shrink-0 font-semibold text-white select-none ${className}`}
      style={{
        width: s.container,
        height: s.container,
        fontSize: s.font,
        backgroundColor: bgColor,
        lineHeight: 1,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}
