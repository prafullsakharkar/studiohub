import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useMemo, useState } from 'react';
import type { BulkBatchResponse } from '@/api/production/bulkRoutes';
import { serverMessage } from '@/api/errors/serverMessage';
import { formatNumber } from '@/core/locale/studioLocale';
import { BulkImportGrid } from '@/shared/components/bulk/BulkImportGrid';
import type { GridColumn } from '@/shared/components/bulk/BulkImportGrid';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { downloadCsv } from '@/shared/data/exportAll';
import { MAX_FILE_BYTES, errorReportCsv, readRows, rowReports, templateCsv, toCreateItems, toUpdateItems } from './rows';
import type { RowOutcome, SheetRow } from './rows';
import { columnsFor } from './specs';
import type { BulkSpec } from './specs';

export type BulkMode = 'create' | 'update';

interface BulkImportDialogProps {
  spec: BulkSpec;
  mode: BulkMode;
  projectId: string;
  projectCode: string;
  episodic: boolean;
  onClose: () => void;
}

const OUTCOME_LABEL: Record<RowOutcome, string> = { create: 'Create', update: 'Update', skip: 'Skip', error: 'Error' };
const OUTCOME_CLASS: Record<RowOutcome, string> = {
  create: 'text-emerald-400',
  update: 'text-sky-400',
  skip: 'text-slate-400',
  error: 'text-rose-400',
};

/**
 * Bulk create or update of one entity in one project from a CSV file or rows pasted into the grid (CR-48). The rows are
 * checked first by a dry run on the backend (the same serializers, validators and scope as a single write), the outcome
 * is shown per row, and only then stored. By default all or nothing; "Skip invalid rows" stores the others.
 */
