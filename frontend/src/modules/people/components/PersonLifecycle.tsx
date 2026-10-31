import { useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { peopleApi } from '@/api/masterdata/directory';
import type { Person } from '@/api/masterdata/directory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';

/**
 * Edit, plus the one lifecycle step the person's status allows (the same routes as the roster):
 * active or draft -> deactivate, inactive -> reactivate, archived -> restore.
 */
export const PersonLifecycle: React.FC<{ person: Person }> = ({ person }) => {
  const canManage = useCan('masterdata.directory.manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  if (!canManage) return null;

  const step =
    person.status === 'archived'
      ? { action: 'restore', label: 'Restore', destructive: false }
      : person.status === 'inactive'
        ? { action: 'reactivate', label: 'Reactivate', destructive: false }
        : { action: 'deactivate', label: 'Deactivate', destructive: true };

  return (
    <>
      <Link to={`/people/${person.id}/edit`}>
        <Button variant="outline" size="sm" leftIcon={<Pencil className="w-3.5 h-3.5" />}>
          Edit
        </Button>
      </Link>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {step.label}
      </Button>
      <ConfirmDialog
        isOpen={open}
        title={`${step.label} ${person.full_name}`}
        message={step.destructive ? `Deactivate ${person.full_name}? They stay in the directory but are marked inactive.` : `${step.label} ${person.full_name}?`}
        confirmLabel={step.label}
        destructive={step.destructive}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          await peopleApi.act(person.id, step.action);
          await Promise.all([queryClient.invalidateQueries({ queryKey: peopleApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
          notify.success(`${person.full_name}: ${step.label.toLowerCase()} done.`);
        }}
      />
    </>
  );
};
