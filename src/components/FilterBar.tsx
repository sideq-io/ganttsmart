import { useMemo } from 'react';
import type { Filters, GroupBy, Project } from '@/types';
import { Avatar } from '@/utils/avatar';
import CustomDropdown from './CustomDropdown';
import type { DropdownOption } from './CustomDropdown';

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
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  hideProjectSelector?: boolean;
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

const labelClass = 'text-[11.5px] text-text-secondary font-medium mr-0.5 shrink-0';

// Icons
function SearchIcon() {
  return (
    <svg
      className="absolute left-2.5 text-text-muted pointer-events-none"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted shrink-0"
    >
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted shrink-0"
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

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
  groupBy,
  onGroupByChange,
  hideProjectSelector,
}: Props) {
  const togglePriority = (val: number) => {
    const next = new Set(filters.priorities);
    if (next.has(val)) next.delete(val);
    else next.add(val);
    onFiltersChange({ ...filters, priorities: next });
  };

  const isFiltered = filters.assignee || filters.status || filters.search || filters.priorities.size < 5;

  // Build dropdown options
  const projectOptions: DropdownOption[] = useMemo(
    () => projects.map((p) => ({ value: p.id, label: p.name, icon: <FolderIcon /> })),
    [projects],
  );

  const assigneeOptions: DropdownOption[] = useMemo(
    () => assignees.map((a) => ({ value: a, label: a, icon: <Avatar name={a} size="sm" /> })),
    [assignees],
  );

  const statusOptions: DropdownOption[] = useMemo(
    () => statuses.map((s) => ({ value: s, label: s, icon: <StatusIcon /> })),
    [statuses],
  );

  const selectClass =
    'py-[7px] pl-3 pr-7 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-medium cursor-pointer outline-none transition-colors hover:border-text-muted focus:border-accent appearance-none bg-no-repeat bg-[right_10px_center] bg-[length:10px_6px] max-w-[180px]';
  const selectBgImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238b949e' d='M1 1l4 4 4-4'/%3E%3C/svg%3E")`;

  return (
    <div className="flex items-center gap-2.5 mb-6 flex-wrap print:hidden">
      {/* Project */}
      {!hideProjectSelector && (
        <>
          <span className={labelClass}>Project</span>
          <CustomDropdown
            value={selectedProjectId}
            options={projectOptions}
            placeholder="All Projects"
            placeholderIcon={<FolderIcon />}
            onChange={(v) => onSelectProject(v)}
            required
          />
          <div className="w-px h-5 bg-border-secondary/50 mx-1 hidden sm:block" />
        </>
      )}

      {/* Assignee */}
      <span className={`${labelClass} hidden sm:inline`}>Assignee</span>
      <CustomDropdown
        value={filters.assignee}
        options={assigneeOptions}
        placeholder="All Assignees"
        placeholderIcon={<UsersIcon />}
        onChange={(v) => onFiltersChange({ ...filters, assignee: v })}
      />

      {/* Status */}
      <span className={`${labelClass} hidden sm:inline`}>Status</span>
      <CustomDropdown
        value={filters.status}
        options={statusOptions}
        placeholder="All Statuses"
        placeholderIcon={<StatusIcon />}
        onChange={(v) => onFiltersChange({ ...filters, status: v })}
      />

      <div className="w-px h-5 bg-border-secondary/50 mx-1 hidden md:block" />

      {/* Priority chips */}
      <span className={`${labelClass} hidden md:inline`}>Priority</span>
      <div className="flex gap-1.5 flex-wrap items-center">
        {PRIORITY_CHIPS.map((c) => {
          const active = filters.priorities.has(c.val);
          return (
            <button
              key={c.val}
              onClick={() => togglePriority(c.val)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-all border select-none active:scale-95 ${
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

      <div className="w-px h-5 bg-border-secondary/50 mx-1 hidden lg:block" />

      {/* Group by */}
      <span className={`${labelClass} hidden lg:inline`}>Group</span>
      <select
        value={groupBy}
        onChange={(e) => onGroupByChange(e.target.value as GroupBy)}
        className={selectClass}
        style={{ backgroundImage: selectBgImage }}
      >
        <option value="none">None</option>
        <option value="assignee">Assignee</option>
        <option value="priority">Priority</option>
        <option value="status">Status</option>
      </select>

      <div className="w-px h-5 bg-border-secondary/50 mx-1 hidden lg:block" />

      {/* Search */}
      <div className="relative flex items-center w-full sm:w-auto">
        <SearchIcon />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="Search tasks..."
          className="py-[7px] pl-8 pr-3 bg-bg-card border border-border-secondary rounded-md text-text-primary text-xs font-normal outline-none transition-colors w-full sm:w-[200px] hover:border-text-muted focus:border-accent placeholder:text-text-muted"
        />
      </div>

      {isFiltered && (
        <span className="bg-accent/10 text-accent text-[11px] font-medium px-2.5 py-0.5 rounded-full ml-auto">
          {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
