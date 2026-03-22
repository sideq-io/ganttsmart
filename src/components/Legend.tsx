const items = [
  { label: 'Urgent', bg: 'linear-gradient(135deg, #da3633, #f85149)' },
  { label: 'High', bg: 'linear-gradient(135deg, #d47519, #ffa657)' },
  { label: 'Medium', bg: 'linear-gradient(135deg, #9e6a03, #d2992a)' },
  { label: 'Low', bg: 'linear-gradient(135deg, #484f58, #8b949e)' },
];

export default function Legend() {
  return (
    <div className="flex gap-6 mb-8 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2 text-[13px] text-text-secondary">
          <div className="w-3 h-3 rounded-[3px]" style={{ background: it.bg }} />
          {it.label}
        </div>
      ))}
      <div className="flex items-center gap-2 text-[13px] text-text-secondary">
        <div
          className="w-3 h-3 rounded-[3px]"
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
