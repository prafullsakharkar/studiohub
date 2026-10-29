import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { assetsApi, shotsApi, taskTemplatesApi, tasksApi } from '@/api/production/work';
import type { Asset, Shot, ShotAssetLink, Task } from '@/api/production/work';
import { EntityHistory } from '@/components/history/EntityHistory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { StatusHistory } from './StatusHistory';
import { StatusMenu } from './StatusMenu';
import { formatHours } from './format';
import { AssetPicker } from './pickers';

/** The record a panel belongs to: a shot or an asset, with the project the new tasks go into. */
export interface WorkTarget {
  type: 'Shot' | 'Asset';
  id: string;
  code: string;
  projectId: string;
}

/** Applies a task template to one shot or asset: the template's tasks are created once, and repeats report what exists. */
const ApplyTemplate: React.FC<{ target: WorkTarget; onDone: () => void }> = ({ target, onDone }) => {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const templates = useQuery({ queryKey: [...taskTemplatesApi.keys.lists(), 'for', target.type, target.projectId], queryFn: ({ signal }) => taskTemplatesApi.list({ entity_type: target.type, is_active: true, project_id: target.projectId, page_size: 100 }, signal), enabled: open });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Apply template
      </Button>
      <ConfirmDialog
        isOpen={open}
        title={`Apply a template to ${target.code}`}
        confirmLabel="Apply"
        onClose={() => {
          setOpen(false);
          setTemplateId('');
        }}
        message={
          <label className="block text-xs text-slate-400">
            Template
            <select aria-label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
              <option value="">{templates.isLoading ? 'Loading…' : 'Choose…'}</option>
              {(templates.data?.results ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.scope}, {t.items.length} task{t.items.length === 1 ? '' : 's'})
                </option>
              ))}
            </select>
          </label>
        }
        onConfirm={async () => {
          if (!templateId) throw new Error('Choose a template.');
          const result = await taskTemplatesApi.apply(templateId, { project_id: target.projectId, entity_id: target.id });
          notify.success(result.created.length > 0 ? `Created ${result.created.length} task${result.created.length === 1 ? '' : 's'}${result.existing.length ? `; ${result.existing.length} already existed` : ''}.` : `Nothing new: ${result.existing.length} task${result.existing.length === 1 ? '' : 's'} from this template already exist.`);
          onDone();
        }}
      />
    </>
  );
};

