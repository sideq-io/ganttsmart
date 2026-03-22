import { PRIORITY_MAP, type Milestone, type Project, type Task } from '../types';

const LINEAR_API = 'https://api.linear.app/graphql';

async function gql(apiKey: string, query: string) {
  const res = await fetch(LINEAR_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: apiKey },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.errors) throw new Error(data.errors[0].message);
  return data.data;
}

export async function testAuth(apiKey: string): Promise<{ id: string; name: string }> {
  const data = await gql(apiKey, '{ viewer { id name } }');
  if (!data?.viewer) throw new Error('Invalid API key');
  return data.viewer;
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
  return (data.projects.nodes as Project[]).sort((a, b) => a.name.localeCompare(b.name));
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
): Promise<{ projectName: string; tasks: Task[]; milestones: Milestone[] }> {
  // Query 1: project info and milestones
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
            priority
            state { name type }
            createdAt
            assignee { name }
          }
        }
      }
    }`,
  );

  if (!data.project) throw new Error('Project not found');

  const issueNodes = data.project.issues.nodes as Array<{
    id: string;
    identifier: string;
    title: string;
    description: string | null;
    dueDate: string | null;
    priority: number;
    state: { name: string; type: string } | null;
    createdAt: string;
    assignee: { name: string } | null;
  }>;

  // Query 2: fetch relations and children using issue UUIDs
  const issueIds = issueNodes.filter((n) => n.dueDate).map((n) => n.id);
  const idToIdentifier = new Map(issueNodes.map((n) => [n.id, n.identifier]));

  let relationsMap: Record<string, { blocks: string[]; blockedBy: string[] }> = {};
  let childrenMap: Record<string, { total: number; completed: number }> = {};

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

      interface RelNode { type: string; relatedIssue: { identifier: string } }
      interface ChildNode { id: string; completedAt: string | null }

      for (const node of detailData.issues.nodes) {
        const identifier = node.identifier as string;
        const relations = (node.relations?.nodes || []) as RelNode[];
        const blocks: string[] = [];
        const blockedBy: string[] = [];
        for (const rel of relations) {
          if (rel.type === 'blocks') blocks.push(rel.relatedIssue.identifier);
          else if (rel.type === 'blocked_by') blockedBy.push(rel.relatedIssue.identifier);
        }
        relationsMap[identifier] = { blocks, blockedBy };

        const children = (node.children?.nodes || []) as ChildNode[];
        childrenMap[identifier] = {
          total: children.length,
          completed: children.filter((c) => c.completedAt !== null).length,
        };
      }
    } catch {
      // If the detail query fails, continue without relations/children
      console.warn('Failed to fetch relations/children — continuing without them');
    }
  }

  const tasks: Task[] = issueNodes
    .filter((n) => n.dueDate)
    .map((n) => {
      const rel = relationsMap[n.identifier] || { blocks: [], blockedBy: [] };
      const ch = childrenMap[n.identifier] || { total: 0, completed: 0 };
      const progress = ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0;

      return {
        id: n.identifier,
        title: n.title,
        description: n.description || '',
        due: n.dueDate!,
        startDate: parseStartDate(n.description || ''),
        priorityVal: n.priority,
        priority: PRIORITY_MAP[n.priority] || 'None',
        status: n.state?.name || '',
        statusType: n.state?.type || '',
        assignee: n.assignee?.name || 'Unassigned',
        blocks: rel.blocks,
        blockedBy: rel.blockedBy,
        progress,
        totalChildren: ch.total,
        completedChildren: ch.completed,
      };
    })
    .sort((a, b) => a.priorityVal - b.priorityVal || new Date(a.due).getTime() - new Date(b.due).getTime());

  const milestones: Milestone[] = (data.project.projectMilestones?.nodes || []).map(
    (m: { id: string; name: string; targetDate: string | null }) => ({
      id: m.id,
      name: m.name,
      targetDate: m.targetDate,
    }),
  );

  return { projectName: data.project.name, tasks, milestones };
}
