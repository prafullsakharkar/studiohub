import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useId, useState } from 'react';
import { reviewMediaApi } from '@/api/production/review';
import type { ReviewFromStorageInput, Version } from '@/api/production/review';
import { projectsApi } from '@/api/production/structure';
import { useCan } from '@/core/permissions/useCan';
import { notify } from '@/core/notifications/notify';
import { Button } from '@/shared/components/Button';

/** A frame pattern in a file name (`%04d`, `####`), as the server reads one (C-RP-48). */
const PATTERN = /%0\dd|#+/;

/** Whether `path` names a frame pattern, so the range is asked for. */
export function isFramePattern(path: string): boolean {
  return PATTERN.test(path.split('/').pop() ?? '');
}

/** The file name a path ends with, for the notice. */
function fileName(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * What is sent (C-RP-48): the path as typed, the range only for a frame pattern, the colour space when one is chosen.
 * Returns a message instead when the range is missing or runs backwards; the server checks everything again.
 */
export function storageBody(path: string, first: string, last: string, colorSpace: string): ReviewFromStorageInput | { message: string } {
  const trimmed = path.trim();
  if (!trimmed) return { message: 'Name the render, relative to the project’s review folder.' };
  const body: ReviewFromStorageInput = { path: trimmed };
  if (isFramePattern(trimmed)) {
    if (first.trim() === '' || last.trim() === '') return { message: 'A frame pattern needs its first and last frame.' };
    const from = Number(first);
    const to = Number(last);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) return { message: 'The range runs from the first frame up to the last, from 0.' };
    body.first_frame = from;
    body.last_frame = to;
  }
  if (colorSpace) body.color_space = colorSpace;
  return body;
}

/**
 * Make the review copy of a version still in review from a render in its project's review folder on studio storage
 * (RP-18, C-RP-48): nothing is uploaded or published. The path is relative to the folder; a frame pattern takes the range,
 * filled from the version's frames. Those who may change the project see the folder itself (Q-RP-86); the rights are
 * the upload's (C-RP-26), and the server checks the path against the folder again.
 */
export const ReviewFromStorage: React.FC<{
  version: Version;
  colorSpace: string;
  disabled: boolean;
  /** The panel's runner: shows the label while it runs, the server's reason when it fails, and refreshes the version. */
  run: (label: string, action: () => Promise<unknown>) => Promise<void>;
}> = ({ version, colorSpace, disabled, run }) => {
  const [open, setOpen] = useState(false);
  const pathId = useId();
  const [path, setPath] = useState('');
  const [first, setFirst] = useState(version.start_frame === null ? '' : String(version.start_frame));
  const [last, setLast] = useState(version.end_frame === null ? '' : String(version.end_frame));
  const [problem, setProblem] = useState<string | null>(null);
  const canSeeFolder = useCan('project.update', { projectId: version.project_id });
  const project = useQuery({
    queryKey: projectsApi.keys.detail(version.project_id),
    queryFn: ({ signal }) => projectsApi.get(version.project_id, signal),
    enabled: open && canSeeFolder,
  });
  const root = project.data?.review_source_root ?? '';
  const folder = project.data?.review_source_folder ?? '';
  const pattern = isFramePattern(path);

  const make = () => {
    const body = storageBody(path, first, last, colorSpace);
    if ('message' in body) {
      setProblem(body.message);
      return;
    }
    setProblem(null);
    void run('Queuing…', async () => {
      await reviewMediaApi.fromStorage(version.id, body);
      notify.success(`The review copy is being made from ${fileName(body.path)}.`);
      setOpen(false);
      setPath('');
    });
  };

  return (
    <>
      <Button size="sm" variant="ghost" aria-expanded={open} disabled={disabled} title="Read a render from the project's review folder on studio storage, before approval: nothing is uploaded" onClick={() => setOpen((o) => !o)}>
        From studio storage
      </Button>
      {open && (
        <section aria-label="Render on studio storage" className="w-full space-y-2 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs">
          {canSeeFolder && project.data && !folder ? (
            <p className="text-amber-300">This project has no review folder on studio storage. Set one on the project's edit page.</p>
          ) : (
            <p className="text-slate-400">The render's path, relative to the project's review folder. A sequence names its frames with a pattern, for example sh010_comp_v003.%04d.exr.</p>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              make();
            }}
          >
            <div className="flex min-w-[16rem] flex-1 flex-col gap-1 text-slate-300">
              <label htmlFor={pathId}>Path</label>
              <span className="flex items-center gap-1">
                {canSeeFolder && folder && (
                  <span className="font-mono text-slate-500" data-testid="review-folder">
                    {root}:{folder}/
                  </span>
                )}
                <input
                  id={pathId}
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-slate-200"
                  placeholder="sh010/comp/v003/sh010_comp_v003.%04d.exr"
                />
              </span>
            </div>
            {pattern && (
              <>
                <label className="flex w-24 flex-col gap-1 text-slate-300">
                  First frame
                  <input type="number" min={0} value={first} onChange={(e) => setFirst(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200" />
                </label>
                <label className="flex w-24 flex-col gap-1 text-slate-300">
                  Last frame
                  <input type="number" min={0} value={last} onChange={(e) => setLast(e.target.value)} className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200" />
                </label>
              </>
            )}
            <Button size="sm" variant="outline" type="submit" disabled={disabled}>
              Make the copy
            </Button>
          </form>
          {problem && (
            <p role="alert" className="text-rose-300">
              {problem}
            </p>
          )}
        </section>
      )}
    </>
  );
};
