import { useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';

export interface RecordActionsProps {
  noun: string;
  name: string;
  id: string;
  /** Directory list route, e.g. `/clients`; the edit page is `${basePath}/${id}/edit`. */
  basePath: string;
  queryKey: readonly unknown[];
  managePermission: string;
  remove: (id: string) => Promise<unknown>;
  /** Archive and restore, for records whose lifecycle is a status value. Omit when the record has none. */
  status?: { current: string | undefined; archived: string; active: string; set: (id: string, status: string) => Promise<unknown> };
}

/**
 * Edit, archive / restore and delete for one record, behind the manage permission. Every write goes
 * through the API module and refreshes the lists and the record's history; a refusal (for example a
 * delete blocked by records that still point at it) is shown by the confirm dialog with the server's reason.
 */
export const RecordActions: React.FC<RecordActionsProps> = ({ noun, name, id, basePath, queryKey, managePermission, remove, status }) => {
  const canManage = useCan(managePermission);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  if (!canManage) return null;

  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  const isArchived = status !== undefined && status.current === status.archived;

  return (
    <>
      <Link to={`${basePath}/${id}/edit`}>
        <Button variant="outline" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />}>
          Edit
        </Button>
      </Link>
      {status &&
        (isArchived ? (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={async () => {
              await status.set(id, status.active);
              await refresh();
              notify.success(`${name} was restored.`);
            }}
          >
            Restore
          </Button>
        ) : (
          <Button variant="outline" size="sm" leftIcon={<Archive className="w-3.5 h-3.5" />} onClick={() => setConfirm('archive')}>
            Archive
          </Button>
        ))}
      <Button variant="outline" size="sm" className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10" leftIcon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setConfirm('delete')}>
        Delete
      </Button>

      {status && (
        <ConfirmDialog
          isOpen={confirm === 'archive'}
          title={`Archive ${noun}`}
          message={`Archive "${name}"? It stays in the directory with the status "${status.archived}" and can be restored.`}
          confirmLabel="Archive"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await status.set(id, status.archived);
            await refresh();
            notify.success(`${name} was archived.`);
          }}
        />
      )}
      <ConfirmDialog
        isOpen={confirm === 'delete'}
        title={`Delete ${noun}`}
        message={`Delete "${name}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await remove(id);
          await refresh();
          notify.success(`${name} was deleted.`);
          navigate(basePath, { replace: true });
        }}
      />
    </>
  );
};
