import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { reviewMediaApi } from '@/api/production/review';
import { publishedFilesApi } from '@/api/publishing/publishing';
import type { PublishedFile } from '@/api/publishing/publishing';
import { formatNumber } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { Button } from '@/shared/components/Button';
import { fetchAllRows } from '@/shared/data/listing';

/** The roles a review copy can be read from (RP-17, Q-RP-77): the file itself or its proxy. */
const ROLES = new Set(['main', 'proxy']);

/** The files of a version a review copy could be read from, in the order the server lists them: no thumbnails, sidecars or revoked files. */
export function copyCandidates(files: readonly PublishedFile[]): PublishedFile[] {
  return files.filter((f) => ROLES.has(f.role) && f.status !== 'Revoked');
}

/** One file as the picker shows it: its path, its frames, and its checksum when it was never checked. */
export function candidateText(file: PublishedFile): string {
  const parts = [file.relative_path];
  if (file.frame_start !== null && file.frame_end !== null) parts.push(`frames ${file.frame_start}–${file.frame_end} (${formatNumber(file.frame_end - file.frame_start + 1)})`);
  if (file.role === 'proxy') parts.push('proxy');
  if (file.checksum_state === 'declared') parts.push('checksum not checked yet');
  return parts.join(' · ');
}

/**
 * Make the version's review copy from one of its published files, read where it lies on studio storage (RP-17,
 * C-RP-44): the version's files are listed when the picker opens (`publishing.view`), each with why it cannot be used
 * when the server says so (`review_copy_refusal`). The rights are the upload's (C-RP-26); the server checks them again.
 */
export const ReviewFromPublishedFile: React.FC<{
  versionId: string;
  colorSpace: string;
  disabled: boolean;
  /** The panel's runner: shows the label while it runs, the server's reason when it fails, and refreshes the version. */
  run: (label: string, action: () => Promise<unknown>) => Promise<void>;
}> = ({ versionId, colorSpace, disabled, run }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: [...publishedFilesApi.keys.all, 'review-copy-candidates', versionId],
    queryFn: ({ signal }) => fetchAllRows(publishedFilesApi.list, { version_id: versionId }, { signal }),
    enabled: open,
  });
  const candidates = copyCandidates(data ?? []);

  const make = (file: PublishedFile) =>
    run('Queuing…', async () => {
      await reviewMediaApi.fromPublishedFile(file.id, colorSpace);
      notify.success(`The review copy is being made from ${file.relative_path.split('/').pop()}.`);
      setOpen(false);
    });

  return (
    <>
      <Button size="sm" variant="ghost" aria-expanded={open} disabled={disabled} title="Read a file this version published, where it lies on studio storage: nothing is uploaded" onClick={() => setOpen((o) => !o)}>
        From a published file
      </Button>
      {open && (
        <section aria-label="Published files of this version" className="w-full space-y-1 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
          {isLoading && <p className="text-slate-400">Reading the version's published files…</p>}
          {error ? <p className="text-rose-300">The published files could not be read.</p> : null}
          {data && candidates.length === 0 && <p className="text-slate-400">This version has no published movie, still or frames to read.</p>}
          <ul className="space-y-1">
            {candidates.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono break-all text-slate-300">{candidateText(file)}</span>
                {file.review_copy_refusal ? (
                  <span className="text-amber-300">{file.review_copy_refusal}</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => void make(file)}>
                    Make the copy
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};
