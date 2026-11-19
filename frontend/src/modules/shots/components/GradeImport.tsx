import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { serverMessage } from '@/api/errors/serverMessage';
import { reviewCopiesApi } from '@/api/production/review';
import { shotsApi } from '@/api/production/work';
import type { GradeImport as GradeImportResult } from '@/api/production/work';
import { Dialog } from '@/components/ui/Dialog';
import { formatNumber } from '@/core/locale/studioLocale';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { gradeText } from '@/modules/production/work/ShotGradeField';
import { Button } from '@/shared/components/Button';

const shots = (n: number) => `${formatNumber(n)} ${n === 1 ? 'shot' : 'shots'}`;

/** What an EDL or ALE counts in (RP-22): its events or its rows; null for a CDL file. */
const unitOf = (fileName: string): 'event' | 'row' | null => {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.edl') ? 'event' : lower.endsWith('.ale') ? 'row' : null;
};
const counted = (n: number, word: string) => `${formatNumber(n)} ${word}${n === 1 ? '' : 's'}`;

/** What the dry run found (C-RP-54, C-RP-55), one sentence. */
export function importSummary(r: GradeImportResult): string {
  const unit = unitOf(r.file_name);
  const parts = [`${counted(r.corrections, unit ? `graded ${unit}` : 'correction')} in ${r.file_name}.`];
  if (unit && r.ungraded) parts.push(`${counted(r.ungraded, unit)} without a grade.`);
  parts.push(r.matched.length ? `${shots(r.matched.length)} would get a new grade.` : 'No shot would get a new grade.');
  if (r.unchanged.length) parts.push(`${shots(r.unchanged.length)} already ${r.unchanged.length === 1 ? 'has' : 'have'} it.`);
  if (r.unmatched.length) parts.push(`${formatNumber(r.unmatched.length)} match no shot you may change.`);
  if (r.invalid.length) parts.push(`${formatNumber(r.invalid.length)} cannot be used.`);
  return parts.join(' ');
}

/**
 * "Import grades…" for one project (RP-20, C-RP-54): choose a client's `.cc`, `.ccc` or `.cdl` file, or a cut's EDL or a
 * dailies ALE (RP-22, C-RP-55), read what a dry run
 * would change, then apply it, which writes every matched shot or none. Shown with `shot.update` in that project (the
 * server refuses the rest, and matches only the shots the caller may update).
 */
export const GradeImport: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const allowed = useCan('shot.update', { projectId });
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<GradeImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!projectId || !allowed) return null;

  const close = () => {
    setOpen(false);
    setFile(null);
    setResult(null);
    setProblem(null);
  };
  const run = async (chosen: File, dryRun: boolean) => {
    setBusy(true);
    setProblem(null);
    try {
      const answer = await shotsApi.importGrades(projectId, chosen, dryRun);
      if (dryRun) {
        setResult(answer);
        return;
      }
      notify.success(`Grades of ${shots(answer.applied)} imported from ${answer.file_name}.`);
      await queryClient.invalidateQueries({ queryKey: shotsApi.keys.all });
      await queryClient.invalidateQueries({ queryKey: reviewCopiesApi.keys.of(projectId) });
      close();
    } catch (error) {
      setResult(null);
      setProblem(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Import grades…
      </Button>
      {open && (
        <Dialog
          isOpen
          onClose={close}
          size="2xl"
          title="Import shot grades"
          subtitle="A client's .cc, .ccc or .cdl file, or an EDL or ALE with ASC_SOP and ASC_SAT. Each correction's id, or each event's or row's names in turn, is matched to a shot code, with or without the project's code before it."
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!file || !result?.matched.length || busy} onClick={() => file && run(file, false)}>
                {result?.matched.length ? `Apply to ${shots(result.matched.length)}` : 'Apply'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <label className="block text-xs text-slate-300">
              Grade file
              <input
                type="file"
                accept=".cc,.ccc,.cdl,.edl,.ale"
                className="mt-1 block text-xs text-slate-300"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setFile(chosen);
                  setResult(null);
                  if (chosen) void run(chosen, true);
                }}
              />
            </label>
            {busy && <p className="text-xs text-slate-400">Reading the file…</p>}
            {problem && (
              <p role="alert" className="text-xs text-rose-300">
                {problem}
              </p>
            )}
            {result && (
              <div className="space-y-2">
                <p className="text-slate-200">{importSummary(result)}</p>
                {result.matched.length > 0 && (
                  <ul aria-label="New grades" className="max-h-56 overflow-auto space-y-1 text-xs text-slate-300">
                    {result.matched.map((m) => (
                      <li key={m.shot.id}>
                        <span className="font-mono">{m.shot.code}</span>
                        {m.id !== m.shot.code && <span className="text-slate-500"> (from {m.id})</span>}: {gradeText(m.new)}
                        {m.old ? <span className="text-slate-500"> · was {gradeText(m.old)}</span> : <span className="text-slate-500"> · had none</span>}
                      </li>
                    ))}
                  </ul>
                )}
                {result.unmatched.length > 0 && (
                  <p className="text-xs text-amber-300">
                    No shot: <span className="font-mono">{result.unmatched.join('; ')}</span>
                  </p>
                )}
                {result.invalid.length > 0 && (
                  <ul aria-label="Corrections that cannot be used" className="text-xs text-rose-300 space-y-1">
                    {result.invalid.map((i) => (
                      <li key={`${i.id}-${i.field}-${i.message}`}>
                        <span className="font-mono">{i.id || '(no id)'}</span>: {i.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
};
