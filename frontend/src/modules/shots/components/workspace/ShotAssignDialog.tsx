import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { shotsApi } from '@/api/production/work';
import type { Shot } from '@/api/production/work';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { MemberSelect } from '@/modules/production/work/pickers';
import { Button } from '@/shared/components/Button';

/**
 * Choose the shot's artist from the project's members: the value is the member's user id, saved as `assigned_artist`
 * (the server does not check membership for a shot, so the picker offers members only). Leaving it empty unassigns the shot.
 */
export const ShotAssignDialog: React.FC<{ shot: Shot; onClose: () => void }> = ({ shot, onClose }) => {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState(shot.assigned_artist_id ?? '');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  return (
    <Dialog isOpen onClose={onClose} title={`Assign ${shot.code}`} size="md">
      <div className="space-y-4">
        <MemberSelect projectId={shot.project_id} value={userId} onChange={(id) => { setUserId(id); setError(undefined); }} label="Artist" error={error} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={saving}
            disabled={userId === (shot.assigned_artist_id ?? '')}
            onClick={async () => {
              setSaving(true);
              try {
                await shotsApi.update(shot.id, { assigned_artist: userId || null });
                await Promise.all([queryClient.invalidateQueries({ queryKey: shotsApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
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