/** Tasks about one shot or asset, with the status menu and the way to add more (one, or a template's worth). */
export const EntityTasksPanel: React.FC<{ target: WorkTarget }> = ({ target }) => {
  const canCreate = useCan('task.create');
  const canUpdate = useCan('task.update');
  const canSeeTemplates = useCan('tasktemplate.view');
  const canApply = canCreate && canSeeTemplates;
  const linkFilter = target.type === 'Shot' ? { shot_id: target.id } : { asset_id: target.id };
  const list = usePaginatedList<Task>({ queryKey: [...tasksApi.keys.lists(), 'for', target.type, target.id], fetchPage: tasksApi.list, filters: linkFilter, ordering: 'code' });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Tasks on {target.code}</h2>
        <div className="flex gap-2">
          {canApply && <ApplyTemplate target={target} onDone={() => void list.refetch()} />}
          {canCreate && (
            <Link to={`/tasks/new?project=${target.projectId}&entity_type=${target.type}&entity_id=${target.id}`}>
              <Button size="sm" variant="primary">
                New task
              </Button>
            </Link>
          )}
        </div>
      </div>
      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="tasks" isEmpty={list.rows.length === 0} empty={{ title: 'No tasks yet', description: `Tasks about ${target.code} show here. Add one, or apply a template for the usual set.` }}>
        <table aria-label={`Tasks on ${target.code}`} className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-3">Task</th>
              <th className="py-1 pr-3">Assignee</th>
              <th className="py-1 pr-3">Hours</th>
              <th className="py-1">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {list.rows.map((task) => (
              <tr key={task.id}>
                <td className="py-1.5 pr-3">
                  <Link to={`/tasks/${task.id}`} className="font-semibold text-cyan-300 hover:underline">
                    {task.code} · {task.title}
                  </Link>
                </td>
                <td className="py-1.5 pr-3">{task.assignee_name || '—'}</td>
                <td className="py-1.5 pr-3">
                  {formatHours(task.logged_hours)} / {formatHours(task.estimated_hours)}
                </td>
                <td className="py-1.5">
                  <StatusMenu entity="task" status={task.status} name={task.code} canChange={canUpdate} change={(next) => tasksApi.update(task.id, { status: next })} invalidate={[tasksApi.keys.all]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueryBoundary>
    </div>
  );
};

/** The assets a shot uses, with quantity and notes; linking needs `shot.update`. */
export const ShotAssetsPanel: React.FC<{ shot: Pick<Shot, 'id' | 'code' | 'project_id'> }> = ({ shot }) => {
  const queryClient = useQueryClient();
  const canLink = useCan('shot.update');
  const key = [...shotsApi.keys.detail(shot.id), 'assets'];
  const links = useQuery({ queryKey: key, queryFn: ({ signal }) => shotsApi.assets(shot.id, signal) });
  const [assetId, setAssetId] = useState<string | null>(null);
  const [unlink, setUnlink] = useState<ShotAssetLink | null>(null);
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: key }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  const link = useMutation({
    mutationFn: () => shotsApi.linkAsset(shot.id, { asset_id: assetId as string }),
    onSuccess: async () => {
      setAssetId(null);
      await refresh();
    },
    onError: (error) => notify.error(serverMessage(error)),
  });
  const quantity = useMutation({
    mutationFn: ({ link: l, value }: { link: ShotAssetLink; value: number }) => shotsApi.updateAssetLink(shot.id, l.asset_id, { quantity: value }),
    onSuccess: refresh,
    onError: (error) => notify.error(serverMessage(error)),
  });
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Assets used by {shot.code}</h2>
      {canLink && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-72">
            <AssetPicker label="Link an asset" value={assetId} onChange={setAssetId} filters={{ project_id: shot.project_id }} />
          </div>
          <Button size="sm" variant="primary" disabled={!assetId} isLoading={link.isPending} onClick={() => link.mutate()}>
            Link asset
          </Button>
        </div>
      )}
      <QueryBoundary isLoading={links.isLoading} error={links.error} onRetry={() => void links.refetch()} entityName="linked assets" isEmpty={(links.data ?? []).length === 0} empty={{ title: 'No assets linked', description: 'Link the characters, props and environments this shot uses.' }}>
        <table aria-label={`Assets used by ${shot.code}`} className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-3">Asset</th>
              <th className="py-1 pr-3">Category</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1 pr-3">Qty</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {(links.data ?? []).map((l) => (
              <tr key={l.id}>
                <td className="py-1.5 pr-3">
                  <Link to={`/assets/${l.asset_id}`} className="font-semibold text-cyan-300 hover:underline">
                    {l.asset_code} · {l.asset_name}
                  </Link>
                  {l.notes && <span className="ml-2 text-slate-500">{l.notes}</span>}
                </td>
                <td className="py-1.5 pr-3">{l.asset_category}</td>
                <td className="py-1.5 pr-3">
                  <Badge variant="outline">{l.asset_status}</Badge>
                </td>
                <td className="py-1.5 pr-3">
                  {canLink ? <input type="number" min={1} aria-label={`Quantity of ${l.asset_code}`} defaultValue={l.quantity} onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== l.quantity && quantity.mutate({ link: l, value: Number(e.target.value) })} className="w-16 bg-slate-950 border border-slate-800 rounded px-2 py-1" /> : l.quantity}
                </td>
                <td className="py-1.5 text-right">
                  {canLink && (
                    <button type="button" className="text-rose-400 hover:text-rose-300" aria-label={`Unlink ${l.asset_code}`} onClick={() => setUnlink(l)}>
                      Unlink
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </QueryBoundary>
      <ConfirmDialog
        isOpen={unlink !== null}
        title={`Unlink ${unlink?.asset_code ?? ''}`}
        message={`Remove ${unlink?.asset_code} from ${shot.code}? The asset itself is not deleted.`}
        confirmLabel="Unlink"
        destructive
        onClose={() => setUnlink(null)}
        onConfirm={async () => {
          if (!unlink) return;
          await shotsApi.unlinkAsset(shot.id, unlink.asset_id);
          await refresh();
        }}
      />
    </div>
  );
};

/** The shots an asset appears in (read-only: links are made from the shot). */
export const AssetShotsPanel: React.FC<{ asset: Pick<Asset, 'id' | 'code'> }> = ({ asset }) => {
  const shots = useQuery({ queryKey: [...assetsApi.keys.detail(asset.id), 'shots'], queryFn: ({ signal }) => assetsApi.shots(asset.id, signal) });
  return (
    <QueryBoundary isLoading={shots.isLoading} error={shots.error} onRetry={() => void shots.refetch()} entityName="shots" isEmpty={(shots.data ?? []).length === 0} empty={{ title: 'Not used in any shot', description: 'Shots that use this asset are listed here. Link it from the shot’s Assets tab.' }}>
      <table aria-label={`Shots using ${asset.code}`} className="w-full text-xs">
        <thead className="text-left text-slate-400">
          <tr>
            <th className="py-1 pr-3">Shot</th>
            <th className="py-1 pr-3">Status</th>
            <th className="py-1">Qty</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {(shots.data ?? []).map((l) => (
            <tr key={l.id}>
              <td className="py-1.5 pr-3">
                <Link to={`/shots/${l.shot_id}`} className="font-semibold text-cyan-300 hover:underline">
                  {l.shot_code}
                  {l.shot_name ? ` · ${l.shot_name}` : ''}
                </Link>
              </td>
              <td className="py-1.5 pr-3">{l.shot_status}</td>
              <td className="py-1.5">{l.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </QueryBoundary>
  );
};

/** Status moves (shots have a history route; assets do not) and the field-level change log. */
export const WorkHistoryPanel: React.FC<{ targetType: 'Shot' | 'Asset'; id: string }> = ({ targetType, id }) => (
  <div className="space-y-5">
    {targetType === 'Shot' && (
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-white">Status history</h2>
        <StatusHistory queryKey={[...shotsApi.keys.detail(id), 'status-history']} fetch={(signal) => shotsApi.statusHistory(id, signal)} />
      </section>
    )}
    <section className="space-y-2">
      <EntityHistory targetType={targetType} targetId={id} title="Changes" />
    </section>
  </div>
);
