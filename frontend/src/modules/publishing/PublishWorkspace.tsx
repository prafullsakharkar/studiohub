import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { publishApi } from '@/api/publishing/publishing';
import type { Publish } from '@/api/publishing/publishing';
import { jobActionsFrom, isJobEditable } from '@/api/publishing/publishingFlow';
import type { JobAction } from '@/api/publishing/publishingFlow';
import { EntityHistory } from '@/components/history/EntityHistory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { formatWhen } from '@/modules/deliveries/format';
import { ActionBar } from './ActionBar';
import { JobStatusBadge } from './jobs';

type TabId = 'details' | 'validation' | 'changes';
const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'validation', label: 'Validation' },
  { id: 'changes', label: 'Changes' },
];

const call = (job: Publish, a: JobAction, text: string) => {
  const t = text || undefined;
  switch (a.action) {
    case 'validate':
      return publishApi.validate(job.id);
    case 'startExport':
      return publishApi.startExport(job.id);
    case 'completeExport':
      return publishApi.completeExport(job.id);
    case 'fail':
      return publishApi.fail(job.id, text);
    case 'retry':
      return publishApi.retry(job.id);
    case 'unpublish':
      return publishApi.unpublish(job.id, t);
    case 'republish':
      return publishApi.republish(job.id, t);
  }
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-200 break-words">{children}</dd>
  </div>
);

export const DetailsPanel: React.FC<{ job: Publish }> = ({ job: j }) => (
  <dl aria-label="Job details" className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
    <Fact label="Project">{j.project_name || '—'}</Fact>
    <Fact label="For">{`${j.entity_type_display || j.entity_type} ${j.entity_code}`.trim() || '—'}</Fact>
    <Fact label="Tool">{`${j.dcc_tool_display}${j.dcc_version ? ` ${j.dcc_version}` : ''}`}</Fact>
    <Fact label="Source file">{j.source_file || '—'}</Fact>
    <Fact label="Source version">{j.source_version || '—'}</Fact>
    <Fact label="Export path">{j.export_path || '—'}</Fact>
    <Fact label="Format">{j.export_format || '—'}</Fact>
    <Fact label="Retries">{j.retry_count}</Fact>
    <Fact label="Updated">{formatWhen(j.updated_at)}</Fact>
    {Object.keys(j.export_options ?? {}).length > 0 && (
      <Fact label="Export options">
        <code className="text-[11px] break-all">{JSON.stringify(j.export_options)}</code>
      </Fact>
    )}
    {j.error_message && <Fact label="Why it failed">{j.error_message}</Fact>}
  </dl>
);

export const ValidationPanel: React.FC<{ job: Publish }> = ({ job }) => {
  const result = job.validation_results ?? {};
  const counts = result.counts;
  if (!counts) return <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">This job has not been validated yet.</p>;
  const checked = counts.passed + counts.failed + counts.warning + counts.not_checked;
  return (
    <section aria-label="Validation result" className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
      <p className="text-slate-200">
        Last validated {formatWhen(result.checked_at)}: {result.passed ? 'no blocking rule failed' : 'a blocking rule failed'}.
      </p>
      {checked === 0 ? (
        <p className="text-amber-300">No validation rules are configured, so nothing was checked. The job passes because nothing could fail.</p>
      ) : (
        <p className="text-slate-400">
          {counts.passed} passed · {counts.failed} failed · {counts.warning} warning · {counts.not_checked} not checked
        </p>
      )}
    </section>
  );
};

export const PublishWorkspace: React.FC = () => {
  const { publishId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = useCan('publishing.update');
  const [tab, setTab] = useState<TabId>('details');
  const query = useQuery({ queryKey: publishApi.keys.detail(publishId), queryFn: ({ signal }) => publishApi.get(publishId, signal), enabled: Boolean(publishId) });
  const job = query.data;
  const refresh = () => Promise.all([publishApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="export job">
        {job && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/publishing" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Publishing
                </Link>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {job.code} · {job.name}
                </h1>
                <p className="text-xs text-slate-400 mt-1">{[job.project_name, `${job.entity_type_display || job.entity_type} ${job.entity_code}`.trim(), job.dcc_tool_display].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <JobStatusBadge status={job.job_status} />
                <ActionBar
                  name="Job actions"
                  subject={job.code}
                  actions={jobActionsFrom(job.job_status)}
                  primary={['validate', 'startExport', 'completeExport']}
                  run={async (a, text) => {
                    const result = await call(job, a, text);
                    await refresh();
                    if (a.action === 'validate') setTab('validation');
                    if (a.action === 'republish') navigate(`/publishing/${(result as Publish).id}`);
                  }}
                />
                {canEdit && isJobEditable(job.job_status) && (
                  <Link to={`/publishing/${job.id}/edit`} className="text-xs text-cyan-300 hover:underline">
                    Edit details
                  </Link>
                )}
              </div>
            </div>
            {job.job_status === 'Failed' && job.error_message && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">The export failed: {job.error_message}</p>}

            <div role="tablist" aria-label="Job sections" className="flex flex-wrap gap-1 border-b border-slate-800">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab === 'details' && <DetailsPanel job={job} />}
            {tab === 'validation' && <ValidationPanel job={job} />}
            {tab === 'changes' && <EntityHistory targetType="PublishItem" targetId={job.id} />}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};
