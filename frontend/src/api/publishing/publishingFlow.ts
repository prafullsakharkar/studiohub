/**
 * Which actions an export job and a published file offer in each status, and the permission each needs. Pinned to
 * the captured server (docs/sync/samples/publishing/_flow.json) and to docs/publishing/CONTRACTS.md §1, §3 and §4:
 *
 *   job:   Pending ─ validate ─> Validated ─ start export ─> Exporting ─ complete ─> Exported (final)
 *          Exporting ─ fail ─> Failed ─ retry ─> Pending        Pending / Validating / Validated / Failed ─ unpublish ─> Cancelled (final)
 *          any status ─ republish ─> a new Pending job
 *   file:  Registered ⇄ Deprecated (deprecate / restore);  Registered or Deprecated ─ revoke ─> Revoked (final)
 *
 * An action the status does not allow is a 409 `invalid_transition`; one the caller's codes do not allow is a 403.
 */
export type JobActionName = 'validate' | 'startExport' | 'completeExport' | 'fail' | 'retry' | 'unpublish' | 'republish';
export type FileActionName = 'deprecate' | 'restore' | 'revoke';

export interface FlowAsk {
  label: string;
  required?: boolean;
}
export interface JobAction {
  action: JobActionName;
  label: string;
  permission: string;
  /** Statuses (`job_status`) the action is offered in. */
  from: readonly string[];
  confirm: string;
  ask?: FlowAsk;
  destructive?: boolean;
}
export interface FileAction {
  action: FileActionName;
  label: string;
  permission: string;
  from: readonly string[];
  confirm: string;
  ask?: FlowAsk;
  destructive?: boolean;
}

export const JOB_ACTIONS: readonly JobAction[] = [
  { action: 'validate', label: 'Validate', permission: 'publishing.update', from: ['Pending', 'Validated'], confirm: 'Check this job against its validation rules? A job with no rules passes with nothing checked.' },
  { action: 'startExport', label: 'Start export', permission: 'publishing.update', from: ['Validated'], confirm: 'Record that the export has started?' },
  { action: 'completeExport', label: 'Complete export', permission: 'publishing.update', from: ['Exporting'], confirm: 'Record that the export finished? The job becomes final.' },
  { action: 'fail', label: 'Mark failed', permission: 'publishing.update', from: ['Exporting'], confirm: 'Record that the export failed?', ask: { label: 'Reason', required: true }, destructive: true },
  { action: 'retry', label: 'Retry', permission: 'publishing.update', from: ['Failed'], confirm: 'Put this failed job back to Pending?' },
  { action: 'unpublish', label: 'Cancel job', permission: 'publishing.update', from: ['Pending', 'Validating', 'Validated', 'Failed'], confirm: 'Cancel this job? A cancelled job is final.', ask: { label: 'Reason' }, destructive: true },
  { action: 'republish', label: 'Republish', permission: 'publishing.update', from: ['Pending', 'Validating', 'Validated', 'Exporting', 'Exported', 'Failed', 'Cancelled'], confirm: 'Start a new Pending job from this one? This job is not changed.', ask: { label: 'Comment' } },
];

export const FILE_ACTIONS: readonly FileAction[] = [
  { action: 'deprecate', label: 'Deprecate', permission: 'publishing.deprecate', from: ['Registered'], confirm: 'Deprecate this file? It stops being the latest and cannot be delivered, and can be restored.', ask: { label: 'Note' } },
  { action: 'restore', label: 'Restore', permission: 'publishing.deprecate', from: ['Deprecated'], confirm: 'Restore this file?' },
  { action: 'revoke', label: 'Revoke', permission: 'publishing.revoke', from: ['Registered', 'Deprecated'], confirm: 'Revoke this file? This is final: the path keeps naming this content and cannot be registered again. Deliveries holding it are sent back for another look.', ask: { label: 'Reason', required: true }, destructive: true },
];

export const jobActionsFrom = (jobStatus: string): JobAction[] => JOB_ACTIONS.filter((a) => a.from.includes(jobStatus));
export const fileActionsFrom = (status: string): FileAction[] => FILE_ACTIONS.filter((a) => a.from.includes(status));

/** Details can change only before the export ran or after it failed (409 `job_not_editable` otherwise). */
export const EDITABLE_JOB_STATUSES: readonly string[] = ['Pending', 'Failed'];
export const isJobEditable = (jobStatus: string) => EDITABLE_JOB_STATUSES.includes(jobStatus);

/** A job is a record of an export: the screens offer deleting only a job that never ran or was cancelled (the server accepts more, CR-23). */
export const isJobDeletable = (jobStatus: string) => jobStatus === 'Pending' || jobStatus === 'Cancelled';

export const FINAL_JOB_STATUSES: readonly string[] = ['Exported', 'Cancelled'];
