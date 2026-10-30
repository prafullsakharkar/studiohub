import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { deliveriesApi, deliveryStatusLabel } from '@/api/deliveries/deliveries';
import type { Delivery, DeliveryItem, DeliveryQCCheck } from '@/api/deliveries/deliveries';
import { isEditable } from '@/api/deliveries/deliveryFlow';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { VersionPicker } from '@/modules/production/review/pickers';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { checkLabel, deliveryErrorMessage, removeItemMessage } from './errors';
import { formatBytes, formatWhen } from './format';
import { UserName } from './UserName';

/** Refreshes every delivery query and the change history after a write. */
export function useRefreshDeliveries() {
  const queryClient = useQueryClient();
  return () => Promise.all([deliveriesApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Runs a write, then refreshes; the server's refusal is shown as a toast. */
export function useDeliveryWrite() {
  const refresh = useRefreshDeliveries();
  return async (write: () => Promise<unknown>, describe: (error: unknown) => string = deliveryErrorMessage): Promise<boolean> => {
    try {
      await write();
      await refresh();
      return true;
    } catch (error) {
      notify.error(describe(error));
      return false;
    }
  };
}

const Empty: React.FC<{ children: string }> = ({ children }) => <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">{children}</p>;

const deliveryQcKey = (id: string) => [...deliveriesApi.keys.detail(id), 'qc'];

/** The quality-check rows of a delivery. Items with rows can no longer be removed (CR-20), so the Items panel reads the same query. */
export const useDeliveryQc = (id: string) => useQuery({ queryKey: deliveryQcKey(id), queryFn: ({ signal }) => deliveriesApi.qc(id, signal) });

// ------------------------------------------------------------------------------------------------ items

export const DeliveryItemsPanel: React.FC<{ delivery: Delivery }> = ({ delivery }) => {
  const canEdit = useCan('delivery.update') && isEditable(delivery.status);
  const write = useDeliveryWrite();
  const qc = useDeliveryQc(delivery.id);
  const [versionId, setVersionId] = useState<string | null>(null);
  const checked = new Set((qc.data ?? []).map((c) => c.item).filter(Boolean));
  const items = delivery.versions;
  const sent = delivery.sent_at !== null;
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-80">
            {/* Only published versions of this project can be delivered; the server also checks that they have registered files. */}
            <VersionPicker label="Add a published version" value={versionId} onChange={setVersionId} filters={{ project_id: delivery.project ?? '', is_published: true }} disabled={!delivery.project} />
          </div>
          <Button size="sm" variant="primary" disabled={!versionId} onClick={async () => (await write(() => deliveriesApi.addVersion(delivery.id, versionId as string))) && setVersionId(null)}>
            Add version
          </Button>
        </div>
      )}
      {sent && <p className="text-xs text-slate-400">This delivery was sent. Its items and files are a frozen record of what the client was given.</p>}
      {items.length === 0 ? (
        <Empty>No versions yet. Add the published versions the client should receive.</Empty>
      ) : (
        <ul aria-label="Delivery items" className="space-y-2">
          {items.map((item) => (
            <ItemRow key={item.uid} item={item} canRemove={canEdit && !checked.has(item.uid)} checked={checked.has(item.uid)} canEdit={canEdit} onRemove={() => write(() => deliveriesApi.removeVersion(delivery.id, item.uid), removeItemMessage)} />
          ))}
        </ul>
      )}
    </div>
  );
};

