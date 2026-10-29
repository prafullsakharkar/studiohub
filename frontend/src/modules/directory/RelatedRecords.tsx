import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import type React from 'react';
import { useContext, useEffect, useMemo, useState } from 'react';
import { auditKeys } from '@/api/audit/audit';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { AuthContext } from '@/core/auth/AuthContext';
import { notify } from '@/core/notifications/notify';
import { evaluateAccess } from '@/core/permissions/access';
import { useCan } from '@/core/permissions/useCan';
import { FormBanner, Table } from '@/modules/identity/components/ui';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { FieldInputs } from './FieldInputs';
import { type Values, blank, buildSchema, fromRow, wireValue } from './formModel';
import type { RelatedRecordsConfig, RowAction } from './types';

function RecordDialog<T extends { id: string }>({ config, parentId, row, onClose }: { config: RelatedRecordsConfig<T>; parentId: string; row: T | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const user = useContext(AuthContext)?.user ?? null;
  const editing = row !== null;
  const fields = useMemo(() => config.fields.filter((f) => !f.permission || evaluateAccess(user, f.permission, {})), [config.fields, user]);
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const {
    register,
    control,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useServerForm<Values>({ resolver: zodResolver(schema) as never, defaultValues: Object.fromEntries(fields.map((f) => [f.name, blank(f)])) });

  useEffect(() => {
    if (row) reset(fromRow(fields, row as unknown as Record<string, unknown>));
  }, [row, fields, reset]);

  const onSubmit = submit(async (values) => {
    const payload: Record<string, unknown> = editing ? {} : { [config.parentField]: parentId };
    for (const field of fields) {
      if (editing && (!(dirtyFields as Record<string, unknown>)[field.name] || config.immutableOnEdit?.includes(field.name))) continue;
      if (!editing && values[field.name] === '' && field.kind !== 'checkbox') continue;
      payload[field.name] = wireValue(field, values[field.name]);
    }
    if (editing) await config.update((row as T).id, payload);
    else await config.create(payload);
    await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
    notify.success(`${config.noun[0].toUpperCase()}${config.noun.slice(1)} ${editing ? 'saved' : 'added'}.`);
    onClose();
  });

  return (
    <Dialog isOpen onClose={onClose} title={editing ? `Edit ${config.noun}` : `Add ${config.noun}`} size="lg">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <FieldInputs fields={fields} parentId={parentId} editing={editing} immutableOnEdit={config.immutableOnEdit} register={register} control={control} errors={errors} clearServerError={clearServerError} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {editing ? 'Save changes' : `Add ${config.noun}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * The records that belong to one parent (contacts, contracts), listed server-side with the parent as a
 * filter, with add / edit / delete and per-row lifecycle actions behind the manage permission.
 */
export function RelatedRecords<T extends { id: string }>({ config, parentId }: { config: RelatedRecordsConfig<T>; parentId: string }): React.ReactElement {
  const queryClient = useQueryClient();
  const canManage = useCan(config.managePermission);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const inArchive = view === 'archived' && Boolean(config.archived);
  const fetchPage = inArchive ? (config.archived as NonNullable<typeof config.archived>).fetchPage : config.fetchPage;
  const list = usePaginatedList<T>({ queryKey: [...config.queryKey, parentId, view], fetchPage, ordering: config.defaultOrdering, filters: { [config.filterField ?? config.parentField]: parentId } });
  const [dialog, setDialog] = useState<{ row: T | null } | null>(null);
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [action, setAction] = useState<(RowAction & { rowName: string }) | null>(null);
  const [date, setDate] = useState('');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{config.title}</h3>
        {config.archived && (
          <select aria-label="Show" value={view} onChange={(e) => setView(e.target.value as 'active' | 'archived')} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        )}
        {canManage && !inArchive && (
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDialog({ row: null })}>
            Add {config.noun}
          </Button>
        )}
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName={config.title.toLowerCase()}
        isEmpty={list.rows.length === 0}
        empty={{ title: `No ${config.title.toLowerCase()}`, description: `Nothing has been recorded yet.` }}
      >
        <Table label={config.title} columns={[...config.columns.map((c) => c.header), '']}>
          {list.rows.map((row) => (
            <tr key={row.id}>
              {config.columns.map((c) => (
                <td key={c.header} className="px-4 py-2 text-slate-300">
                  {c.cell(row)}
                </td>
              ))}
              <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                {canManage && inArchive && (
                  <button type="button" className="text-cyan-300 hover:underline" aria-label={`Restore ${config.rowName(row)}`} onClick={() => setAction({ label: 'Restore', confirm: `Restore ${config.rowName(row)}?`, rowName: config.rowName(row), run: () => (config.archived as NonNullable<typeof config.archived>).restore(row.id) })}>
                    Restore
                  </button>
                )}
                {canManage && !inArchive &&
                  config.rowActions?.(row).map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      className="text-cyan-300 hover:underline"
                      aria-label={`${a.label} ${config.rowName(row)}`}
                      onClick={() => {
                        setDate(a.askDate?.initial ?? '');
                        setAction({ ...a, rowName: config.rowName(row) });
                      }}
                    >
                      {a.label}
                    </button>
                  ))}
                {canManage && !inArchive && (
                  <>
                    <button type="button" className="text-cyan-300 hover:underline" aria-label={`Edit ${config.rowName(row)}`} onClick={() => setDialog({ row })}>
                      Edit
                    </button>
                    <button type="button" className="text-rose-400 hover:underline" aria-label={`${config.deleteLabel ?? 'Delete'} ${config.rowName(row)}`} onClick={() => setToDelete(row)}>
                      {config.deleteLabel ?? 'Delete'}
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel={config.title.toLowerCase()} />
      </QueryBoundary>

      {dialog && <RecordDialog config={config} parentId={parentId} row={dialog.row} onClose={() => setDialog(null)} />}

      <ConfirmDialog
        isOpen={action !== null}
        title={action ? `${action.label} ${action.rowName}` : ''}
        message={
          <div className="space-y-2">
            <p>{action?.confirm}</p>
            {action?.askDate && (
              <label className="block text-xs text-slate-300">
                {action.askDate.label}
                <input type="date" aria-label={action.askDate.label} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs" />
              </label>
            )}
          </div>
        }
        confirmLabel={action?.label ?? 'Confirm'}
        destructive={action?.destructive}
        onClose={() => setAction(null)}
        onConfirm={async () => {
          if (!action) return;
          if (action.askDate && !date) throw new Error(`Choose ${action.askDate.label.toLowerCase()}.`);
          await action.run(date || undefined);
          await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
        }}
      />
      <ConfirmDialog
        isOpen={toDelete !== null}
        title={`${config.deleteLabel ?? 'Delete'} ${config.noun}`}
        message={config.deleteLabel ? `${config.deleteLabel} "${toDelete ? config.rowName(toDelete) : ''}"? It moves to the Archived view and can be restored.` : `Delete "${toDelete ? config.rowName(toDelete) : ''}"? This cannot be undone.`}
        confirmLabel={config.deleteLabel ?? 'Delete'}
        destructive
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await config.remove(toDelete.id);
          await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
        }}
      />
    </div>
  );
}
