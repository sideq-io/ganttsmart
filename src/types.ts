export interface Task {
  id: string;         // display identifier (e.g., "SEED-14")
  uuid: string;       // Linear UUID for mutations
  title: string;
  description: string;
  due: string;
  startDate: string | null;
  priorityVal: number;
  priority: string;
  status: string;
  statusType: string;
  assignee: string;
  url: string;        // direct Linear URL
  teamId: string;     // team UUID for workflow states
  blocks: string[];
  blockedBy: string[];
  progress: number;
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

export interface WorkflowState {
  id: string;
  name: string;
  type: string;  // 'triage' | 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
  position: number;
}

export type GroupBy = 'none' | 'assignee' | 'priority' | 'status';

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
