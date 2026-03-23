interface Props {
  title: string;
  subtitle: string;
}

export default function Header({ title, subtitle }: Props) {
  return (
    <div className="mb-6">
      <h1 className="text-[28px] font-bold text-text-primary mb-2 tracking-tight">{title}</h1>
      <p className="text-sm text-text-secondary border-l-2 border-accent pl-2.5">{subtitle}</p>
    </div>
  );
}
