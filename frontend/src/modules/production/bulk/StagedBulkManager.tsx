import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Layers } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { serverMessage } from '@/api/errors/serverMessage';
import { formatNumber } from '@/core/locale/studioLocale';
import { BulkImportGrid } from '@/shared/components/bulk/BulkImportGrid';
import type { GridColumn } from '@/shared/components/bulk/BulkImportGrid';
import { BulkOperationEngine } from '@/shared/components/bulk/BulkOperationEngine';
import { BulkOperationPreview } from '@/shared/components/bulk/BulkOperationPreview';
import { BulkOperationResult } from '@/shared/components/bulk/BulkOperationResult';
import { BulkValidationSummary } from '@/shared/components/bulk/BulkValidationSummary';
import { ExistingEntityResolver } from '@/shared/components/bulk/ExistingEntityResolver';
import { SoftDeletedEntityRecovery } from '@/shared/components/bulk/SoftDeletedEntityRecovery';
import type { BulkOperationResponse, BulkOperationSummary, EntityResolutionItem, EntityResolutionState, ResolutionUserAction } from '@/shared/components/bulk/types';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';
import { PROJECT_QUERY_KEYS } from '../hooks/useProjects';
import { MAX_FILE_BYTES, readRows, rowReports, toCreateItems } from './rows';
import type { SheetRow } from './rows';
import { columnsFor } from './specs';
import type { BulkSpec } from './specs';
import { exampleRows, templateParents } from './template';

interface StagedBulkManagerProps {
  spec: BulkSpec;
  projectId: string;
  projectCode: string;
  episodic: boolean;
  onClose: () => void;
}

type Step = 'GRID' | 'VALIDATING' | 'RECOVERY_PROMPT' | 'RESOLVE' | 'PREVIEW' | 'EXECUTING' | 'RESULT';
type Item = EntityResolutionItem<object> & { data: Record<string, unknown>; row: SheetRow };

const title = (word: string) => `${word[0].toUpperCase()}${word.slice(1)}`;

/**
 * "Bulk add" for sequences, assets and tasks, in the steps of the shot manager (`ShotBulkManager`): fill the grid (paste,
 * a CSV file or Load Template) → Validate → archived rows: recover or skip → Resolve (the breakdown: new, soft-deleted,
 * active existing, batch duplicates, errors; per row create, skip or recover) → Preview → Execute → Result.
 *
 * Validate finds a code twice in the batch, asks the backend which codes exist or are archived (`check-existence`),
 * and dry-runs the new rows (`bulk-create` with `dry_run`) so a row the backend would refuse (an unknown parent, a bad
 * status) is an error here, before anything is stored. Execute stores row by row, as the shot manager does.
 */
