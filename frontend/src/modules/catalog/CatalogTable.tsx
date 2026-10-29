import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { catalogKeys } from '@/api/masterdata/catalog';
import type { CatalogListParams, CatalogRowBase } from '@/api/masterdata/catalog';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { FieldInputs } from '@/modules/directory/FieldInputs';
import { type Values, blank, buildSchema, fromRow, wireValue } from '@/modules/directory/formModel';
import type { FieldDef } from '@/modules/directory/types';
import { FormBanner, Table } from '@/modules/identity/components/ui';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';

const MANAGE = 'masterdata.catalog.manage';

export interface CatalogCrud<Row> {
  list: (params?: CatalogListParams, signal?: AbortSignal) => Promise<Row[]>;
  create: (input: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  restore: (id: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  reorder: (ids: string[]) => Promise<unknown>;
}

export interface CatalogTableProps<Row extends CatalogRowBase> {
  /** Cache scope, e.g. `['task-types']`. */
  scope: readonly unknown[];
  noun: string;
  api: CatalogCrud<Row>;
  fields: ReadonlyArray<FieldDef>;
  columns: ReadonlyArray<{ header: string; cell: (row: Row) => React.ReactNode }>;
  /** Extra per-row control, e.g. "Versions" for software. */
  rowExtra?: (row: Row) => React.ReactNode;
}

function RowDialog<Row extends CatalogRowBase>({ props, row, onClose }: { props: CatalogTableProps<Row>; row: Row | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const editing = row !== null;
  const schema = useMemo(() => buildSchema(props.fields), [props.fields]);
  const {
    register,
    control,
    submit,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useServerForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: row ? fromRow(props.fields, row as unknown as Record<string, unknown>) : Object.fromEntries(props.fields.map((f) => [f.name, blank(f)])),
  });

  const onSubmit = submit(async (values) => {
    const payload: Record<string, unknown> = {};
    for (const field of props.fields) {
      if (editing && !(dirtyFields as Record<string, unknown>)[field.name]) continue;
      if (!editing && values[field.name] === '' && field.kind !== 'checkbox') continue;
      payload[field.name] = wireValue(field, values[field.name]);
    }
    if (editing) await props.api.update((row as Row).id, payload);
    else await props.api.create(payload);
    await queryClient.invalidateQueries({ queryKey: [...catalogKeys.all, ...props.scope] });
    notify.success(`${props.noun[0].toUpperCase()}${props.noun.slice(1)} ${editing ? 'saved' : 'created'}.`);
    onClose();
  });

  return (
    <Dialog isOpen onClose={onClose} title={editing ? `Edit ${props.noun}` : `New ${props.noun}`} size="lg">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <FieldInputs fields={props.fields} editing={editing} register={register} control={control} errors={errors} clearServerError={clearServerError} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {editing ? 'Save changes' : `Create ${props.noun}`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * One catalog list (unpaginated on the server): server-side search and status filter, create / edit,
 * archive / restore, delete (system rows excluded), and reorder, which is only offered on the plain
 * active list because the API renumbers exactly the ids it is sent.
 */
export function CatalogTable<Row extends CatalogRowBase>(props: CatalogTableProps<Row>): React.ReactElement {
  const queryClient = useQueryClient();
  const canManage = useCan(MANAGE);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [dialog, setDialog] = useState<{ row: Row | null } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; destructive?: boolean; run: () => Promise<unknown> } | null>(null);
  const params = useMemo<CatalogListParams>(() => ({ status, ...(search.trim() ? { search: search.trim() } : {}) }), [status, search]);
  const key = [...catalogKeys.all, ...props.scope, params] as const;
  const list = useQuery({ queryKey: key, queryFn: ({ signal }) => props.api.list(params, signal) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...catalogKeys.all, ...props.scope] });
  const rows = list.data ?? [];
  const canReorder = canManage && status === 'active' && !search.trim() && rows.length > 1;

  const move = async (index: number, delta: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    try {
      await props.api.reorder(ids);
      await refresh();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not reorder.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} placeholder={`Search ${props.noun}s…`} aria-label={`Search ${props.noun}s`} className="w-56" />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'archived')} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        {canManage && (
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDialog({ row: null })}>
            New {props.noun}
          </Button>
        )}
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        entityName={`${props.noun}s`}
        isEmpty={rows.length === 0}
        empty={{ title: `No ${status} ${props.noun}s`, description: search ? 'Nothing matches the search.' : 'Nothing here yet.' }}
      >
        <Table label={`${props.noun}s`} columns={[...props.columns.map((c) => c.header), 'Status', '']}>
          {rows.map((row, index) => (
            <tr key={row.id}>
              {props.columns.map((c) => (
                <td key={c.header} className="px-4 py-2 text-slate-300">
                  {c.cell(row)}
                </td>
              ))}
              <td className="px-4 py-2 space-x-1">
                <Badge variant={row.status === 'archived' ? 'neutral' : 'success'}>{row.status}</Badge>
                {row.is_system && <Badge variant="purple">System</Badge>}
              </td>
              <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                {props.rowExtra?.(row)}
                {canReorder && (
                  <>
                    <button type="button" disabled={index === 0} aria-label={`Move ${row.name} up`} className="text-slate-400 hover:text-white disabled:opacity-30" onClick={() => void move(index, -1)}>
                      <ArrowUp className="inline w-3.5 h-3.5" />
                    </button>
                    <button type="button" disabled={index === rows.length - 1} aria-label={`Move ${row.name} down`} className="text-slate-400 hover:text-white disabled:opacity-30" onClick={() => void move(index, 1)}>
                      <ArrowDown className="inline w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                {canManage && row.status !== 'archived' && (
                  <button type="button" className="text-cyan-300 hover:underline" aria-label={`Edit ${row.name}`} onClick={() => setDialog({ row })}>
                    Edit
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="text-amber-400 hover:underline"
                    aria-label={`${row.status === 'archived' ? 'Restore' : 'Archive'} ${row.name}`}
                    onClick={() =>
                      setConfirm(
                        row.status === 'archived'
                          ? { title: `Restore ${row.name}`, message: 'Make it available again?', label: 'Restore', run: () => props.api.restore(row.id) }
                          : { title: `Archive ${row.name}`, message: 'It stays on existing records but can no longer be chosen.', label: 'Archive', destructive: true, run: () => props.api.archive(row.id) }
                      )
                    }
                  >
                    {row.status === 'archived' ? 'Restore' : 'Archive'}
                  </button>
                )}
                {canManage && !row.is_system && (
                  <button type="button" className="text-rose-400 hover:underline" aria-label={`Delete ${row.name}`} onClick={() => setConfirm({ title: `Delete ${row.name}`, message: 'This cannot be undone.', label: 'Delete', destructive: true, run: () => props.api.remove(row.id) })}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>

      {dialog && <RowDialog props={props} row={dialog.row} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label ?? 'Confirm'}
        destructive={confirm?.destructive}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (!confirm) return;
          await confirm.run();
          await refresh();
        }}
      />
    </div>
  );
}
