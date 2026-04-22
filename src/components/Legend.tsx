import { memo } from 'react';

const items = [
  { label: 'Urgent', bg: 'linear-gradient(135deg, #b91c1c, #ef4444)' },
  { label: 'High', bg: 'linear-gradient(135deg, #c2410c, #f97316)' },
  { label: 'Medium', bg: 'linear-gradient(135deg, #b45309, #f59e0b)' },
  { label: 'Low', bg: 'linear-gradient(135deg, #15803d, #22c55e)' },
  { label: 'None', bg: 'linear-gradient(135deg, #52525b, #a1a1aa)' },
];

export default memo(function Legend() {
  return (
    <div className="inline-flex items-center gap-5 mb-8 bg-bg-card/50 border border-border-primary rounded-lg px-4 py-2.5 flex-wrap print:hidden">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-[12px] text-text-secondary font-medium">
          <div className="w-5 h-2 rounded-full" style={{ background: it.bg }} />
          {it.label}
        </div>
      ))}
      <div className="flex items-center gap-2 text-[12px] text-text-secondary font-medium">
        <div
          className="w-5 h-2 rounded-full"
          style={{
            background: 'rgba(124,92,252,0.3)',
            border: '1px dashed #7c5cfc',
          }}
        />
        Today
      </div>
    </div>
  );
});
