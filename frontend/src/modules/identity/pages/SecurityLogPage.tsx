import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ledgersApi } from '@/api/identity/ledgers';
import type { LedgerWindow } from '@/api/identity/ledgers';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { createQueryKeys } from '@/shared/data/queryKeys';
import { Field, FormBanner, PageShell, Table, formatDate, inputClass } from '../components/ui';
import { useUsersIndex } from '../hooks/useIdentityData';
import { ACCESS_TABS } from '../routes';

const ledgerKeys = createQueryKeys('identity-ledgers');

type Section = 'events' | 'logins' | 'attempts' | 'ips';

const SECTIONS: ReadonlyArray<{ id: Section; label: string; permission: string }> = [
  { id: 'events', label: 'Security events', permission: 'identity.security_event.view' },
  { id: 'logins', label: 'Login history', permission: 'identity.login_history.view' },
  { id: 'attempts', label: 'Login attempts', permission: 'identity.login_attempt.view' },
  { id: 'ips', label: 'IP blacklist', permission: 'identity.ip_blacklist.view' },
];

const PAGE_SIZE = 25;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

/**
 * The ledgers answer a bare array of every row in range (docs/sync Q-10), so the window is always
 * sent and paging happens here on the rows we received.
 */
function useWindowedRows<T>(section: Section, fetcher: (params: LedgerWindow, signal?: AbortSignal) => Promise<T[]>, window: LedgerWindow, enabled: boolean) {
  const [page, setPage] = useState(1);
  const query = useQuery({ queryKey: [...ledgerKeys.all, section, window], queryFn: ({ signal }) => fetcher(window, signal), enabled });
  const rows = query.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  return { query, rows, visible: rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), page: current, setPage, total: rows.length, pageCount };
}

const Pager: React.FC<{ state: { page: number; total: number; pageCount: number; setPage: (p: number) => void }; label: string }> = ({ state, label }) => (
  <Pagination currentPage={state.page} totalCount={state.total} pageSize={PAGE_SIZE} totalPages={state.pageCount} onPageChange={state.setPage} itemLabel={label} />
);

const WindowedTable = <T extends { id: string }>({
  section,
  label,
  fetcher,
  window,
  columns,
  row,
}: {
  section: Section;
  label: string;
  fetcher: (params: LedgerWindow, signal?: AbortSignal) => Promise<T[]>;
  window: LedgerWindow;
  columns: string[];
  row: (item: T) => React.ReactNode;
}) => {
  const state = useWindowedRows(section, fetcher, window, true);
  return (
    <QueryBoundary
      isLoading={state.query.isLoading}
      error={state.query.error}
      onRetry={() => void state.query.refetch()}
      entityName={label}
      isEmpty={state.total === 0}
      empty={{ title: `No ${label.toLowerCase()} in this period`, description: 'Widen the date range to look further back.' }}
    >
      <Table label={label} columns={columns}>
        {state.visible.map((item) => (
          <tr key={item.id}>{row(item)}</tr>
        ))}
      </Table>
      <Pager state={state} label="entries" />
    </QueryBoundary>
  );
};

const ipSchema = z.object({ ip_address: z.string().trim().min(1, 'Enter an IP address'), description: z.string().optional() });
type IpValues = z.infer<typeof ipSchema>;

