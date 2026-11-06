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
import { ResultBanner, RowsLog, SummaryCards } from './BatchReport';
import { MAX_FILE_BYTES, byCode, changedRows, errorReportCsv, logCsv, readRows, rowReports, templateCsv, toCreateItems, toUpdateItems } from './rows';
import type { RowReport, SheetRow } from './rows';
import { columnsFor } from './specs';
import type { BulkMode, BulkSpec } from './specs';
import { currentRows, exampleRows, templateParents } from './template';

export type { BulkMode } from './specs';

interface BulkImportDialogProps {
  spec: BulkSpec;
  mode: BulkMode;
  /** The project the rows go to; until there is one only `projectPicker` is shown. */
  projectId?: string;
  projectCode?: string;
  episodic: boolean;
  /** Where the project is chosen, when the list is not on one project. */
  projectPicker?: React.ReactNode;
  /** Why the chosen project cannot take the rows (no permission there); nothing else is shown. */
  blocked?: string;
  onClose: () => void;
}


/**
 * Bulk create or update of one entity in one project from a CSV file or rows pasted into the grid (CR-48). The rows are
 * checked first by a dry run on the backend (the same serializers, validators and scope as a single write), the outcome
 * is shown per row, and only then stored. By default all or nothing; "Skip invalid rows" stores the others.
 */
export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({ spec, mode, projectId, projectCode, episodic, projectPicker, blocked, onClose }) => {
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
  /** The rows "Load template" put in an update, by code: cells left as loaded are not sent. */
  const [loaded, setLoaded] = useState<Map<string, SheetRow> | null>(null);
  /** The rows the check was sent for (an update from a loaded template leaves out the unchanged ones). */
  const [sent, setSent] = useState<SheetRow[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const verb = mode === 'create' ? 'Create' : 'Update';
  const title = projectCode ? `Bulk ${mode} ${spec.plural} · ${projectCode}` : `Bulk ${mode} ${spec.plural}`;
  const fileStem = `${(projectCode ?? 'project').toLowerCase()}-${spec.plural}-${mode}`;

  const fill = (next: SheetRow[], from: Map<string, SheetRow> | null) => {
    setRows(next);
    setLoaded(from);
    setCheck(null);
  };

  const take = (text: string) => {
    const read = readRows(text, columns);
    setProblems(read.problems);
    setNote(null);
    fill(read.problems.length ? [] : read.rows, null);
  };

  const loadTemplate = async () => {
    if (!projectId) return;
    setBusy(true);
    setFailure(null);
    setProblems([]);
    setNote(null);
    try {
      if (mode === 'create') {
        fill(exampleRows(spec, columns, await templateParents(spec, projectId, episodic)), null);
        setNote('Example rows: change the codes and names, then check them.');
      } else {
        const current = await currentRows(spec, columns, projectId, episodic);
        if (current.rows.length === 0) setProblems([`The project has no ${spec.plural} yet.`]);
        else {
          fill(current.rows, byCode(current.rows, columns));
          setNote(
            current.total > current.rows.length
              ? `The first ${formatNumber(current.rows.length)} of ${formatNumber(current.total)} ${spec.plural}. Change the cells to update; rows left as they are are not sent.`
              : `The project's ${formatNumber(current.rows.length)} ${spec.plural}. Change the cells to update; rows left as they are are not sent.`
          );
        }
      }
    } catch (error) {
      setFailure(serverMessage(error));
    } finally {
      setBusy(false);
    }
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

  const send = async (dryRun: boolean, batch: SheetRow[], project: string) => {
    const options = { dry_run: dryRun, atomic: dryRun ? true : !skipInvalid };
    return mode === 'create'
      ? spec.routes.create(project, toCreateItems(batch, columns), options)
      : spec.routes.update(project, toUpdateItems(batch, columns), options);
  };

  const run = async (dryRun: boolean) => {
    if (!projectId) return;
    const batch = dryRun ? (loaded ? changedRows(rows, columns, loaded) : rows) : sent;
    if (batch.length === 0) {
      setProblems(['No cell differs from the loaded rows: there is nothing to update.']);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const response = await send(dryRun, batch, projectId);
      if (dryRun) {
        setSent(batch);
        setCheck(response);
      }
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
          <ResultView
            spec={spec}
            mode={mode}
            result={result}
            reports={rowReports(result, columns)}
            codes={sent.map((row) => String(row.code ?? ''))}
            onReport={() => downloadCsv(`${fileStem}-errors.csv`, errorReportCsv(result, sent, columns))}
            onLog={() => downloadCsv(`${fileStem}-log.csv`, logCsv(rowReports(result, columns), sent, columns, result.committed))}
          />
        ) : check ? (
          <>
            <p>
              {formatNumber(writable)} of {formatNumber(reports.length)} rows can be {mode === 'create' ? 'created' : 'updated'}
              {failed ? `; ${formatNumber(failed)} cannot.` : '.'} Nothing has been stored yet.
              {sent.length < rows.length ? ` ${formatNumber(rows.length - sent.length)} unchanged rows are left out.` : ''}
            </p>
            <SummaryCards spec={spec} mode={mode} reports={reports} stage="check" />
            <RowsLog title="Planned batch" label="Checked rows" mode={mode} reports={reports} codes={sent.map((row) => String(row.code ?? ''))} stage="check" />
            {failed > 0 && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={skipInvalid} onChange={(e) => setSkipInvalid(e.target.checked)} />
                Skip invalid rows and {mode} the others
              </label>
            )}
            {failed > 0 && (
              <Button size="sm" variant="outline" onClick={() => downloadCsv(`${fileStem}-errors.csv`, errorReportCsv(check, sent, columns))}>
                Download error report
              </Button>
            )}
          </>
        ) : (
          <>
            {projectPicker && <div className="max-w-sm">{projectPicker}</div>}
            {blocked ? (
              <p role="alert" className="text-rose-300">
                {blocked}
              </p>
            ) : !projectId ? (
              <p className="text-slate-400">Choose the project the {spec.plural} belong to.</p>
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
              <Button
                size="sm"
                variant="outline"
                onClick={loadTemplate}
                disabled={busy || rows.length > 0}
                title={rows.length > 0 ? 'Clear the grid first' : mode === 'create' ? 'Fill the grid with example rows' : `Fill the grid with the project's ${spec.plural}`}
              >
                Load template
              </Button>
            </div>
            {note && <p className="text-xs text-slate-300">{note}</p>}
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
                if (next.length === 0) {
                  setLoaded(null);
                  setNote(null);
                }
              }}
              onPaste={take}
            />
          </>
            )}
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

const ResultView: React.FC<{
  spec: BulkSpec;
  mode: BulkMode;
  result: BulkBatchResponse;
  reports: readonly RowReport[];
  codes: readonly string[];
  onReport: () => void;
  onLog: () => void;
}> = ({ spec, mode, result, reports, codes, onReport, onLog }) => {
  const stage = result.committed ? 'stored' : 'rolled-back';
  return (
    <div className="space-y-4">
      <ResultBanner spec={spec} reports={reports} committed={result.committed} successful={result.successful} failed={result.failed} />
      <SummaryCards spec={spec} mode={mode} reports={reports} stage={stage} />
      <RowsLog title="Execution log" label="Stored rows" mode={mode} reports={reports} codes={codes} stage={stage} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onLog}>
          Download log
        </Button>
        {result.errors.length > 0 && (
          <Button size="sm" variant="outline" onClick={onReport}>
            Download error report
          </Button>
        )}
      </div>
    </div>
  );
};
