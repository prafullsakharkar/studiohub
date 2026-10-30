import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { workflowsApi } from '@/api/production/review';
import type { Workflow, WorkflowSimulation } from '@/api/production/review';
import { EntityHistory } from '@/components/history/EntityHistory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

const text = (value: unknown) => (value === undefined || value === null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value));

export const WorkflowWorkspace: React.FC = () => {
  const { workflowId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useCan('workflow.update');
  const canCreate = useCan('workflow.create');
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState<WorkflowSimulation | null>(null);
  const query = useQuery({ queryKey: workflowsApi.keys.detail(workflowId), queryFn: ({ signal }) => workflowsApi.get(workflowId, signal), enabled: Boolean(workflowId) });
  const workflow = query.data;
  const run = async <T,>(action: () => Promise<T>, then?: (result: T) => void) => {
    setBusy(true);
    try {
      const result = await action();
      await Promise.all([workflowsApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      then?.(result);
    } catch (error) {
      notify.error(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const label = (w: Workflow, id: unknown) => {
    const node = w.nodes.find((n) => n.id === id);
    return node?.label ? `${String(node.label)} (${String(id)})` : text(id);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="workflow">
        {workflow && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/workflows" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Workflows
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {workflow.code} · {workflow.name}
                </h1>
                {workflow.description && <p className="text-xs text-slate-400 mt-1">{workflow.description}</p>}
                <p className="text-[11px] text-slate-500 mt-1">
                  {[workflow.category, workflow.department].filter(Boolean).join(' · ') || 'No category'}. Stored only: nothing executes this graph yet.
                </p>
              </div>
              <div role="toolbar" aria-label="Workflow actions" className="flex flex-wrap items-center gap-2">
                {workflow.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>}
                {canUpdate && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => (workflow.is_active ? workflowsApi.deactivate(workflow.id) : workflowsApi.activate(workflow.id)))}>
                    {workflow.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                )}
                {canCreate && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => workflowsApi.clone(workflow.id), (copy) => navigate(`/workflows/${copy.id}`))}>
                    Clone
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => workflowsApi.simulate(workflow.id), setDryRun)}>
                  Dry run
                </Button>
                {canUpdate && (
                  <Link to={`/workflows/${workflow.id}/edit`}>
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {dryRun && (
              <section aria-label="Dry run result" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
                <p className="text-amber-300">Dry run only lists the stored nodes. Nothing is evaluated, so every node is reported as a success whatever the graph says.</p>
                <ul className="text-slate-300">
                  {dryRun.steps.map((step) => (
                    <li key={step.node}>
                      {step.node}: {step.status}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section aria-label="Nodes" className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-200">Nodes ({workflow.nodes.length})</h2>
              {workflow.nodes.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No nodes. Edit the workflow to add them.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="py-1 pr-3">Id</th>
                      <th className="py-1 pr-3">Label</th>
                      <th className="py-1">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workflow.nodes.map((node, index) => (
                      <tr key={`${text(node.id)}-${index}`} className="border-t border-slate-800 text-slate-300">
                        <td className="py-1 pr-3 font-mono">{text(node.id)}</td>
                        <td className="py-1 pr-3">{text(node.label)}</td>
                        <td className="py-1">{text(node.type)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section aria-label="Transitions" className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-200">Transitions ({workflow.transitions.length})</h2>
              {workflow.transitions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No transitions.</p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-300">
                  {workflow.transitions.map((t, index) => (
                    <li key={`${text(t.from)}-${text(t.to)}-${index}`}>
                      {label(workflow, t.from)} → {label(workflow, t.to)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <EntityHistory targetType="Workflow" targetId={workflow.id} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
