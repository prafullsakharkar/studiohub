import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  X,
  PlusCircle,
  FileSpreadsheet,
} from 'lucide-react';
import type { Shot } from '@/api/production/work';
import { EntityResolutionItem, BulkOperationSummary, BulkOperationResponse, ResolutionUserAction, EntityResolutionState } from '@/shared/components/bulk/types';
import { useBulkShots } from '../../hooks/useBulkShots';
import { BulkImportGrid, GridColumn } from '@/shared/components/bulk/BulkImportGrid';
import { BulkValidationSummary } from '@/shared/components/bulk/BulkValidationSummary';
import { ExistingEntityResolver } from '@/shared/components/bulk/ExistingEntityResolver';
import { SoftDeletedEntityRecovery } from '@/shared/components/bulk/SoftDeletedEntityRecovery';
import { BulkOperationPreview } from '@/shared/components/bulk/BulkOperationPreview';
import { BulkOperationResult } from '@/shared/components/bulk/BulkOperationResult';
import { BulkOperationEngine } from '@/shared/components/bulk/BulkOperationEngine';
import { Button } from '@/shared/components/Button';

export interface BulkEpisodeRef {
  id: string;
  code: string;
  name?: string;
}

export interface BulkSequenceRef {
  id?: string;
  code: string;
  episode_id?: string;
}

export interface BulkEpisodeCreateInput {
  project_id: string;
  project_code: string;
  code: string;
  name: string;
}

export interface BulkSequenceCreateInput {
  project_id: string;
  project_code: string;
  episode_id: string;
  code: string;
}

export interface BulkCreatedEpisode extends BulkEpisodeRef {
  project_id?: string;
}

export interface BulkCreatedSequence extends BulkSequenceRef {
  project_id?: string;
}

interface ShotBulkManagerProps {
  projectId: string;
  projectCode: string;
  defaultSequenceCode?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  episodeId?: string;
  episodeCode?: string;
  episodes?: BulkEpisodeRef[];
  sequences?: BulkSequenceRef[];
  isEpisodic?: boolean;
  onCreateEpisode?: (input: BulkEpisodeCreateInput) => Promise<BulkCreatedEpisode | undefined>;
  onCreateSequence?: (input: BulkSequenceCreateInput) => Promise<BulkCreatedSequence | undefined>;
}

type WorkflowStep = 'GRID' | 'RECOVERY_PROMPT' | 'RESOLVE' | 'PREVIEW' | 'EXECUTING' | 'RESULT';

const SHOT_COLUMNS: GridColumn[] = [
  { key: 'code', label: 'Shot Code', type: 'text', placeholder: 'e.g. NK_010_030', required: true, width: '150px' },
  { key: 'sequence_code', label: 'Sequence', type: 'text', placeholder: 'e.g. NK_010', required: true, width: '120px' },
  { key: 'name', label: 'Shot Name', type: 'text', placeholder: 'e.g. Alley Escape', width: '180px' },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    // The backend's choices that a NEW shot may start in: Approved is entered from review only and Archived is an action.
    options: ['Not Started', 'In Progress', 'Pending Review', 'Retake', 'On Hold'],
    width: '140px',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: ['Low', 'Medium', 'High', 'Critical'],
    width: '110px',
  },
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: ['Compositing', 'Animation', 'Lighting', 'FX', 'Layout', 'Matte Painting'],
    width: '130px',
  },
  { key: 'frame_in', label: 'Frame In', type: 'number', placeholder: '1001', width: '100px' },
  { key: 'frame_out', label: 'Frame Out', type: 'number', placeholder: '1120', width: '100px' },
  { key: 'handle_frames', label: 'Handles', type: 'number', placeholder: '8', width: '90px' },
  { key: 'notes', label: 'Turnover Notes', type: 'text', placeholder: 'Turnover notes', width: '180px' },
];

const EPISODE_COLUMN: GridColumn = {
  key: 'episode_id',
  label: 'Episode',
  type: 'text',
  placeholder: 'e.g. EP101',
  width: '110px',
};

export function getShotBulkGridColumns(isEpisodic: boolean): GridColumn[] {
  if (!isEpisodic) return SHOT_COLUMNS;
  return [SHOT_COLUMNS[0], SHOT_COLUMNS[1], EPISODE_COLUMN, ...SHOT_COLUMNS.slice(2)];
}

