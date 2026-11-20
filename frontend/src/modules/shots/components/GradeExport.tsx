import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { serverMessage } from '@/api/errors/serverMessage';
import { projectsApi } from '@/api/production/structure';
import { gradeExportName, shotsApi } from '@/api/production/work';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { SequencePicker } from '@/modules/production/work/pickers';
import { Button } from '@/shared/components/Button';

/**
 * "Export grades…" for one project (RP-27, C-RP-62): the graded shots the caller reads, or one sequence's, as a `.ccc` that
 * grading tools and *Import grades…* read. Shown with `shot.view` in that project; a vendor member gets their tasks' shots.
 */
export const GradeExport: React.FC<{ projectId: string | undefined }> = ({ projectId }) => {
  const allowed = useCan('shot.view', { projectId });
  const [open, setOpen] = useState(false);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const project = useQuery({ queryKey: projectsApi.keys.detail(projectId ?? ''), queryFn: ({ signal }) => projectsApi.get(projectId as string, signal), enabled: Boolean(projectId) && allowed && open });
  if (!projectId || !allowed) return null;

  const close = () => {
    setOpen(false);
    setSequenceId(null);
    setProblem(null);
  };
  const run = async (code: string) => {
    setBusy(true);
    setProblem(null);
    try {
      await shotsApi.exportGrades(projectId, code, sequenceId ?? undefined);
      notify.success(`Grades exported as ${gradeExportName(code)}.`);
      close();
    } catch (error) {
      setProblem(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const code = project.data?.code;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Export grades…
      </Button>
      {open && (
        <Dialog
          isOpen
          onClose={close}
          title="Export shot grades"
          subtitle="The graded shots you can see, as a .ccc file: each correction's id is the shot's code. Shots without a grade are left out."
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!code || busy} onClick={() => code && run(code)}>
                {busy ? 'Exporting…' : 'Export'}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <SequencePicker label="Sequence (leave empty for the whole project)" value={sequenceId} onChange={setSequenceId} filters={{ project_id: projectId }} />
            {code && <p className="text-xs text-slate-400">Saved as {gradeExportName(code)}.</p>}
            {problem && (
              <p role="alert" className="text-xs text-rose-300">
                {problem}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
};
