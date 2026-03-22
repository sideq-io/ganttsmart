interface Props {
  title: string;
  subtitle: string;
}

export default function Header({ title, subtitle }: Props) {
  return (
    <div className="mb-9">
      <h1 className="text-[28px] font-bold text-white mb-1.5 tracking-tight">{title}</h1>
      <p className="text-sm text-text-secondary">{subtitle}</p>
    </div>
  );
}