function trimmedOrUndefined(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

export function buildEpisodeLookup(
  episodes: BulkEpisodeRef[]
): Record<string, BulkEpisodeRef | undefined> {
  const lookup: Record<string, BulkEpisodeRef | undefined> = {};
  for (const ep of episodes) {
    lookup[ep.id] = ep;
    lookup[ep.code] = ep;
  }
  return lookup;
}

// Grid-typed episode input may be an id or a code (e.g. 'EP101'). Normalize
// to the episode id via the lookup so data.episode_id always carries an id.
// Falls back to the raw trimmed value when unresolvable: the router accepts
// id-or-code on episode fields, so the backend still has a chance to resolve
// it instead of us dropping user input.
export function normalizeEpisodeRef(
  value: unknown,
  episodeLookup?: Record<string, BulkEpisodeRef | undefined>
): string | undefined {
  const text = trimmedOrUndefined(value);
  if (!text) return undefined;
  return episodeLookup?.[text]?.id ?? text;
}

export function resolveBulkShotEpisode(
  row: Record<string, any>,
  opts: {
    bulkDefaultEpisodeId?: string;
    sequenceEpisodeMap?: Record<string, string | undefined>;
    episodeLookup?: Record<string, BulkEpisodeRef | undefined>;
  } = {}
): string | undefined {
  const rowValue = normalizeEpisodeRef(row?.episode_id, opts.episodeLookup);
  if (rowValue) return rowValue;
  const bulkDefault = normalizeEpisodeRef(opts.bulkDefaultEpisodeId, opts.episodeLookup);
  if (bulkDefault) return bulkDefault;
  const sequenceCode = trimmedOrUndefined(row?.sequence_code);
  if (sequenceCode && opts.sequenceEpisodeMap) {
    // Trim-only on purpose: the router compares `s.code === seqCode` exactly,
    // so case-folding here would resolve rows the backend then rejects.
    const mapped = trimmedOrUndefined(opts.sequenceEpisodeMap[sequenceCode]);
    if (mapped) return mapped;
  }
  return undefined;
}

export type BulkEpisodicPrompt =
  | { kind: 'none' }
  | { kind: 'create-episode' }
  | { kind: 'create-sequence'; episodeId: string };

export function getBulkEpisodicPrompt(opts: {
  isEpisodic: boolean;
  episodes: BulkEpisodeRef[];
  sequences?: BulkSequenceRef[];
  bulkDefaultEpisodeId?: string;
}): BulkEpisodicPrompt {
  if (!opts.isEpisodic) return { kind: 'none' };
  if (opts.episodes.length === 0) return { kind: 'create-episode' };
  // Unknown sequence list (still loading / unwired): never prompt blind.
  if (!opts.sequences) return { kind: 'none' };
  const targetEpisodeId =
    trimmedOrUndefined(opts.bulkDefaultEpisodeId) ?? opts.episodes[0].id;
  if (opts.sequences.length === 0) {
    return { kind: 'create-sequence', episodeId: targetEpisodeId };
  }
  // Linkage contract: Task-2 seeds and the router stamp episode_id on every
  // episodic sequence create, so episode linkage is expected on candidates.
  // When NO candidate carries any linkage, the data predates (or omits) the
  // contract — treat sequences as present rather than demanding creation for
  // missing metadata.
  const linked = opts.sequences.filter(
    (seq) => trimmedOrUndefined(seq.episode_id) !== undefined
  );
  if (linked.length === 0) return { kind: 'none' };
  const hasSequenceUnderTarget = linked.some(
    (seq) => seq.episode_id === targetEpisodeId
  );
  if (!hasSequenceUnderTarget) {
    return { kind: 'create-sequence', episodeId: targetEpisodeId };
  }
  return { kind: 'none' };
}

export function applyBulkSequenceCreate(
  rows: Record<string, any>[],
  created: { code: string; episode_id?: string }
): Record<string, any>[] {
  return rows.map((row) =>
    trimmedOrUndefined(row?.sequence_code)
      ? row
      : { ...row, sequence_code: created.code }
  );
}

export interface BulkShotPayloadContext {
  projectId: string;
  projectCode: string;
  defaultSequenceCode: string;
  isEpisodic: boolean;
  bulkDefaultEpisodeId?: string;
  sequenceEpisodeMap?: Record<string, string | undefined>;
  episodesById?: Record<string, BulkEpisodeRef | undefined>;
  episodeLookup?: Record<string, BulkEpisodeRef | undefined>;
}

export function buildBulkShotItems(
  resolutionItems: EntityResolutionItem<Shot>[],
  ctx: BulkShotPayloadContext
) {
  return resolutionItems
    .filter((it) => it.userAction === 'create' || it.userAction === 'recover' || it.userAction === 'skip')
    .map((it) => {
      const baseData = {
        ...it.proposedData,
        project_id: ctx.projectId,
        project_code: ctx.projectCode,
        sequence_code: (it.proposedData as any)?.sequence_code || ctx.defaultSequenceCode,
      } as Partial<Shot>;
      if (!ctx.isEpisodic) {
        return {
          code: it.code,
          action: it.userAction || (it.state === 'NEW' ? 'create' : 'skip'),
          data: baseData,
        };
      }
      const episodeId = resolveBulkShotEpisode((it.proposedData as any) || {}, {
        bulkDefaultEpisodeId: ctx.bulkDefaultEpisodeId,
        sequenceEpisodeMap: ctx.sequenceEpisodeMap,
        episodeLookup: ctx.episodeLookup ?? ctx.episodesById,
      });
      const episode = episodeId ? ctx.episodesById?.[episodeId] : undefined;
      return {
        code: it.code,
        action: it.userAction || (it.state === 'NEW' ? 'create' : 'skip'),
        data: {
          ...baseData,
          ...(episodeId ? { episode_id: episodeId } : {}),
          ...(episode ? { episode_code: episode.code } : {}),
          ...(episode?.name ? { episode_name: episode.name } : {}),
        } as Partial<Shot>,
      };
    });
}

const SAMPLE_SHOTS = [
  { code: 'NK_010_030', sequence_code: 'NK_010', name: 'Alleyway Escape', status: 'Not Started', priority: 'High', department: 'Compositing', frame_in: 1001, frame_out: 1140, handle_frames: 8 },
  { code: 'NK_010_040', sequence_code: 'NK_010', name: 'Rooftop Leap Close-up', status: 'In Progress', priority: 'Critical', department: 'Animation', frame_in: 1001, frame_out: 1095, handle_frames: 8 },
  { code: 'NK_020_010', sequence_code: 'NK_020', name: 'Subway Turnstile Breach', status: 'Not Started', priority: 'Medium', department: 'FX', frame_in: 1001, frame_out: 1210, handle_frames: 8 },
  { code: 'NK_010_099', sequence_code: 'NK_010', name: 'Cut Scene - Stunt Double Test', status: 'Not Started', priority: 'Low', department: 'Layout', frame_in: 1001, frame_out: 1050, handle_frames: 8 }, // Soft deleted sample
];

export const ShotBulkManager: React.FC<ShotBulkManagerProps> = ({
  projectId,
  projectCode,
  defaultSequenceCode = 'NK_010',
  isOpen,
  onClose,
  onSuccess,
  episodeId,
  episodeCode,
  episodes,
  sequences,
  isEpisodic,
  onCreateEpisode,
  onCreateSequence,
}) => {
  const { checkExistence, bulkCreate, isCheckingExistence, isBulkCreating } = useBulkShots();

  const isEpisodicMode = isEpisodic ?? Boolean(episodeId || episodeCode);
  const gridColumns = getShotBulkGridColumns(isEpisodicMode);

  const [step, setStep] = useState<WorkflowStep>('GRID');
  const [rows, setRows] = useState<Record<string, any>[]>(
    SAMPLE_SHOTS.map((s) => ({
      ...s,
      sequence_code: s.sequence_code || defaultSequenceCode,
    }))
  );
  const [resolutionItems, setResolutionItems] = useState<EntityResolutionItem<Shot>[]>([]);
  const [activeFilter, setActiveFilter] = useState<EntityResolutionState | 'ALL'>('ALL');
  const [operationResponse, setOperationResponse] = useState<BulkOperationResponse<Shot> | null>(null);

  // Episodic hierarchy state: local episode/sequence lists seed from props so
  // inline parent creation can continue without losing the grid or phase.
  const [localEpisodes, setLocalEpisodes] = useState<BulkEpisodeRef[]>(episodes ?? []);
  const [localSequences, setLocalSequences] = useState<BulkSequenceRef[]>(sequences ?? []);
  const [bulkEpisodeId, setBulkEpisodeId] = useState<string | undefined>(episodeId);
  const [showEpisodeForm, setShowEpisodeForm] = useState(false);
  const [showSequenceForm, setShowSequenceForm] = useState(false);
  const [episodeForm, setEpisodeForm] = useState({ code: '', name: '' });
  const [sequenceForm, setSequenceForm] = useState({ code: '' });
  const [isCreatingParent, setIsCreatingParent] = useState(false);
  const [parentError, setParentError] = useState('');

  React.useEffect(() => {
    setLocalEpisodes(episodes ?? []);
  }, [episodes]);
  React.useEffect(() => {
    setLocalSequences(sequences ?? []);
  }, [sequences]);
  React.useEffect(() => {
    if (episodeId) setBulkEpisodeId(episodeId);
  }, [episodeId]);

  const episodeLookup = buildEpisodeLookup(localEpisodes);
  const effectiveBulkEpisodeId =
    normalizeEpisodeRef(bulkEpisodeId, episodeLookup)
    ?? normalizeEpisodeRef(episodeCode, episodeLookup)
    ?? localEpisodes[0]?.id;
  const sequenceEpisodeMap: Record<string, string | undefined> = {};
  for (const seq of localSequences) {
    const key = trimmedOrUndefined(seq.code);
    if (key) sequenceEpisodeMap[key] = seq.episode_id;
  }
  // episodesById doubles as the id/code lookup for payload enrichment.
  const episodesById = episodeLookup;
  // Preserve unknown-ness: while the sequences prop has not loaded, pass
  // undefined (not []) so the prompt helper's unknown-guard engages instead
  // of firing a blind create-sequence prompt.
  const episodicPrompt: BulkEpisodicPrompt = getBulkEpisodicPrompt({
    isEpisodic: isEpisodicMode,
    episodes: localEpisodes,
    sequences: sequences === undefined ? undefined : localSequences,
    bulkDefaultEpisodeId: effectiveBulkEpisodeId,
  });
  const targetEpisode = localEpisodes.find((ep) => ep.id === effectiveBulkEpisodeId)
    ?? localEpisodes[0];

  const handleConfirmEpisode = async () => {
    const code = episodeForm.code.trim().toUpperCase();
    const name = episodeForm.name.trim();
    if (!code || !name) return;
    setParentError('');
    setIsCreatingParent(true);
    try {
      if (!onCreateEpisode) {
        throw new Error('Episode creation is not wired for this project.');
      }
      const created = await onCreateEpisode({
        project_id: projectId,
        project_code: projectCode,
        code,
        name,
      });
      if (!created?.id || !created?.code) {
        throw new Error('Episode creation did not return a usable episode record.');
      }
      const episode: BulkEpisodeRef = {
        id: created.id,
        code: created.code,
        name: created.name ?? name,
      };
      setLocalEpisodes((prev) => [...prev, episode]);
      setBulkEpisodeId(episode.id);
      setEpisodeForm({ code: '', name: '' });
      setShowEpisodeForm(false);
    } catch (err: any) {
      // Keep the form open with the error surfaced; never synthesize parents
      // or dismiss-as-success.
      setParentError(err?.message || 'Failed to create episode.');
    } finally {
      setIsCreatingParent(false);
    }
  };

  const handleConfirmSequence = async () => {
    const code = sequenceForm.code.trim();
    if (!code || !targetEpisode) return;
    setParentError('');
    setIsCreatingParent(true);
    try {
      if (!onCreateSequence) {
        throw new Error('Sequence creation is not wired for this project.');
      }
      const created = await onCreateSequence({
        project_id: projectId,
        project_code: projectCode,
        episode_id: targetEpisode.id,
        code,
      });
      if (!created?.code) {
        throw new Error('Sequence creation did not return a usable sequence record.');
      }
      const sequence: BulkSequenceRef = {
        id: created.id,
        code: created.code,
        episode_id: created.episode_id ?? targetEpisode.id,
      };
      setLocalSequences((prev) => [...prev, sequence]);
      // Preserve the pending grid; rows missing a sequence continue with the
      // newly created one.
      setRows((prev) => applyBulkSequenceCreate(prev, { code: sequence.code }));
      setSequenceForm({ code: '' });
      setShowSequenceForm(false);
    } catch (err: any) {
      setParentError(err?.message || 'Failed to create sequence.');
    } finally {
      setIsCreatingParent(false);
    }
  };

  if (!isOpen) return null;

  // Step 1 -> Step 2: Validate against backend
  const handleValidateGrid = async () => {
    const cleanedRows = rows.filter((r) => r.code && r.code.trim().length > 0);
    if (cleanedRows.length === 0) return;

    // Analyze duplicates and check frame numbers locally
    const { items: rawItems } = BulkOperationEngine.analyzeRequestDuplicates(
      cleanedRows,
      (r) => r.code
    );

    const initialItems = rawItems as unknown as EntityResolutionItem<Shot>[];

    const validatedItems = initialItems.map((item) => {
      const data = item.proposedData as any;
      if (data?.frame_in !== undefined && data?.frame_out !== undefined) {
        const frameCheck = BulkOperationEngine.validateFrameRanges(data.frame_in, data.frame_out);
        if (!frameCheck.valid) {
          return {
            ...item,
            state: 'INVALID' as const,
            errors: [frameCheck.error!],
            userAction: 'skip' as const,
          };
        }
      }
      return item;
    });

    const codesToCheck = validatedItems
      .filter((it) => it.state !== 'INVALID' && it.state !== 'DUPLICATE_IN_REQUEST')
      .map((it) => it.code);

    try {
      const resp = await checkExistence({
        project_id: projectId,
        codes: codesToCheck,
        entity_type: 'shot',
      });

      const mergedItems: EntityResolutionItem<Shot>[] = validatedItems.map((item) => {
        if (item.state === 'INVALID' || item.state === 'DUPLICATE_IN_REQUEST') {
          return item;
        }

        const serverMatch = resp.items.find((s) => s.code.toUpperCase() === item.code.toUpperCase());
        if (!serverMatch) return item;

        return {
          ...item,
          state: serverMatch.state,
          existingEntity: serverMatch.existing_entity,
          message: serverMatch.message,
          userAction:
            serverMatch.state === 'SOFT_DELETED'
              ? 'recover'
              : serverMatch.state === 'EXISTS'
              ? 'skip'
              : 'create',
        };
      });

      setResolutionItems(mergedItems);

      const hasSoftDeleted = mergedItems.some((it) => it.state === 'SOFT_DELETED');
      if (hasSoftDeleted) {
        setStep('RECOVERY_PROMPT');
      } else {
        setStep('RESOLVE');
      }
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  const summary: BulkOperationSummary = {
    total: resolutionItems.length,
    newCount: resolutionItems.filter((it) => it.state === 'NEW').length,
    softDeletedCount: resolutionItems.filter((it) => it.state === 'SOFT_DELETED').length,
    existingCount: resolutionItems.filter((it) => it.state === 'EXISTS').length,
    duplicateCount: resolutionItems.filter((it) => it.state === 'DUPLICATE_IN_REQUEST').length,
    invalidCount: resolutionItems.filter((it) => it.state === 'INVALID').length,
    createdCount: 0,
    recoveredCount: 0,
    skippedCount: 0,
    updatedCount: 0,
    failedCount: 0,
  };

  const handleActionChange = (code: string, action: ResolutionUserAction) => {
    setResolutionItems((prev) =>
      prev.map((it) => (it.code === code ? { ...it, userAction: action } : it))
    );
  };

  const handleRemoveItem = (code: string) => {
    setResolutionItems((prev) => prev.filter((it) => it.code !== code));
  };

  const handleRecoverSelected = (codesToRecover: string[]) => {
    setResolutionItems((prev) =>
      prev.map((it) => {
        if (it.state === 'SOFT_DELETED') {
          return {
            ...it,
            userAction: codesToRecover.includes(it.code) ? 'recover' : 'skip',
          };
        }
        return it;
      })
    );
    setStep('RESOLVE');
  };

  const handleRecoverAll = () => {
    setResolutionItems((prev) =>
      prev.map((it) => (it.state === 'SOFT_DELETED' ? { ...it, userAction: 'recover' } : it))
    );
    setStep('RESOLVE');
  };

  const handleSkipAllArchived = () => {
    setResolutionItems((prev) =>
      prev.map((it) => (it.state === 'SOFT_DELETED' ? { ...it, userAction: 'skip' } : it))
    );
    setStep('RESOLVE');
  };

  const handleExecute = async () => {
    setStep('EXECUTING');
    try {
      const itemsToProcess = buildBulkShotItems(resolutionItems, {
        projectId,
        projectCode,
        defaultSequenceCode,
        isEpisodic: isEpisodicMode,
        bulkDefaultEpisodeId: effectiveBulkEpisodeId,
        sequenceEpisodeMap,
        episodesById,
        episodeLookup,
      });

      const resp = await bulkCreate({
        project_id: projectId,
        items: itemsToProcess,
      });

      setOperationResponse(resp);
      setStep('RESULT');
      onSuccess?.();
    } catch (err) {
      console.error('Execution error:', err);
    }
  };

  const handleRetryFailed = (failedCodes: string[]) => {
    const failedRows = rows.filter((r) => failedCodes.includes(r.code?.toUpperCase()));
    setRows(failedRows.length > 0 ? failedRows : rows);
    setStep('GRID');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Bulk Shot Creation & Staging</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Project: {projectCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Batch import cut sheets, validate duplicate shot IDs, detect archived turnovers, and register shots.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'GRID' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-300 font-mono">
                  Input shot cut sheet records or paste TSV/CSV from editorial turnovers.
                </p>
                {isEpisodicMode && targetEpisode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    Target episode: {targetEpisode.code}
                  </span>
                )}
              </div>

              {isEpisodicMode && episodicPrompt.kind === 'create-episode' && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs font-mono text-amber-200 space-y-2">
                  <p>No episodes found for this project. Create an episode to continue bulk shot creation?</p>
                  {parentError && episodicPrompt.kind === 'create-episode' && (
                    <p role="alert" className="text-rose-300">{parentError}</p>
                  )}
                  {!showEpisodeForm ? (
                    <Button size="sm" variant="secondary" onClick={() => { setParentError(''); setShowEpisodeForm(true); }}>
                      Create episode
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={episodeForm.code}
                        onChange={(e) => setEpisodeForm((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="e.g. EP201"
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                      <input
                        type="text"
                        value={episodeForm.name}
                        onChange={(e) => setEpisodeForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. The Arrival"
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                      <Button size="sm" variant="primary" onClick={handleConfirmEpisode} disabled={isCreatingParent}>
                        Save episode
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowEpisodeForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {isEpisodicMode && episodicPrompt.kind === 'create-sequence' && targetEpisode && (
                <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs font-mono text-amber-200 space-y-2">
                  <p>Episode {targetEpisode.code} has no sequences yet. Create a sequence under this episode?</p>
                  {parentError && episodicPrompt.kind === 'create-sequence' && (
                    <p role="alert" className="text-rose-300">{parentError}</p>
                  )}
                  {!showSequenceForm ? (
                    <Button size="sm" variant="secondary" onClick={() => { setParentError(''); setShowSequenceForm(true); }}>
                      Create sequence
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={sequenceForm.code}
                        onChange={(e) => setSequenceForm((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="e.g. SOL03_090"
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
                      />
                      <Button size="sm" variant="primary" onClick={handleConfirmSequence} disabled={isCreatingParent}>
                        Save sequence
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowSequenceForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <BulkImportGrid
                columns={gridColumns}
                rows={rows}
                onChange={setRows}
                sampleRows={SAMPLE_SHOTS}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleValidateGrid}
                  disabled={rows.length === 0 || isCheckingExistence}
                  className="flex items-center gap-1.5"
                >
                  {isCheckingExistence ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validating Database & Cut Sheets...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate & Resolve Cut Sheet</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'RECOVERY_PROMPT' && (
            <SoftDeletedEntityRecovery
              entityType="Shot"
              items={resolutionItems}
              onRecoverSelected={handleRecoverSelected}
              onRecoverAll={handleRecoverAll}
              onSkipAll={handleSkipAllArchived}
              onCancel={() => setStep('GRID')}
            />
          )}

          {step === 'RESOLVE' && (
            <div className="space-y-4">
              <BulkValidationSummary
                summary={summary}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
              />

              <ExistingEntityResolver
                items={resolutionItems}
                activeFilter={activeFilter}
                onActionChange={handleActionChange}
                onRemoveItem={handleRemoveItem}
              />

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <Button size="sm" variant="secondary" onClick={() => setStep('GRID')}>
                  Back to Grid
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setStep('PREVIEW')}
                  disabled={resolutionItems.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <span>Review Execution Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {(step === 'PREVIEW' || step === 'EXECUTING') && (
            <BulkOperationPreview
              entityType="Shot"
              items={resolutionItems}
              onBack={() => setStep('RESOLVE')}
              onExecute={handleExecute}
              isExecuting={step === 'EXECUTING' || isBulkCreating}
            />
          )}

          {step === 'RESULT' && operationResponse && (
            <BulkOperationResult
              entityType="Shot"
              response={operationResponse}
              onRetryFailed={handleRetryFailed}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};