export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({ spec, mode, projectId, projectCode, episodic, onClose }) => {
  const queryClient = useQueryClient();
  const columns = useMemo(() => columnsFor(spec, { episodic, mode }), [spec, episodic, mode]);
  const gridColumns: GridColumn[] = columns.map((c) => ({ key: c.header, label: c.header, type: c.type === 'number' ? 'number' : 'text', required: c.required, placeholder: c.type === 'date' ? 'YYYY-MM-DD' : undefined }));
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [check, setCheck] = useState<BulkBatchResponse | null>(null);
  const [result, setResult] = useState<BulkBatchResponse | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const verb = mode === 'create' ? 'Create' : 'Update';
  const title = `Bulk ${mode} ${spec.plural} · ${projectCode}`;
  const fileStem = `${projectCode.toLowerCase()}-${spec.plural}-${mode}`;

  const take = (text: string) => {
    const read = readRows(text, columns);
    setProblems(read.problems);
    setRows(read.problems.length ? [] : read.rows);
    setCheck(null);
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setProblems([`The file is larger than ${formatNumber(MAX_FILE_BYTES / 1024 / 1024)} MB. Split it into several files.`]);
      return;
    }
    take(await file.text());
  };

  const send = async (dryRun: boolean) => {
    const options = { dry_run: dryRun, atomic: dryRun ? true : !skipInvalid };
    return mode === 'create'
      ? spec.routes.create(projectId, toCreateItems(rows, columns), options)
      : spec.routes.update(projectId, toUpdateItems(rows, columns), options);
  };

  const run = async (dryRun: boolean) => {
    setBusy(true);
    setFailure(null);
    try {
      const response = await send(dryRun);
      if (dryRun) setCheck(response);
      else {
        setResult(response);
        if (response.committed) await queryClient.invalidateQueries({ queryKey: spec.queryKey });
      }
    } catch (error) {
      setFailure(serverMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reports = check ? rowReports(check, columns) : [];
  const failed = reports.filter((r) => r.outcome === 'error').length;
  const writable = reports.filter((r) => r.outcome === 'create' || r.outcome === 'update').length;
  const canCommit = Boolean(check) && writable > 0 && (failed === 0 || skipInvalid);

  const footer = result ? (
    <Button size="sm" onClick={onClose}>
      Done
    </Button>
  ) : check ? (
    <>
      <Button size="sm" variant="ghost" onClick={() => setCheck(null)} disabled={busy}>
        Back to the rows
      </Button>
      <Button size="sm" onClick={() => run(false)} disabled={!canCommit || busy}>
        {verb} {formatNumber(writable)} {writable === 1 ? spec.noun : spec.plural}
      </Button>
    </>
  ) : (
    <>
      <Button size="sm" variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button size="sm" onClick={() => run(true)} disabled={rows.length === 0 || busy}>
        Check rows
      </Button>
    </>
  );

  return (
    <Modal isOpen onClose={onClose} size="2xl" title={title} subtitle={subtitleFor(mode, spec)} footer={footer}>
      <div className="space-y-4 text-sm">
        {failure && (
          <p role="alert" className="text-rose-300">
            {failure}
          </p>
        )}

        {result ? (
          <ResultView spec={spec} result={result} onReport={() => downloadCsv(`${fileStem}-errors.csv`, errorReportCsv(result, rows, columns))} />
        ) : check ? (
          <>
            <p>
              {formatNumber(writable)} of {formatNumber(reports.length)} rows can be {mode === 'create' ? 'created' : 'updated'}
              {failed ? `; ${formatNumber(failed)} cannot.` : '.'} Nothing has been stored yet.
            </p>
            <div className="max-h-80 overflow-auto border border-slate-800 rounded-lg">
              <table aria-label="Checked rows" className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 sticky top-0">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {reports.map((report, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no other identity; the list does not reorder
                    <tr key={index}>
                      <td className="px-3 py-1.5 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-1.5">{String(rows[index]?.code ?? '')}</td>
                      <td className={`px-3 py-1.5 ${OUTCOME_CLASS[report.outcome]}`}>{OUTCOME_LABEL[report.outcome]}</td>
                      <td className="px-3 py-1.5 text-slate-300">{report.messages.join(' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {failed > 0 && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} />
                Skip invalid rows and {mode} the others
              </label>
            )}
            {failed > 0 && (
              <Button size="sm" variant="outline" onClick={() => downloadCsv(`${fileStem}-errors.csv`, errorReportCsv(check, rows, columns))}>
                Download error report
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span>CSV file</span>
                <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" aria-label="CSV file" onChange={onFile} className="text-xs" />
              </label>
              <Button size="sm" variant="outline" onClick={() => downloadCsv(`${fileStem}-template.csv`, templateCsv(columns))}>
                Download template
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Columns: {columns.map((c) => `${c.header}${c.required ? ' (required)' : ''}`).join(', ')}. Parents are written by code. An empty cell
              {mode === 'update' ? ' leaves the field as it is' : ' takes the default'}. At most 500 rows at a time.
            </p>
            {problems.length > 0 && (
              <ul role="alert" className="list-disc pl-5 text-rose-300">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            <BulkImportGrid columns={gridColumns} rows={rows} onChange={(next) => {
                setRows(next);
                setCheck(null);
              }}
              onPaste={take}
            />
          </>
        )}
      </div>
    </Modal>
  );
};

function subtitleFor(mode: BulkMode, spec: BulkSpec): string {
  return mode === 'create'
    ? `New ${spec.plural} from a CSV file or rows pasted from a spreadsheet. A code already in the project is refused.`
    : `Existing ${spec.plural}, found by their code in this project. Only the filled-in columns change.`;
}

const ResultView: React.FC<{ spec: BulkSpec; result: BulkBatchResponse; onReport: () => void }> = ({ spec, result, onReport }) => {
  const stored = result.committed ? result.successful : 0;
  return (
    <div className="space-y-3">
      <p role="status">
        {result.committed
          ? `${formatNumber(stored)} ${stored === 1 ? spec.noun : spec.plural} stored${result.failed ? `; ${formatNumber(result.failed)} rows were not.` : '.'}`
          : `Nothing was stored: ${formatNumber(result.failed)} rows failed. Check the rows again.`}
      </p>
      {result.errors.length > 0 && (
        <Button size="sm" variant="outline" onClick={onReport}>
          Download error report
        </Button>
      )}
    </div>
  );
};