const IpBlacklist: React.FC = () => {
  const queryClient = useQueryClient();
  const canCreate = useCan('identity.ip_blacklist.create');
  const canUpdate = useCan('identity.ip_blacklist.update');
  const canDelete = useCan('identity.ip_blacklist.delete');
  const [removing, setRemoving] = useState<{ id: string; ip: string } | null>(null);
  const state = useWindowedRows('ips', ledgersApi.ipBlacklist, {}, true);
  const refresh = () => queryClient.invalidateQueries({ queryKey: [...ledgerKeys.all, 'ips'] });

  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<IpValues>({ resolver: zodResolver(ipSchema), defaultValues: { ip_address: '', description: '' } });

  const onAdd = submit(async (values) => {
    await ledgersApi.addIp({ ip_address: values.ip_address, ...(values.description ? { description: values.description } : {}) });
    reset();
    await refresh();
    notify.success(`${values.ip_address} is now blocked.`);
  });

  const toggle = useMutation({
    mutationFn: (entry: { id: string; is_active: boolean }) => (entry.is_active ? ledgersApi.deactivateIp(entry.id) : ledgersApi.activateIp(entry.id)),
    onSuccess: refresh,
    onError: (error) => notify.error(error instanceof Error ? error.message : 'Could not update the entry.'),
  });

  return (
    <div className="space-y-4">
      {canCreate && (
        <form noValidate onSubmit={onAdd} className="space-y-3">
          <FormBanner error={serverError} />
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <Field id="ip-address" label="IP address" error={errors.ip_address?.message}>
                <input id="ip-address" className={inputClass(Boolean(errors.ip_address))} {...register('ip_address', { onChange: clearServerError })} />
              </Field>
            </div>
            <div className="flex-1">
              <Field id="ip-description" label="Description (optional)">
                <input id="ip-description" className={inputClass()} {...register('description')} />
              </Field>
            </div>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Block IP
            </Button>
          </div>
        </form>
      )}

      <QueryBoundary
        isLoading={state.query.isLoading}
        error={state.query.error}
        onRetry={() => void state.query.refetch()}
        entityName="IP blacklist"
        isEmpty={state.total === 0}
        empty={{ title: 'No blocked addresses', description: 'Blocked IP addresses are rejected before they can sign in.' }}
      >
        <Table label="IP blacklist" columns={['Address', 'Description', 'Hits', 'Status', '']}>
          {state.visible.map((entry) => (
            <tr key={entry.id}>
              <td className="px-4 py-2 font-mono text-slate-200">{entry.ip_address ?? entry.network}</td>
              <td className="px-4 py-2 text-slate-400">{entry.description || '—'}</td>
              <td className="px-4 py-2 text-slate-400">{entry.hit_count}</td>
              <td className="px-4 py-2">
                <Badge variant={entry.is_active && !entry.expired ? 'error' : 'neutral'}>{entry.expired ? 'Expired' : entry.is_active ? 'Blocking' : 'Paused'}</Badge>
              </td>
              <td className="px-4 py-2 text-right space-x-2">
                {canUpdate && (
                  <button type="button" className="text-cyan-300 hover:underline" onClick={() => toggle.mutate({ id: entry.id, is_active: entry.is_active })}>
                    {entry.is_active ? 'Pause' : 'Resume'}
                  </button>
                )}
                {canDelete && (
                  <button type="button" className="text-rose-400 hover:underline" onClick={() => setRemoving({ id: entry.id, ip: entry.ip_address ?? entry.network ?? '' })}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pager state={state} label="addresses" />
      </QueryBoundary>

      <ConfirmDialog
        isOpen={removing !== null}
        title="Remove from blacklist"
        message={`Stop blocking ${removing?.ip ?? 'this address'}?`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await ledgersApi.removeIp(removing.id);
          await refresh();
        }}
      />
    </div>
  );
};

export const SecurityLogPage: React.FC = () => {
  const allowed = [useCan('identity.security_event.view'), useCan('identity.login_history.view'), useCan('identity.login_attempt.view'), useCan('identity.ip_blacklist.view')];
  const visible = SECTIONS.filter((_, i) => allowed[i]);
  const [chosen, setChosen] = useState<Section | null>(null);
  const section = visible.find((s) => s.id === chosen)?.id ?? visible[0]?.id;
  const [start, setStart] = useState(daysAgo(7));
  const [end, setEnd] = useState(isoDay(new Date()));
  const window = useMemo<LedgerWindow>(() => ({ start_date: start, end_date: end }), [start, end]);
  const users = useUsersIndex();
  const who = (id: string | null | undefined) => (id ? (users.byId.get(id)?.email ?? id.slice(0, 8)) : '—');

  return (
    <PageShell title="Security log" subtitle="Who signed in, what security-relevant events happened, and which addresses are blocked." tabs={ACCESS_TABS}>
      {visible.length === 0 ? (
        <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
          You do not hold any of the security-log permissions (<span className="font-mono text-slate-300">identity.security_event.view</span>,{' '}
          <span className="font-mono text-slate-300">identity.login_history.view</span>, <span className="font-mono text-slate-300">identity.login_attempt.view</span>,{' '}
          <span className="font-mono text-slate-300">identity.ip_blacklist.view</span>).
        </p>
      ) : (
        <>
          <div role="tablist" aria-label="Security log sections" className="flex gap-1 border-b border-slate-800 overflow-x-auto">
            {visible.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={section === s.id}
                onClick={() => setChosen(s.id)}
                className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px ${section === s.id ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {section !== 'ips' && (
            <div className="flex flex-wrap items-end gap-3">
              <Field id="log-from" label="From">
                <input id="log-from" type="date" className={inputClass()} value={start} max={end} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field id="log-to" label="To">
                <input id="log-to" type="date" className={inputClass()} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
              </Field>
            </div>
          )}

          {section === 'events' && (
            <WindowedTable
              section="events"
              label="Security events"
              fetcher={ledgersApi.securityEvents}
              window={window}
              columns={['When', 'Event', 'User', 'IP']}
              row={(e) => (
                <>
                  <td className="px-4 py-2 text-slate-400">{formatDate(e.occurred_at)}</td>
                  <td className="px-4 py-2 font-mono text-slate-200">{e.event_type}</td>
                  <td className="px-4 py-2 text-slate-300">{who(e.user)}</td>
                  <td className="px-4 py-2 font-mono text-slate-400">{e.ip_address ?? '—'}</td>
                </>
              )}
            />
          )}
          {section === 'logins' && (
            <WindowedTable
              section="logins"
              label="Login history"
              fetcher={ledgersApi.loginHistory}
              window={window}
              columns={['When', 'User', 'Type', 'Method', 'Result', 'IP']}
              row={(l) => (
                <>
                  <td className="px-4 py-2 text-slate-400">{formatDate(l.created_at)}</td>
                  <td className="px-4 py-2 text-slate-300">{who(l.user)}</td>
                  <td className="px-4 py-2 text-slate-300">{l.login_type}</td>
                  <td className="px-4 py-2 text-slate-300">{l.login_method}</td>
                  <td className="px-4 py-2">
                    <Badge variant={l.status === 'success' ? 'success' : 'error'}>{l.status}</Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-400">{l.ip_address ?? '—'}</td>
                </>
              )}
            />
          )}
          {section === 'attempts' && (
            <WindowedTable
              section="attempts"
              label="Login attempts"
              fetcher={ledgersApi.loginAttempts}
              window={window}
              columns={['When', 'Username', 'Result', 'Reason', 'IP']}
              row={(a) => (
                <>
                  <td className="px-4 py-2 text-slate-400">{formatDate(a.attempted_at)}</td>
                  <td className="px-4 py-2 text-slate-300">{a.username}</td>
                  <td className="px-4 py-2">
                    <Badge variant={a.success ? 'success' : 'error'}>{a.success ? 'Success' : 'Failed'}</Badge>
                  </td>
                  <td className="px-4 py-2 text-slate-400">{a.reason || '—'}</td>
                  <td className="px-4 py-2 font-mono text-slate-400">{a.ip_address ?? '—'}</td>
                </>
              )}
            />
          )}
          {section === 'ips' && <IpBlacklist />}
        </>
      )}
    </PageShell>
  );
};
