import { PRIORITY_MAP, type Milestone, type Project, type Task, type WorkflowState } from '../types';

const LINEAR_API = 'https://api.linear.app/graphql';

// ---- Rate limiter: debounce + queue ----
let pendingRequests = 0;
const MAX_CONCURRENT = 4;
const requestQueue: Array<() => void> = [];

function waitForSlot(): Promise<void> {
  if (pendingRequests < MAX_CONCURRENT) {
    pendingRequests++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestQueue.push(() => {
      pendingRequests++;
      resolve();
    });
  });
}

function releaseSlot() {
  pendingRequests--;
  const next = requestQueue.shift();
  if (next) next();
}

// ---- Core GraphQL with retry + rate limit awareness ----
async function gql(apiKey: string, query: string, retries = 2): Promise<Record<string, unknown>> {
  await waitForSlot();
  try {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      body: JSON.stringify({ query }),
    });

    // Rate limited — retry after delay
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '2', 10);
      if (retries > 0) {
        releaseSlot();
        await delay(retryAfter * 1000);
        return gql(apiKey, query, retries - 1);
      }
      throw new Error('Rate limited by Linear API. Please wait a moment and try again.');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      if (res.status === 401) throw new Error('Linear authentication expired. Please reconnect.');
      if (res.status >= 500 && retries > 0) {
        releaseSlot();
        await delay(1000);
        return gql(apiKey, query, retries - 1);
      }
      throw new Error(`Linear API error (${res.status}): ${text || res.statusText}`);
    }

    const data = await res.json();
    if (data.errors) {
      const msg = data.errors[0]?.message || 'Unknown GraphQL error';
      // Retry on transient errors
      if (retries > 0 && (msg.includes('timeout') || msg.includes('unavailable'))) {
        releaseSlot();
        await delay(1000);
        return gql(apiKey, query, retries - 1);
      }
      throw new Error(msg);
    }
    return data.data as Record<string, unknown>;
  } catch (e) {
    // Network errors — retry once
    if (retries > 0 && (e as Error).message?.includes('fetch')) {
      releaseSlot();
      await delay(1000);
      return gql(apiKey, query, retries - 1);
    }
    throw e;
  } finally {
    releaseSlot();
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Debounce helper for drag operations ----
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function debouncedApiCall<T>(key: string, fn: () => Promise<T>, delayMs = 300): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    debounceTimers.set(
      key,
      setTimeout(async () => {
        debounceTimers.delete(key);
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      }, delayMs),
    );
  });
}

// ---- API functions ----

export async function testAuth(apiKey: string): Promise<{ id: string; name: string }> {
  const data = await gql(apiKey, '{ viewer { id name } }');
  const viewer = data?.viewer as { id: string; name: string } | undefined;
  if (!viewer) throw new Error('Invalid API key');
  return viewer;
}

export async function fetchProjects(apiKey: string): Promise<Project[]> {
  const data = await gql(
    apiKey,
    `query {
      projects(first: 100) {
        nodes { id name }
      }
    }`,
  );
  const projects = data.projects as { nodes: Project[] };
  return projects.nodes.sort((a, b) => a.name.localeCompare(b.name));
}

