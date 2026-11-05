import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { notify } from '@/core/notifications/notify';
import { FormDialog } from '@/shared/forms/FormDialog';
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
 * `assigned_artist`. Leaving it empty unassigns. The server refuses a user who is not an active member of the project
 * (CR-34, 400 "Unknown user."); the picker offers members only, and a refusal is shown under the field.
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
  const initial = target.assignedArtistId ?? '';
  const [userId, setUserId] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const changed = userId !== initial;

  const onSubmit = async () => {
    if (!changed || saving) return;
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
  };

  return (
    <FormDialog title={`Assign ${target.code}`} size="md" onClose={onClose} onSubmit={onSubmit} isSubmitting={saving} isDirty={changed} submitLabel="Save changes" submitDisabled={!changed}>
      <MemberSelect projectId={target.projectId} value={userId} onChange={(id) => { setUserId(id); setError(undefined); }} label="Artist" error={error} />
    </FormDialog>
  );
};
