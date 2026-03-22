export interface Task {
  id: string;
  title: string;
  description: string;
  due: string;
  startDate: string | null;
  priorityVal: number;
  priority: string;
  status: string;
  statusType: string;
  assignee: string;
  blocks: string[];
  blockedBy: string[];
  progress: number;       // 0-100, based on sub-issue completion
  totalChildren: number;
  completedChildren: number;
}

export interface Project {
  id: string;
  name: string;
}

export interface Milestone {
  id: string;
  name: string;
  targetDate: string | null;
}

export const PRIORITY_MAP: Record<number, string> = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export const DEFAULT_DAY_WIDTH = 28;
export const MIN_DAY_WIDTH = 14;
export const MAX_DAY_WIDTH = 56;

export interface Filters {
  assignee: string;
  status: string;
  priorities: Set<number>;
  search: string;
}