/** Parse `start: DD-MM-YY` from issue description */
function parseStartDate(description: string): string | null {
  const match = description.match(/start:\s*(\d{2})-(\d{2})-(\d{2})/i);
  if (!match) return null;
  const [, dd, mm, yy] = match;
  const year = 2000 + parseInt(yy);
  const month = parseInt(mm);
  const day = parseInt(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function fetchIssues(
  apiKey: string,
  projectId: string,
): Promise<{ projectName: string; tasks: Task[]; doneTasks: Task[]; milestones: Milestone[] }> {
  const data = await gql(
    apiKey,
    `query {
      project(id: "${projectId}") {
        name
        projectMilestones {
          nodes {
            id
            name
            targetDate
          }
        }
        issues(first: 250, filter: { completedAt: { null: true } }) {
          nodes {
            id
            identifier
            title
            description
            dueDate
            url
            priority
            state { name type }
            createdAt
            completedAt
            assignee { name }
            team { id }
          }
        }
        doneIssues: issues(first: 100, filter: { completedAt: { null: false } }) {
          nodes {
            id
            identifier
            title
            description
            dueDate
            url
            priority
            state { name type }
            createdAt
            completedAt
            assignee { name }
            team { id }
          }
        }
      }
    }`,
  );

  interface IssueNode {
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    url: string;
    priority: number;
    state: { name: string; type: string } | null;
    createdAt: string;
    completedAt: string | null;
    assignee: { name: string } | null;
    team: { id: string } | null;
  }

  const project = data.project as {
    name: string;
    projectMilestones: { nodes: Array<{ id: string; name: string; targetDate: string | null }> };
    issues: { nodes: IssueNode[] };
    doneIssues: { nodes: IssueNode[] };
  };

  if (!project) throw new Error('Project not found');

  const issueNodes = project.issues.nodes;
  const doneIssueNodes = project.doneIssues?.nodes || [];

  // Query 2: fetch relations and children using issue UUIDs
  const issueIds = issueNodes.filter((n) => n.dueDate).map((n) => n.id);

  const relationsMap: Record<string, { blocks: string[]; blockedBy: string[] }> = {};
  const childrenMap: Record<string, { total: number; completed: number }> = {};

  if (issueIds.length > 0) {
    try {
      const detailData = await gql(
        apiKey,
        `query {
          issues(filter: { id: { in: [${issueIds.map((id) => `"${id}"`).join(',')}] } }) {
            nodes {
              id
              identifier
              relations {
                nodes {
                  type
                  relatedIssue { identifier }
                }
              }
              children {
                nodes {
                  id
                  completedAt
                }
              }
            }
          }
        }`,
      );

      interface RelNode {
        type: string;
        relatedIssue: { identifier: string };
      }
      interface ChildNode {
        id: string;
        completedAt: string | null;
      }

      const issues = detailData.issues as {
        nodes: Array<{
          id: string;
          identifier: string;
          relations?: { nodes: RelNode[] };
          children?: { nodes: ChildNode[] };
        }>;
      };

      for (const node of issues.nodes) {
        const identifier = node.identifier;
        const relations = node.relations?.nodes || [];
        const blocks: string[] = [];
        const blockedBy: string[] = [];
        for (const rel of relations) {
          if (rel.type === 'blocks') blocks.push(rel.relatedIssue.identifier);
          else if (rel.type === 'blocked_by') blockedBy.push(rel.relatedIssue.identifier);
        }
        relationsMap[identifier] = { blocks, blockedBy };

        const children = node.children?.nodes || [];
        childrenMap[identifier] = {
          total: children.length,
          completed: children.filter((c) => c.completedAt !== null).length,
        };
      }
    } catch {
      console.warn('Failed to fetch relations/children — continuing without them');
    }
  }

  function mapNode(n: IssueNode): Task {
    const rel = relationsMap[n.identifier] || { blocks: [], blockedBy: [] };
    const ch = childrenMap[n.identifier] || { total: 0, completed: 0 };
    const progress = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;

    return {
      id: n.identifier,
      uuid: n.id,
      title: n.title,
      description: n.description || '',
      due: n.dueDate!,
      startDate: parseStartDate(n.description || ''),
      url: n.url,
      priorityVal: n.priority,
      priority: PRIORITY_MAP[n.priority] || 'None',
      status: n.state?.name || '',
      statusType: n.state?.type || '',
      assignee: n.assignee?.name || 'Unassigned',
      teamId: n.team?.id || '',
      blocks: rel.blocks,
      blockedBy: rel.blockedBy,
      progress,
      totalChildren: ch.total,
      completedChildren: ch.completed,
      completedAt: n.completedAt || undefined,
    };
  }

  const tasks: Task[] = issueNodes
    .filter((n) => n.dueDate)
    .map(mapNode)
    .sort((a, b) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime());

  const doneTasks: Task[] = doneIssueNodes
    .filter((n) => n.dueDate)
    .map(mapNode)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime; // newest completed first
    });

  const milestones: Milestone[] = (project.projectMilestones?.nodes || []).map((m) => ({
    id: m.id,
    name: m.name,
    targetDate: m.targetDate,
  }));

  return { projectName: project.name, tasks, doneTasks, milestones };
}

// ---- Mutations (with debouncing for drag operations) ----

export async function updateIssueDueDate(apiKey: string, issueId: string, dueDate: string): Promise<void> {
  await debouncedApiCall(`due-${issueId}`, () =>
    gql(
      apiKey,
      `mutation {
        issueUpdate(id: "${issueId}", input: { dueDate: "${dueDate}" }) {
          success
        }
      }`,
    ),
  );
}

export async function updateIssueStartDate(apiKey: string, issueId: string, startDate: string): Promise<void> {
  await debouncedApiCall(`start-${issueId}`, async () => {
    // Fetch current description
    const data = await gql(apiKey, `query { issue(id: "${issueId}") { description } }`);
    const issue = data.issue as { description: string | null };
    const currentDesc: string = issue?.description || '';

    // Format the new start tag: start: DD-MM-YY
    const d = new Date(startDate + 'T00:00:00');
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const newTag = `start: ${dd}-${mm}-${yy}`;

    let newDesc: string;
    if (/start:\s*\d{2}-\d{2}-\d{2}/i.test(currentDesc)) {
      newDesc = currentDesc.replace(/start:\s*\d{2}-\d{2}-\d{2}/i, newTag);
    } else {
      newDesc = currentDesc.trim() ? `${currentDesc.trim()}\n${newTag}` : newTag;
    }

    const escaped = newDesc.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

    await gql(
      apiKey,
      `mutation {
        issueUpdate(id: "${issueId}", input: { description: "${escaped}" }) {
          success
        }
      }`,
    );
  });
}

export async function updateIssueState(apiKey: string, issueId: string, stateId: string): Promise<void> {
  await gql(
    apiKey,
    `mutation {
      issueUpdate(id: "${issueId}", input: { stateId: "${stateId}" }) {
        success
      }
    }`,
  );
}

export async function fetchWorkflowStates(apiKey: string, teamId: string): Promise<WorkflowState[]> {
  const data = await gql(
    apiKey,
    `query {
      workflowStates(filter: { team: { id: { eq: "${teamId}" } } }) {
        nodes {
          id
          name
          type
          position
        }
      }
    }`,
  );
  const states = data.workflowStates as { nodes: WorkflowState[] };
  return states.nodes.sort((a, b) => a.position - b.position);
}
