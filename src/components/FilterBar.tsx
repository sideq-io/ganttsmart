import type { Filters, Project } from '../types';

interface Props {
  projects: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  assignees: string[];
  statuses: string[];
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  totalCount: number;
  filteredCount: number;
}

const PRIORITY_CHIPS = [
  { val: 1, label: 'Urgent', cls: 'urgent' },
  { val: 2, label: 'High', cls: 'high' },
  { val: 3, label: 'Medium', cls: 'medium' },
  { val: 4, label: 'Low', cls: 'low' },
  { val: 0, label: 'None', cls: 'none' },
];

const chipActiveColors: Record<string, string> = {
  urgent: 'border-urgent text-urgent bg-urgent/10',
  high: 'border-high text-high bg-high/10',
  medium: 'border-medium text-medium bg-medium/10',
  low: 'border-low text-low bg-low/15',
  none: 'border-accent text-accent bg-accent/10',
};

const selectClass =
  'py-[7px] pl-3 pr-7 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-medium cursor-pointer outline-none transition-colors hover:border-text-muted focus:border-accent appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:10px_6px]';

const selectBgImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b949e' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`;

export default function FilterBar({
  projects,
  selectedProjectId,
  onSelectProject,
  assignees,
  statuses,
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: Props) {
  const togglePriority = (val: number) => {
    const next = new Set(filters.priorities);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onFiltersChange({ ...filters, priorities: next });
  };

  const isFiltered =
    filters.assignee || filters.status || filters.search || filters.priorities.size < 5;

  return (
    <div className="flex items-center gap-2.5 mb-6 flex-wrap">
      {/* Project */}
      <span className="text-[11px] text-text-muted uppercase tracking-wider mr-0.5">Project</span>
      <select
        value={selectedProjectId}
        onChange={(e) => onSelectProject(e.target.value)}
        className={selectClass}
        style={{ backgroundImage: selectBgImage }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="w-px h-6 bg-border-primary mx-1" />

      {/* Assignee */}
      <span className="text-[11px] text-text-muted uppercase tracking-wider mr-0.5">Assignee</span>
      <select
        value={filters.assignee}
        onChange={(e) => onFiltersChange({ ...filters, assignee: e.target.value })}
        className={selectClass}
        style={{ backgroundImage: selectBgImage }}
      >
        <option value="">All Assignees</option>
        {assignees.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {/* Status */}
      <span className="text-[11px] text-text-muted uppercase tracking-wider mr-0.5">Status</span>
      <select
        value={filters.status}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
        className={selectClass}
        style={{ backgroundImage: selectBgImage }}
      >
        <option value="">All Statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div className="w-px h-6 bg-border-primary mx-1" />

      {/* Priority chips */}
      <span className="text-[11px] text-text-muted uppercase tracking-wider mr-0.5">Priority</span>
      <div className="flex gap-1.5 flex-wrap items-center">
        {PRIORITY_CHIPS.map((c) => {
          const active = filters.priorities.has(c.val);
          return (
            <button
              key={c.val}
              onClick={() => togglePriority(c.val)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all border select-none ${
                active
                  ? chipActiveColors[c.cls]
                  : 'bg-bg-hover border-border-secondary text-text-secondary hover:bg-border-secondary hover:text-text-primary'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="w-px h-6 bg-border-primary mx-1" />

      {/* Search */}
      <div className="relative flex items-center">
        <span className="absolute left-2.5 text-text-muted pointer-events-none text-[13px]">
          &#128269;
        </span>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search tasks..."
          className="py-[7px] pl-8 pr-3 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-normal outline-none transition-colors w-[220px] hover:border-text-muted focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {isFiltered && (
        <span className="text-[11px] text-text-muted ml-auto">
          {filteredCount} of {totalCount} tasks
        </span>
      )}
    </div>
  );
}
