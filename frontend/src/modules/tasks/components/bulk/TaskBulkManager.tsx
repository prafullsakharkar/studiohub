import React, { useState } from 'react';
import {
  CheckSquare,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  X,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { Task } from '@/types/production';
import { Department, PriorityLevel } from '@/types/common';
import { EntityResolutionItem, BulkOperationSummary, BulkOperationResponse, ResolutionUserAction, EntityResolutionState } from '@/shared/components/bulk/types';
import { useBulkTasks } from '../../hooks/useBulkTasks';
import { BulkImportGrid, GridColumn } from '@/shared/components/bulk/BulkImportGrid';
import { BulkValidationSummary } from '@/shared/components/bulk/BulkValidationSummary';
import { ExistingEntityResolver } from '@/shared/components/bulk/ExistingEntityResolver';
import { SoftDeletedEntityRecovery } from '@/shared/components/bulk/SoftDeletedEntityRecovery';
import { BulkOperationPreview } from '@/shared/components/bulk/BulkOperationPreview';
import { BulkOperationResult } from '@/shared/components/bulk/BulkOperationResult';
import { BulkOperationEngine } from '@/shared/components/bulk/BulkOperationEngine';
import { Button } from '@/shared/components/Button';

interface TaskBulkManagerProps {
  projectId: string;
  projectCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WorkflowStep = 'GRID' | 'RECOVERY_PROMPT' | 'RESOLVE' | 'PREVIEW' | 'EXECUTING' | 'RESULT';

const TASK_COLUMNS: GridColumn[] = [
  { key: 'code', label: 'Task Code', type: 'text', placeholder: 'e.g. TSK-FX-101', required: true, width: '160px' },
  { key: 'title', label: 'Task Title', type: 'text', placeholder: 'e.g. Volumetric Explosion', width: '220px' },
  {
    key: 'entity_type',
    label: 'Target Entity',
    type: 'select',
    options: ['Shot', 'Asset', 'Sequence', 'General'],
    width: '130px',
  },
  { key: 'entity_code', label: 'Entity Code', type: 'text', placeholder: 'e.g. NK_010_010', width: '150px' },
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: [
      'Layout & Previz',
      'Modeling & Surfacing',
      'Rigging & Creature FX',
      'Character Animation',
      'FX & Simulation',
      'Lighting & LookDev',
      'Compositing',
      'Matte Painting & DMP',
      'Editorial & Ingest',
    ],
    width: '180px',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: ['Low', 'Medium', 'High', 'Critical'],
    width: '120px',
  },
  { key: 'assignee_name', label: 'Assignee', type: 'text', placeholder: 'e.g. Elena Rostova', width: '160px' },
  { key: 'estimated_hours', label: 'Est. Hours', type: 'number', placeholder: '40', width: '110px' },
  { key: 'due_date', label: 'Due Date', type: 'text', placeholder: '2026-09-30', width: '130px' },
  { key: 'software', label: 'Software', type: 'text', placeholder: 'Houdini 20.5', width: '140px' },
];

const SAMPLE_TASKS = [
  { code: 'TSK-FX-901', title: 'Spinner Atmospheric Splash Simulation', entity_type: 'Shot', entity_code: 'NK_010_010', department: 'FX & Simulation', priority: 'High', assignee_name: 'Elena Rostova', estimated_hours: 48, due_date: '2026-09-18', software: 'Houdini 20.5' },
  { code: 'TSK-CMP-902', title: 'Neon Reflections & Deep Plate Merge', entity_type: 'Shot', entity_code: 'NK_010_010', department: 'Compositing', priority: 'Critical', assignee_name: 'Alex Chen', estimated_hours: 36, due_date: '2026-09-22', software: 'Nuke 15' },
  { code: 'TSK-MOD-903', title: 'LookDev MaterialX Shader Calibration', entity_type: 'Asset', entity_code: 'AST_VEH_SPINNER_04', department: 'Lighting & LookDev', priority: 'Medium', assignee_name: 'Sarah Jenkins', estimated_hours: 24, due_date: '2026-09-25', software: 'Solaris / MaterialX' },
  { code: 'TSK-ANM-904', title: 'Hero Cockpit Throttle Articulation', entity_type: 'Shot', entity_code: 'NK_010_020', department: 'Character Animation', priority: 'Medium', assignee_name: 'David Kim', estimated_hours: 32, due_date: '2026-09-20', software: 'Maya' },
];

export const TaskBulkManager: React.FC<TaskBulkManagerProps> = ({
  projectId,
  projectCode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { checkExistence, bulkCreate, isCheckingExistence, isBulkCreating } = useBulkTasks();

  const [step, setStep] = useState<WorkflowStep>('GRID');
  const [rows, setRows] = useState<Record<string, any>[]>(SAMPLE_TASKS);
  const [resolutionItems, setResolutionItems] = useState<EntityResolutionItem<Task>[]>([]);
  const [activeFilter, setActiveFilter] = useState<EntityResolutionState | 'ALL'>('ALL');
  const [operationResponse, setOperationResponse] = useState<BulkOperationResponse<Task> | null>(null);

  if (!isOpen) return null;

  // Step 1 -> Step 2: Validate against backend
  const handleValidateGrid = async () => {
    const cleanedRows = rows.filter((r) => r.code && r.code.trim().length > 0);
    if (cleanedRows.length === 0) return;

    // Analyze duplicates locally first
    const { items: rawItems } = BulkOperationEngine.analyzeRequestDuplicates(
      cleanedRows,
      (r) => r.code
    );

    const initialItems = rawItems as unknown as EntityResolutionItem<Task>[];

    const codesToCheck = initialItems
      .filter((it) => it.state !== 'INVALID' && it.state !== 'DUPLICATE_IN_REQUEST')
      .map((it) => it.code);

    try {
      const resp = await checkExistence({
        project_id: projectId,
        codes: codesToCheck,
        entity_type: 'task',
      });

      // Merge backend check results
      const mergedItems: EntityResolutionItem<Task>[] = initialItems.map((item) => {
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

      // Check if soft deleted items exist -> Prompt user specifically
      const hasSoftDeleted = mergedItems.some((it) => it.state === 'SOFT_DELETED');
      if (hasSoftDeleted) {
        setStep('RECOVERY_PROMPT');
      } else {
        setStep('RESOLVE');
      }
    } catch (err) {
      console.error('Task validation error:', err);
    }
  };

  // Compute summary metrics
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

  // Action toggles
  const handleActionChange = (code: string, action: ResolutionUserAction) => {
    setResolutionItems((prev) =>
      prev.map((it) => (it.code === code ? { ...it, userAction: action } : it))
    );
  };

  const handleRemoveItem = (code: string) => {
    setResolutionItems((prev) => prev.filter((it) => it.code !== code));
  };

  // Recovery Prompt Handlers
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

  // Execution
  const handleExecute = async () => {
    setStep('EXECUTING');
    try {
      const itemsToProcess = resolutionItems
        .filter((it) => it.userAction === 'create' || it.userAction === 'recover' || it.userAction === 'skip')
        .map((it) => ({
          code: it.code,
          action: it.userAction || (it.state === 'NEW' ? 'create' : 'skip'),
          data: {
            ...it.proposedData,
            project_id: projectId,
            project_code: projectCode,
            status: 'Not Started',
          } as Partial<Task>,
        }));

      const resp = await bulkCreate({
        project_id: projectId,
        items: itemsToProcess,
      });

      setOperationResponse(resp);
      setStep('RESULT');
      onSuccess?.();
    } catch (err) {
      console.error('Task bulk execution error:', err);
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
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Bulk Task Creation & Schedule Staging</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Project: {projectCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Rapidly create, validate, schedule, and assign production tasks across all departments.
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
                  Input task items below or paste spreadsheets with columns for entity, department, assignee, and estimates.
                </p>
              </div>

              <BulkImportGrid
                columns={TASK_COLUMNS}
                rows={rows}
                onChange={setRows}
                sampleRows={SAMPLE_TASKS}
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
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {isCheckingExistence ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validating Task Schedule & Dependencies...</span>
                    </>
                  ) : (
                    <>
                      <span>Validate & Resolve Batch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'RECOVERY_PROMPT' && (
            <SoftDeletedEntityRecovery
              entityType="Task"
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
                  className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
                >
                  <span>Review Task Execution Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {(step === 'PREVIEW' || step === 'EXECUTING') && (
            <BulkOperationPreview
              entityType="Task"
              items={resolutionItems}
              onBack={() => setStep('RESOLVE')}
              onExecute={handleExecute}
              isExecuting={step === 'EXECUTING' || isBulkCreating}
            />
          )}

          {step === 'RESULT' && operationResponse && (
            <BulkOperationResult
              entityType="Task"
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
