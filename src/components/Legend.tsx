const items = [
  { label: 'Urgent', bg: 'linear-gradient(135deg, #da3633, #f85149)' },
  { label: 'High', bg: 'linear-gradient(135deg, #d47519, #ffa657)' },
  { label: 'Medium', bg: 'linear-gradient(135deg, #9e6a03, #d2992a)' },
  { label: 'Low', bg: 'linear-gradient(135deg, #484f58, #8b949e)' },
  { label: 'Done', bg: 'linear-gradient(135deg, #1a7f37, #2ea043)' },
];

export default function Legend() {
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
            background: 'rgba(88,166,255,0.3)',
            border: '1px dashed #58a6ff',
          }}
        />
        Today
      </div>
    </div>
  );
}