const ItemRow: React.FC<{ item: DeliveryItem; canRemove: boolean; checked: boolean; canEdit: boolean; onRemove: () => void }> = ({ item, canRemove, checked, canEdit, onRemove }) => {
  const label = `${item.entity_code || item.entity_name || 'Version'} ${item.version_number}`.trim();
  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/versions/${item.version_id}`} className="font-semibold text-cyan-300 hover:underline">
          {label}
        </Link>
        <span className="text-slate-400">
          {item.files.length} file{item.files.length === 1 ? '' : 's'} · {formatBytes(item.file_size_bytes)}
        </span>
        <span className="flex-1" />
        {canEdit &&
          (canRemove ? (
            <button type="button" aria-label={`Remove ${label}`} className="text-rose-400 hover:text-rose-300" onClick={onRemove}>
              Remove
            </button>
          ) : checked ? (
            <span className="text-[11px] text-slate-500" title="Quality checks have run on this item">
              Checked: cannot be removed
            </span>
          ) : null)}
      </div>
      {item.files.length > 0 && (
        <details className="mt-2 text-[11px] text-slate-400">
          <summary className="cursor-pointer">Files</summary>
          <ul className="mt-1 space-y-1 font-mono">
            {item.files.map((f) => (
              <li key={`${f.storage_root_code}:${f.relative_path}`} className="break-all">
                {f.storage_root_code}:{f.relative_path} <span className="text-slate-500">· {f.role} · {formatBytes(f.size_bytes)} · {f.sha256.slice(0, 12)}…</span>
                {f.frozen_at && <span className="text-slate-500"> · frozen</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
};

// ------------------------------------------------------------------------------------------------ checks

const outcomeVariant = (outcome: string) => (outcome === 'pass' ? 'success' : outcome === 'fail' ? 'destructive' : 'neutral');

export const DeliveryChecksPanel: React.FC<{ delivery: Delivery }> = ({ delivery }) => {
  const qc = useDeliveryQc(delivery.id);
  const names = new Map(delivery.versions.map((i) => [i.uid, `${i.entity_code || 'Version'} ${i.version_number}`.trim()]));
  const runs = new Map<string, DeliveryQCCheck[]>();
  for (const row of qc.data ?? []) runs.set(row.run_id, [...(runs.get(row.run_id) ?? []), row]);
  const ordered = [...runs.values()].sort((a, b) => b[0].checked_at.localeCompare(a[0].checked_at));
  return (
    <QueryBoundary isLoading={qc.isLoading} error={qc.error} onRetry={() => void qc.refetch()} entityName="quality checks" isEmpty={ordered.length === 0} empty={{ title: 'No checks have run', description: 'Validate or prepare the delivery to run the quality checks.' }}>
      <div className="space-y-4">
        {ordered.map((rows, index) => (
          <section key={rows[0].run_id} aria-label={index === 0 ? 'Latest check run' : 'Earlier check run'} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <h3 className="mb-2 flex flex-wrap items-center gap-2 font-semibold text-slate-200">
              {index === 0 ? 'Latest run' : 'Earlier run'}
              <span className="font-normal text-slate-500">
                {formatWhen(rows[0].checked_at)} · <UserName id={rows[0].checked_by} />
              </span>
              {rows.some((r) => r.outcome === 'fail') && <Badge variant="destructive">Failed</Badge>}
            </h3>
            <ul className="space-y-1">
              {rows.map((r, i) => (
                <li key={`${r.check_name}-${r.item}-${i}`} className="flex flex-wrap items-center gap-2">
                  <Badge variant={outcomeVariant(r.outcome)}>{r.outcome === 'not_checked' ? 'not checked' : r.outcome}</Badge>
                  <span className="text-slate-200">{checkLabel(r.check_name)}</span>
                  {r.item && <span className="text-slate-500">· {names.get(r.item) ?? 'an item'}</span>}
                  {r.detail && <span className="text-slate-400">· {r.detail}</span>}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </QueryBoundary>
  );
};

// ------------------------------------------------------------------------------------------------ history

export const DeliveryHistoryPanel: React.FC<{ delivery: Delivery }> = ({ delivery }) => {
  const rows = useQuery({ queryKey: [...deliveriesApi.keys.detail(delivery.id), 'history'], queryFn: ({ signal }) => deliveriesApi.history(delivery.id, signal) });
  const newestFirst = [...(rows.data ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <QueryBoundary isLoading={rows.isLoading} error={rows.error} onRetry={() => void rows.refetch()} entityName="history" isEmpty={newestFirst.length === 0} empty={{ title: 'No history yet', description: 'Every move between statuses is listed here.' }}>
      <ol aria-label="Status history" className="space-y-2">
        {newestFirst.map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-200">
              <span>{row.from_status ? deliveryStatusLabel(row.from_status) : 'Created'}</span>
              <span aria-label="to">→</span>
              <span className="font-semibold">{deliveryStatusLabel(row.to_status)}</span>
              {row.override_kind && <Badge variant="warning">{row.override_kind.replace(/_/g, ' ')}</Badge>}
              <span className="ml-auto text-[11px] text-slate-500">
                <UserName id={row.actor} /> · {formatWhen(row.at)}
              </span>
            </div>
            {row.reason && <p className="mt-1 text-[11px] text-slate-400">{row.reason}</p>}
          </li>
        ))}
      </ol>
    </QueryBoundary>
  );
};

// ------------------------------------------------------------------------------------------------ details

/** The passcode is never in a response: holders of `delivery.view_secret` fetch it on request, and every read is audited. */
const PasscodeBox: React.FC<{ delivery: Delivery }> = ({ delivery }) => {
  const canSee = useCan('delivery.view_secret');
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!delivery.has_passcode) return <>None set</>;
  if (!canSee) return <>Set. Only people allowed to see secrets can read it.</>;
  if (value !== null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <code aria-label="Passcode" className="rounded bg-slate-950 px-2 py-0.5 text-slate-100">
          {value}
        </code>
        <Button size="sm" variant="outline" onClick={() => setValue(null)}>
          Hide
        </Button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            setValue((await deliveriesApi.passcode(delivery.id)).passcode);
          } catch (error) {
            notify.error(deliveryErrorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        Show passcode
      </Button>
      <span className="text-[11px] text-slate-500">Viewing it is logged.</span>
    </span>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-200 break-words">{children}</dd>
  </div>
);

export const DeliveryDetailsPanel: React.FC<{ delivery: Delivery }> = ({ delivery: d }) => (
  <dl aria-label="Delivery details" className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
    <Fact label="Project">{d.project_name || '—'}</Fact>
    <Fact label="Client">{d.client_name || '—'}</Fact>
    <Fact label="Method">{d.delivery_method}</Fact>
    <Fact label="Destination">{d.destination_name ? `${d.destination_name}${d.delivery_destination ? ` · ${d.delivery_destination}` : ''}` : d.delivery_destination || '—'}</Fact>
    <Fact label="Passcode">
      <PasscodeBox delivery={d} />
    </Fact>
    <Fact label="Due">{d.expires_at ? new Date(d.expires_at).toLocaleDateString() : '—'}</Fact>
    <Fact label="Size">{formatBytes(d.total_size_bytes)}</Fact>
    <Fact label="Items">{d.versions.length}</Fact>
    <Fact label="Signed off">{d.signed_off_at ? <>{formatWhen(d.signed_off_at)} · <UserName id={d.signed_off_by} /></> : '—'}</Fact>
    <Fact label="Sent">{d.sent_at ? <>{formatWhen(d.sent_at)}{d.transfer_reference ? ` · ref ${d.transfer_reference}` : ''}</> : '—'}</Fact>
    <Fact label="Client answered">{d.client_answered_at ? <>{d.client_status} · {formatWhen(d.client_answered_at)} · <UserName id={d.client_answered_by} /></> : d.client_status}</Fact>
    {d.revision_of && (
      <Fact label="Revision of">
        <Link to={`/deliveries/${d.revision_of}`} className="text-cyan-300 hover:underline">
          the rejected delivery
        </Link>
      </Fact>
    )}
    {d.rejection_reason && <Fact label="Why the client rejected it">{d.rejection_reason}</Fact>}
    {d.cancellation_reason && <Fact label="Why it was cancelled">{d.cancellation_reason}</Fact>}
    {d.notes && <Fact label="Internal notes">{d.notes}</Fact>}
    {d.client_notes && <Fact label="Client notes">{d.client_notes}</Fact>}
    {d.checksums.manifest_sha256 && (
      <Fact label="Manifest checksum">
        <code className="break-all text-[11px]">{d.checksums.manifest_sha256}</code>
      </Fact>
    )}
  </dl>
);
