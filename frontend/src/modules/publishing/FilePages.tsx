import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { serverMessage } from '@/api/errors/serverMessage';
import { publishedFilesApi } from '@/api/publishing/publishing';
import type { BulkRegisterResult, PublishedFile, PublishedFileInput } from '@/api/publishing/publishing';
import { fileActionsFrom } from '@/api/publishing/publishingFlow';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { formatBytes, formatWhen } from '@/modules/deliveries/format';
import { Button } from '@/shared/components/Button';
import { ActionBar } from './ActionBar';
import { ChecksumBadge, FileStatusBadge, frames } from './files';

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-slate-200 break-words">{children}</dd>
  </div>
);

/** One registered file: where it is, its checksum, its state, and the lifecycle actions the caller may take. */
export const PublishedFilePage: React.FC = () => {
  const { fileId = '' } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: publishedFilesApi.keys.detail(fileId), queryFn: ({ signal }) => publishedFilesApi.get(fileId, signal), enabled: Boolean(fileId) });
  const file = query.data;
  return (
    <div className="p-4 sm:p-6 space-y-5 w-full">
      <QueryBoundary isLoading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} entityName="published file">
        {file && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <Link to="/publishing/files" className="text-[11px] text-slate-500 hover:text-slate-300">
                  ← Published files
                </Link>
                <h1 className="text-lg font-bold text-white tracking-tight font-mono break-all">{file.relative_path}</h1>
                <p className="text-xs text-slate-400 mt-1">
                  {file.storage_root} · {file.role}
                </p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2">
                <div className="flex items-center gap-2">
                  <FileStatusBadge status={file.status} />
                  <ChecksumBadge state={file.checksum_state} />
                </div>
                <ActionBar
                  name="File actions"
                  subject={file.relative_path}
                  actions={fileActionsFrom(file.status)}
                  run={async (a, text) => {
                    if (a.action === 'deprecate') await publishedFilesApi.deprecate(file.id, text || undefined);
                    else if (a.action === 'restore') await publishedFilesApi.restore(file.id);
                    else await publishedFilesApi.revoke(file.id, text);
                    await queryClient.invalidateQueries({ queryKey: publishedFilesApi.keys.all });
                  }}
                />
              </div>
            </div>
            {file.status === 'Revoked' && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">This file was revoked{file.revoke_reason ? `: ${file.revoke_reason}` : '.'} It cannot be delivered, and its path cannot be registered again.</p>}
            <dl aria-label="File details" className="grid gap-x-6 gap-y-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Fact label="Version">
                <Link to={`/versions/${file.version_id}`} className="text-cyan-300 hover:underline">
                  Open the version
                </Link>
              </Fact>
              <Fact label="Size">{formatBytes(file.size_bytes)}</Fact>
              <Fact label="Frames">{frames(file) || 'A single file'}</Fact>
              <Fact label="File type">{file.file_type || '—'}</Fact>
              <Fact label="Checksum checked">{file.checksum_checked_at ? formatWhen(file.checksum_checked_at) : 'Never: the checksum is as declared'}</Fact>
              <Fact label="Status changed">{formatWhen(file.status_changed_at)}</Fact>
              <Fact label="Registered">{formatWhen(file.created_at)}</Fact>
              {file.export_job_id && (
                <Fact label="Export job">
                  <Link to={`/publishing/${file.export_job_id}`} className="text-cyan-300 hover:underline">
                    Open the job
                  </Link>
                </Fact>
              )}
              <Fact label="SHA-256">
                <code className="break-all text-[11px]">{file.sha256}</code>
              </Fact>
            </dl>
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

/** Register many files at once from a pipeline manifest: a JSON array of the same bodies the single form takes. */
export const BulkRegisterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState('');
  const [result, setResult] = useState<BulkRegisterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setProblem('');
    setResult(null);
    let items: unknown;
    try {
      items = JSON.parse(text);
    } catch {
      setProblem('That is not valid JSON.');
      return;
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      setProblem('Give a JSON array of 1 to 100 files.');
      return;
    }
    setBusy(true);
    try {
      setResult(await publishedFilesApi.bulkRegister(items as PublishedFileInput[]));
      await queryClient.invalidateQueries({ queryKey: publishedFilesApi.keys.all });
    } catch (error) {
      notify.error(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="p-4 sm:p-6 space-y-4 w-full max-w-3xl">
      <div className="pb-3 border-b border-slate-800">
        <Link to="/publishing/files" className="text-[11px] text-slate-500 hover:text-slate-300">
          ← Published files
        </Link>
        <h1 className="text-xl font-bold text-white tracking-tight">Register many files</h1>
        <p className="text-xs text-slate-400 mt-1">Paste a JSON array of up to 100 files: version_id, storage_root (a code), relative_path, size_bytes, sha256, and optionally role, file_type, frame_start, frame_end. Each file succeeds or fails on its own.</p>
      </div>
      <label className="block text-xs text-slate-400">
        Files (JSON)
        <textarea aria-label="Files (JSON)" rows={12} spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} className="mt-1 block w-full font-mono bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
      </label>
      {problem && <p role="alert" className="text-xs text-rose-400">{problem}</p>}
      <Button variant="primary" isLoading={busy} onClick={() => void submit()}>
        Register
      </Button>
      {result && (
        <section aria-label="Result" className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
          <p className="text-slate-200">
            {result.succeeded_count} registered{result.failed_count > 0 ? `, ${result.failed_count} refused` : ''}.
          </p>
          <ul className="space-y-1">
            {result.results.map((r) => (
              <li key={r.index} className={r.ok ? 'text-emerald-300' : 'text-rose-300'}>
                #{r.index + 1}: {r.ok ? 'registered' : `${r.error ?? 'refused'}${r.fields ? ` — ${Object.entries(r.fields).map(([k, v]) => `${k}: ${v.join(' ')}`).join('; ')}` : ''}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
