import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { Button } from '@/shared/components/Button';
import { MemberSelect } from './pickers';

export interface AssignTarget {
  id: string;
  code: string;
  projectId: string;
  /** The user id the record has now (`assigned_artist_id`). */
  assignedArtistId: string | null;
}

/**
 * Choose a shot's or an asset's artist from the project's members: the value is the member's user id, saved as
 * `assigned_artist`. Leaving it empty unassigns. (The server does not check that the user is a member of the project,
 * so the picker offers members only.)
 */
export const AssignArtistDialog: React.FC<{
  target: AssignTarget;
  /** Saves `assigned_artist`: the user id, or `null` to unassign. */
  save: (userId: string | null) => Promise<unknown>;
  /** The query keys the record's own lists live under, refreshed after a save. */
  queryKey: readonly unknown[];
  onClose: () => void;
}> = ({ target, save, queryKey, onClose }) => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(target.assignedArtistId ?? '');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  return (
    <Dialog isOpen onClose={onClose} title={`Assign ${target.code}`} size="md">
      <div className="space-y-4">
        <MemberSelect projectId={target.projectId} value={userId} onChange={(id) => { setUserId(id); setError(undefined); }} label="Artist" error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={saving}
            disabled={userId === (target.assignedArtistId ?? '')}
            onClick={async () => {
              setSaving(true);
              try {
                await save(userId || null);
                await Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
                notify.success(userId ? 'Artist assigned.' : 'Artist removed.');
                onClose();
              } catch (e) {
                setError(serverMessage(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
