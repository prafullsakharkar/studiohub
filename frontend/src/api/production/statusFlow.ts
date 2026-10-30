/**
 * Which status may follow which, copied from the backend's table (`apps/production/constants/workflow.py`).
 * The server is the authority and answers 400 `invalid_transition` for any other move; this only keeps the
 * UI from offering moves that are certain to fail. `statusFlow.test.ts` checks the table against the
 * transitions the real backend accepted and refused (samples/production/_work_flow.json).
 *
 * `Archived` is left out of the choices on purpose: archiving is its own action (archive / restore).
 */
export type WorkflowEntity = 'shot' | 'task' | 'timelog' | 'asset' | 'version' | 'review';

const SHOT_WORKING = ['Not Started', 'In Progress', 'Pending Review', 'Retake', 'On Hold'] as const;
const TASK_WORKING = ['Not Started', 'In Progress', 'Pending Review', 'Retake'] as const;
/** Assets have no transition table on the server: any status may follow any other (captured: Not Started → Approved → Not Started). */
const ASSET_STATUSES = ['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake'] as const;

function working(states: readonly string[]): Record<string, readonly string[]> {
  const graph: Record<string, readonly string[]> = {};
  for (const state of states) {
    graph[state] = [...states.filter((s) => s !== state), ...(state === 'Pending Review' ? ['Approved'] : [])];
  }
  graph.Approved = [];
  return graph;
}

const TRANSITIONS: Record<WorkflowEntity, Record<string, readonly string[]>> = {
  shot: working(SHOT_WORKING),
  task: working(TASK_WORKING),
  asset: Object.fromEntries(ASSET_STATUSES.map((from) => [from, ASSET_STATUSES.filter((to) => to !== from)])),
  // A version moves like a task: Approved is entered from Pending Review (needs `version.publish`) and its status is frozen once published.
  version: working(TASK_WORKING),
  review: {
    'Pending Review': ['Submitted', 'In Review', 'Closed'],
    Submitted: ['In Review', 'Closed'],
    'In Review': ['Approved', 'Rejected', 'Changes Requested', 'Retake', 'Closed'],
    'Changes Requested': ['Submitted', 'In Review', 'Closed'],
    Retake: ['Submitted', 'In Review', 'Closed'],
    Rejected: ['Submitted', 'Closed'],
    Approved: ['Closed'],
    Closed: [],
  },
  timelog: {
    Draft: ['Submitted'],
    Submitted: ['Approved', 'Rejected', 'Draft'],
    Rejected: ['Submitted', 'Draft'],
    Approved: [],
  },
};

/** Permission needed to ENTER a status, beyond the route's own (shots: `shot.approve`; timelogs: `timelog.approve`). */
export const ENTERING_PERMISSION: Partial<Record<WorkflowEntity, Record<string, string>>> = {
  shot: { Approved: 'shot.approve' },
  version: { Approved: 'version.publish' },
  review: { Approved: 'review.approve', Rejected: 'review.approve', 'Changes Requested': 'review.approve', Retake: 'review.approve' },
  timelog: { Approved: 'timelog.approve', Rejected: 'timelog.approve' },
};

/** The statuses a record in `from` can be moved to. An unknown current status may move anywhere (legacy rows). */
export function nextStatuses(entity: WorkflowEntity, from: string): string[] {
  const graph = TRANSITIONS[entity];
  if (!(from in graph)) return Object.keys(graph);
  return [...graph[from]];
}

export const isAllowedMove = (entity: WorkflowEntity, from: string, to: string): boolean => nextStatuses(entity, from).includes(to);

/** The review actions: what each does to the status, and the permission it needs (`review.update` unless noted). */
export const REVIEW_ACTIONS = [
  { action: 'submit', label: 'Submit', to: 'Submitted', permission: 'review.update' },
  { action: 'startReview', label: 'Start review', to: 'In Review', permission: 'review.update' },
  { action: 'approve', label: 'Approve', to: 'Approved', permission: 'review.approve' },
  { action: 'requestChanges', label: 'Request changes', to: 'Changes Requested', permission: 'review.approve' },
  { action: 'reject', label: 'Reject', to: 'Rejected', permission: 'review.approve' },
  { action: 'retake', label: 'Retake', to: 'Retake', permission: 'review.approve' },
  { action: 'close', label: 'Close', to: 'Closed', permission: 'review.update' },
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number]['action'];

/** The actions a review in `status` offers. Closing is always last; the server still decides each move. */
export const reviewActionsFrom = (status: string) => REVIEW_ACTIONS.filter((a) => isAllowedMove('review', status, a.to));
