/**
 * Which actions a delivery offers in each status, and the permission each needs. Pinned to the captured
 * server (docs/sync/samples/deliveries/_flow.json) and to docs/deliveries/CONTRACTS.md §2 and §4:
 *
 *   Draft ─ validate ─> Validating ─ prepare ─> Ready ─ sign off ─> Signed Off ─ send ─> Submitted ─┬─ client approved ─> Approved ─ complete ─> Completed
 *   Draft / Validating / Ready ─ cancel ─> Cancelled        Signed Off ─ reopen ─> Ready             └─ client rejected ─> Rejected ─ revise ─> a new Draft
 *
 * An action the status does not allow is a 409 `invalid_transition`; one the caller's codes do not allow is a 403.
 */
export type DeliveryActionName = 'validate' | 'retry' | 'prepare' | 'signOff' | 'reopen' | 'submit' | 'approve' | 'reject' | 'complete' | 'cancel' | 'revise';

/** What the dialog asks before sending. */
export type DeliveryAsk = { label: string; required?: boolean };

export interface DeliveryAction {
  action: DeliveryActionName;
  label: string;
  permission: string;
  /** Statuses (as the reads word them) the action is offered in. */
  from: readonly string[];
  confirm: string;
  /** A text typed into the dialog and sent with the call. */
  ask?: DeliveryAsk;
  destructive?: boolean;
}

export const DELIVERY_ACTIONS: readonly DeliveryAction[] = [
  { action: 'validate', label: 'Validate', permission: 'delivery.update', from: ['Draft'], confirm: 'Check every item against the registry? This runs the quality checks and moves the delivery to Validating.' },
  { action: 'retry', label: 'Re-run checks', permission: 'delivery.update', from: ['Validating'], confirm: 'Run the quality checks again?' },
  { action: 'prepare', label: 'Prepare', permission: 'delivery.update', from: ['Draft', 'Validating'], confirm: 'Run the checks and build the manifest? A failed check stops here and lists what is wrong.' },
  { action: 'signOff', label: 'Sign off', permission: 'delivery.approve', from: ['Ready'], confirm: 'Sign off this delivery as ready to send? Whoever prepared it cannot.', ask: { label: 'Notes' } },
  { action: 'reopen', label: 'Reopen', permission: 'delivery.approve', from: ['Signed Off'], confirm: 'Take the sign-off back and return the delivery to Ready?' },
  { action: 'submit', label: 'Send', permission: 'delivery.send', from: ['Signed Off'], confirm: 'Record this delivery as sent to the client? The transfer itself happens outside StudioHub, and the items are frozen from now on.', ask: { label: 'Transfer reference (e.g. Aspera job)' } },
  { action: 'approve', label: 'Client approved', permission: 'delivery.send', from: ['Submitted'], confirm: 'Record that the client approved this delivery?', ask: { label: 'Client notes' } },
  { action: 'reject', label: 'Client rejected', permission: 'delivery.send', from: ['Submitted'], confirm: 'Record that the client rejected this delivery?', ask: { label: 'Reason', required: true }, destructive: true },
  { action: 'complete', label: 'Complete', permission: 'delivery.update', from: ['Approved'], confirm: 'Mark this delivery completed?' },
  { action: 'revise', label: 'Revise', permission: 'delivery.send', from: ['Rejected'], confirm: 'Start a new draft from this rejected delivery, with the same versions?' },
  { action: 'cancel', label: 'Cancel delivery', permission: 'delivery.update', from: ['Draft', 'Validating', 'Ready', 'Signed Off'], confirm: 'Cancel this delivery?', ask: { label: 'Reason' }, destructive: true },
];

/** Cancelling a signed-off delivery needs `delivery.approve`, the others `delivery.update`. */
export const requiredPermission = (action: DeliveryAction, status: string): string => (action.action === 'cancel' && status === 'Signed Off' ? 'delivery.approve' : action.permission);

export const deliveryActionsFrom = (status: string): DeliveryAction[] => DELIVERY_ACTIONS.filter((a) => a.from.includes(status));

/** Details, items and the passcode can change only while the delivery is still being prepared. */
export const EDITABLE_STATUSES: readonly string[] = ['Draft', 'Validating', 'Ready'];
export const isEditable = (status: string) => EDITABLE_STATUSES.includes(status);

/** A delivery is a record of what was sent: the screens offer deleting only before it was sent or after it was cancelled (the server accepts more, CR-18). */
export const isDeletable = (status: string) => status === 'Draft' || status === 'Cancelled';

/** Past the point of sending: the items are a frozen record. */
export const SENT_STATUSES: readonly string[] = ['Submitted', 'Approved', 'Rejected', 'Completed'];
