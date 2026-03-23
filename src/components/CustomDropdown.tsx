import { useEffect, useRef, useState } from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface Props {
  value: string;
  options: DropdownOption[];
  placeholder: string;
  placeholderIcon?: React.ReactNode;
  onChange: (value: string) => void;
  className?: string;
  /** When true, hides the "All" clear option — the dropdown always requires a selection */
  required?: boolean;
}

const selectBgImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b949e' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`;

export default function CustomDropdown({ value, options, placeholder, placeholderIcon, onChange, className = '', required = false }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-[7px] pl-2.5 pr-7 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-medium cursor-pointer outline-none transition-colors hover:border-text-muted focus:border-accent max-w-[200px] bg-no-repeat bg-[right_10px_center] bg-[length:10px_6px] w-full"
        style={{ backgroundImage: selectBgImage }}
      >
        {selected ? (
          <>
            {selected.icon}
            <span className="truncate">{selected.label}</span>
          </>
        ) : (
          <>
            {placeholderIcon}
            <span className="text-text-secondary truncate">{placeholder}</span>
          </>
        )}
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-bg-card border border-border-secondary rounded-lg shadow-xl z-50 min-w-[200px] max-h-[280px] overflow-y-auto py-1">
          {/* "All" option — hidden when required */}
          {!required && (
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                !value ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              {placeholderIcon}
              {placeholder}
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left cursor-pointer transition-colors ${
                value === opt.value ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