export const StagedBulkManager: React.FC<StagedBulkManagerProps> = ({ spec, projectId, projectCode, episodic, onClose }) => {
  const Noun = title(spec.noun);
  const columns = useMemo(() => columnsFor(spec, { episodic, mode: 'create' }), [spec, episodic]);
  const gridColumns: GridColumn[] = columns.map((c) => ({
    key: c.header,
    label: c.label,
    type: c.options ? 'select' : c.type === 'number' ? 'number' : 'text',
    options: c.options ? [...c.options] : undefined,
    required: c.required,
    placeholder: c.type === 'date' ? 'YYYY-MM-DD' : undefined,
  }));
  const { checkExistence, bulkCreate, isBulkCreating } = useBulkEntity<object>({
    service: spec.staged,
    queryKeyAll: spec.queryKey,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    labels: { singular: Noun, plural: spec.plural, creationNoun: 'Creation' },
  });
  // Load Template: example rows built on the project's own parents (see template.ts).
  const parents = useQuery({
    queryKey: ['bulk-template', spec.noun, projectId, episodic],
    queryFn: ({ signal }) => templateParents(spec, projectId, episodic, signal),
    staleTime: 60_000,
  });

  const [step, setStep] = useState<Step>('GRID');
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeFilter, setActiveFilter] = useState<EntityResolutionState | 'ALL'>('ALL');
  const [response, setResponse] = useState<BulkOperationResponse<object> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const take = (text: string) => {
    const read = readRows(text, columns);
    setProblems(read.problems);
    if (!read.problems.length) setRows(read.rows);
  };
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) setProblems([`The file is larger than ${formatNumber(MAX_FILE_BYTES / 1024 / 1024)} MB. Split it into several files.`]);
    else take(await file.text());
  };

  const validate = async () => {
    const filled = rows.filter((r) => String(r.code ?? '').trim());
    if (filled.length === 0) return;
    setFailure(null);
    setStep('VALIDATING');
    try {
      const wire = toCreateItems(filled, columns);
      const { items: analyzed } = BulkOperationEngine.analyzeRequestDuplicates(filled, (r) => String(r.code ?? ''));
      let next: Item[] = analyzed.map((it, index) => ({
        ...it,
        name: String(filled[index].name ?? filled[index].title ?? ''),
        proposedData: { name: filled[index].name ?? filled[index].title },
        data: wire[index].data,
        row: filled[index],
      }));

      const fresh = next.filter((it) => it.state === 'NEW');
      if (fresh.length > 0) {
        const existence = await checkExistence({ project_id: projectId, codes: fresh.map((it) => it.code) });
        next = next.map((it) => {
          if (it.state !== 'NEW') return it;
          const match = existence.items.find((s) => s.code.toUpperCase() === it.code);
          if (!match || match.state === 'NEW') return it;
          return {
            ...it,
            state: match.state,
            existingEntity: match.existing_entity,
            message: match.message,
            userAction: match.state === 'SOFT_DELETED' ? 'recover' : 'skip',
          };
        });
      }

      // The new rows as the backend would create them: its refusals become errors now, not after Execute.
      const toCheck = next.filter((it) => it.state === 'NEW');
      if (toCheck.length > 0) {
        const dryRun = await spec.routes.create(
          projectId,
          toCheck.map((it) => ({ code: it.code, action: 'create', data: it.data })),
          { dry_run: true, atomic: false }
        );
        const reports = rowReports(dryRun, columns);
        const verdict = new Map(toCheck.map((it, index) => [it, { report: reports[index], status: dryRun.results[index]?.status }]));
        next = next.map((it) => {
          const v = verdict.get(it);
          if (!v?.report || v.report.outcome !== 'error') return it;
          if (v.status === 'exists') return { ...it, state: 'EXISTS', userAction: 'skip', message: v.report.messages.join(' ') };
          return { ...it, state: 'INVALID', userAction: 'skip', errors: v.report.messages.length ? v.report.messages : ['The backend refused this row.'] };
        });
      }

      setItems(next);
      setActiveFilter('ALL');
      setStep(next.some((it) => it.state === 'SOFT_DELETED') ? 'RECOVERY_PROMPT' : 'RESOLVE');
    } catch (error) {
      setFailure(serverMessage(error));
      setStep('GRID');
    }
  };

  const count = (state: string) => items.filter((it) => it.state === state).length;
  const summary: BulkOperationSummary = {
    total: items.length,
    newCount: count('NEW'),
    softDeletedCount: count('SOFT_DELETED'),
    existingCount: count('EXISTS'),
    duplicateCount: count('DUPLICATE_IN_REQUEST'),
    invalidCount: count('INVALID'),
    createdCount: 0,
    recoveredCount: 0,
    skippedCount: 0,
    updatedCount: 0,
    failedCount: 0,
  };

  const setAction = (code: string, action: ResolutionUserAction) => setItems((prev) => prev.map((it) => (it.code === code ? { ...it, userAction: action } : it)));
  const archived = (decide: (it: Item) => ResolutionUserAction) => {
    setItems((prev) => prev.map((it) => (it.state === 'SOFT_DELETED' ? { ...it, userAction: decide(it) } : it)));
    setStep('RESOLVE');
  };

  const execute = async () => {
    setFailure(null);
    setStep('EXECUTING');
    try {
      const sent = items
        .filter((it) => it.userAction === 'create' || it.userAction === 'recover' || it.userAction === 'skip')
        .map((it) => ({ code: it.code, action: it.userAction, data: it.userAction === 'create' ? it.data : {} }));
      setResponse(await bulkCreate({ project_id: projectId, items: sent }));
      setStep('RESULT');
    } catch (error) {
      setFailure(serverMessage(error));
      setStep('PREVIEW');
    }
  };

  const retryFailed = (codes: string[]) => {
    const wanted = new Set(codes.map((c) => c.toUpperCase()));
    const failed = rows.filter((r) => wanted.has(String(r.code ?? '').trim().toUpperCase()));
    setRows(failed.length > 0 ? failed : rows);
    setStep('GRID');
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      className="max-w-5xl"
      title={
        <span className="flex flex-wrap items-center gap-3">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Layers className="w-5 h-5" aria-hidden="true" />
          </span>
          Bulk {Noun} Creation & Staging
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">Project: {projectCode}</span>
        </span>
      }
      subtitle={<span className="font-mono">Paste or upload {spec.plural}, validate duplicate codes, detect archived and existing {spec.plural}, and create them.</span>}
    >
      <div className="space-y-5">
        {failure && (
          <p role="alert" className="text-sm text-rose-300">
            {failure}
          </p>
        )}

        {(step === 'GRID' || step === 'VALIDATING') && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-300 font-mono">
                Columns: {columns.map((c) => `${c.header}${c.required ? ' (required)' : ''}`).join(', ')}. Parents are written by code.
              </p>
              <label className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <span>CSV file</span>
                <input type="file" accept=".csv,text/csv,.tsv,text/tab-separated-values" aria-label="CSV file" onChange={onFile} className="text-xs" />
              </label>
            </div>
            {problems.length > 0 && (
              <ul role="alert" className="list-disc pl-5 text-xs text-rose-300">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            <BulkImportGrid columns={gridColumns} rows={rows} onChange={setRows} onPaste={take} sampleRows={parents.data ? exampleRows(spec, columns, parents.data) : undefined} />
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={validate} disabled={rows.length === 0 || step === 'VALIDATING'} className="flex items-center gap-1.5">
                {step === 'VALIDATING' ? (
                  <span>Validating…</span>
                ) : (
                  <>
                    <span>Validate &amp; Resolve</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'RECOVERY_PROMPT' && (
          <SoftDeletedEntityRecovery
            entityType={Noun}
            items={items}
            onRecoverSelected={(codes: string[]) => archived((it) => (codes.includes(it.code) ? 'recover' : 'skip'))}
            onRecoverAll={() => archived(() => 'recover')}
            onSkipAll={() => archived(() => 'skip')}
            onCancel={() => setStep('GRID')}
          />
        )}

        {step === 'RESOLVE' && (
          <div className="space-y-4">
            <BulkValidationSummary summary={summary} activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            <ExistingEntityResolver items={items} activeFilter={activeFilter} onActionChange={setAction} onRemoveItem={(code: string) => setItems((prev) => prev.filter((it) => it.code !== code))} />
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <Button size="sm" variant="secondary" onClick={() => setStep('GRID')}>
                Back to Grid
              </Button>
              <Button size="sm" variant="primary" onClick={() => setStep('PREVIEW')} disabled={items.length === 0} className="flex items-center gap-1.5">
                <span>Review Execution Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {(step === 'PREVIEW' || step === 'EXECUTING') && (
          <BulkOperationPreview entityType={Noun} items={items} onBack={() => setStep('RESOLVE')} onExecute={execute} isExecuting={step === 'EXECUTING' || isBulkCreating} />
        )}

        {step === 'RESULT' && response && <BulkOperationResult entityType={Noun} response={response} onRetryFailed={retryFailed} onDone={onClose} />}
      </div>
    </Modal>
  );
};
