import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { InputError } from '@/api/errors/serverMessage';
import { deliveriesApi } from '@/api/deliveries/deliveries';
import type { Delivery } from '@/api/deliveries/deliveries';
import { deliveryActionsFrom, isEditable, requiredPermission } from '@/api/deliveries/deliveryFlow';
import type { DeliveryAction } from '@/api/deliveries/deliveryFlow';
import { EntityHistory } from '@/components/history/EntityHistory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { AuthContext } from '@/core/auth/AuthContext';
import { evaluateAccess } from '@/core/permissions/access';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { DeliveryChecksPanel, DeliveryDetailsPanel, DeliveryHistoryPanel, DeliveryItemsPanel, useRefreshDeliveries } from './DeliveryPanels';
import { clientAnswer, DeliveryStatusBadge } from './deliveries';
import { deliveryErrorMessage } from './errors';
import { formatBytes, formatDay } from './format';

type TabId = 'items' | 'checks' | 'history' | 'details' | 'changes';
const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'items', label: 'Items' },
  { id: 'checks', label: 'Quality checks' },
  { id: 'history', label: 'Status history' },
  { id: 'details', label: 'Details' },
  { id: 'changes', label: 'Changes' },
];

/** Calls the action with what the dialog collected; `revise` answers the new draft. */
const call = (action: DeliveryAction['action'], id: string, text: string) => {
  const t = text.trim() || undefined;
  switch (action) {
    case 'validate':
      return deliveriesApi.validate(id);
    case 'retry':
      return deliveriesApi.retry(id);
    case 'prepare':
      return deliveriesApi.prepare(id);
    case 'signOff':
      return deliveriesApi.signOff(id, t);
    case 'reopen':
      return deliveriesApi.reopen(id);
    case 'submit':
      return deliveriesApi.submit(id, t);
    case 'approve':
      return deliveriesApi.approve(id, t);
    case 'reject':
      return deliveriesApi.reject(id, text.trim());
    case 'complete':
      return deliveriesApi.complete(id);
    case 'cancel':
      return deliveriesApi.cancel(id, t);
    case 'revise':
      return deliveriesApi.revise(id);
  }
};

const DeliveryActions: React.FC<{ delivery: Delivery; onChecksRun: () => void }> = ({ delivery, onChecksRun }) => {
  const user = useContext(AuthContext)?.user ?? null;
  const navigate = useNavigate();
  const refresh = useRefreshDeliveries();
  const [pending, setPending] = useState<DeliveryAction | null>(null);
  const [text, setText] = useState('');
  // Only what this status allows and this caller holds the code for; the server still decides (separation of duties, a lost race).
  const offered = deliveryActionsFrom(delivery.status).filter((a) => evaluateAccess(user, requiredPermission(a, delivery.status), {}));
  if (offered.length === 0) return null;
  return (
    <>
      <div role="toolbar" aria-label="Delivery actions" className="flex flex-wrap gap-2">
        {offered.map((a) => (
          <Button
            key={a.action}
            size="sm"
            variant={a.action === 'submit' || a.action === 'signOff' || a.action === 'prepare' ? 'primary' : a.destructive ? 'outline' : 'secondary'}
            onClick={() => {
              setText('');
              setPending(a);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? `${pending.label}: ${delivery.code}` : ''}
        confirmLabel={pending?.label ?? 'Confirm'}
        destructive={pending?.destructive}
        message={
          <>
            <p>{pending?.confirm}</p>
            {pending?.ask && (
              <label className="mt-3 block text-xs text-slate-400">
                {pending.ask.label}
                {pending.ask.required ? ' *' : ''}
                <textarea aria-label={pending.ask.label} rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </label>
            )}
          </>
        }
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.ask?.required && !text.trim()) throw new InputError(`${pending.ask.label.replace(/ \(.*/, '')} is required.`);
          let result: unknown;
          try {
            result = await call(pending.action, delivery.id, text);
          } catch (error) {
            await refresh(); // a refused prepare still recorded its check run
            // Thrown so the dialog stays open with the specific reason (a failed check, separation of duties, a status that moved on).
            throw new InputError(deliveryErrorMessage(error));
          }
          await refresh();
          if (pending.action === 'validate' || pending.action === 'retry') onChecksRun();
          if (pending.action === 'revise') navigate(`/deliveries/${(result as { id: string }).id}`);
        }}
      />
    </>
  );
};

export const DeliveryWorkspace: React.FC = () => {
  const { deliveryId = '' } = useParams();
  const canEdit = useCan('delivery.update');
  const [tab, setTab] = useState<TabId>('items');
  const query = useQuery({ queryKey: deliveriesApi.keys.detail(deliveryId), queryFn: ({ signal }) => deliveriesApi.get(deliveryId, signal), enabled: Boolean(deliveryId) });
  const d = query.data;
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="delivery">
        {d && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/deliveries" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Deliveries
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {d.code} · {d.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  {[d.project_name, d.client_name, d.delivery_method, d.expires_at ? `due ${formatDay(d.expires_at)}` : '', `${d.versions.length} item${d.versions.length === 1 ? '' : 's'}, ${formatBytes(d.total_size_bytes)}`].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <div className="flex items-center gap-2">
                  <DeliveryStatusBadge status={d.status} />
                  {clientAnswer(d.client_status) !== '—' && <span className="text-[11px] text-slate-400">Client: {clientAnswer(d.client_status)}</span>}
                </div>
                <DeliveryActions delivery={d} onChecksRun={() => setTab('checks')} />
                {canEdit && isEditable(d.status) && (
                  <Link to={`/deliveries/${d.id}/edit`} className="text-xs text-cyan-300 hover:underline">
                    Edit details
                  </Link>
                )}
              </div>
            </div>

            {d.has_revoked_content && (
              <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
                A file in this delivery was revoked after it was sent. What the client received is unchanged, but it should be looked at.
              </p>
            )}
            {d.status === 'Rejected' && d.rejection_reason && (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">The client rejected this delivery: {d.rejection_reason}</p>
            )}

            <div role="tablist" aria-label="Delivery sections" className="flex flex-wrap gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'items' && <DeliveryItemsPanel delivery={d} />}
            {tab === 'checks' && <DeliveryChecksPanel delivery={d} />}
            {tab === 'history' && <DeliveryHistoryPanel delivery={d} />}
            {tab === 'details' && <DeliveryDetailsPanel delivery={d} />}
            {tab === 'changes' && <EntityHistory targetType="DeliveryPackage" targetId={d.id} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
