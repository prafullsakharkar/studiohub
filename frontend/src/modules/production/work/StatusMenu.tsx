import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { ENTERING_PERMISSION, nextStatuses } from '@/api/production/statusFlow';
import type { WorkflowEntity } from '@/api/production/statusFlow';
import { AuthContext } from '@/core/auth/AuthContext';
import { evaluateAccess } from '@/core/permissions/access';
import { notify } from '@/core/notifications/notify';
import { Badge } from '@/shared/components/Badge';

export interface StatusMenuProps {
  entity: WorkflowEntity;
  status: string;
  name: string;
  /** Holders of the update permission may change status; the server still decides each move. */
  canChange: boolean;
  /** Runs the move (a PATCH, or the dedicated `approve` action). */
  change: (next: string) => Promise<unknown>;
  /** Query keys to refresh afterwards. */
  invalidate: ReadonlyArray<readonly unknown[]>;
}

/**
 * Status as a select that lists only the moves the backend allows from here (statusFlow.ts) and the caller
 * may make (entering Approved on a shot needs `shot.approve`). A refused move shows the server's message.
 */
export const StatusMenu: React.FC<StatusMenuProps> = ({ entity, status, name, canChange, change, invalidate }) => {
  const queryClient = useQueryClient();
  const user = useContext(AuthContext)?.user ?? null;
  const [busy, setBusy] = useState(false);
  const moves = nextStatuses(entity, status).filter((to) => to !== 'Archived' && (!ENTERING_PERMISSION[entity]?.[to] || evaluateAccess(user, ENTERING_PERMISSION[entity]?.[to] as string, {})));
  if (!canChange || moves.length === 0) return <Badge variant="outline">{status}</Badge>;

  const onChange = async (next: string) => {
    if (!next || next === status) return;
    setBusy(true);
    try {
      await change(next);
      await Promise.all([...invalidate, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    } catch (error) {
      notify.error(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <select aria-label={`Status of ${name}`} value={status} disabled={busy} onChange={(e) => void onChange(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200">
      <option value={status}>{status}</option>
      {moves.map((to) => (
        <option key={to} value={to}>
          {to}
        </option>
      ))}
    </select>
  );
};
