import React, { useState } from 'react';
import {
  Box,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  X,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import type { Asset, BulkOperationResponse, BulkOperationSummary, EntityResolutionItem, EntityResolutionState, ResolutionUserAction } from '@/types/production';
import { useBulkAssets } from '../../hooks/useBulkAssets';
import { BulkImportGrid, GridColumn } from '@/shared/components/bulk/BulkImportGrid';
import { BulkValidationSummary } from '@/shared/components/bulk/BulkValidationSummary';
import { ExistingEntityResolver } from '@/shared/components/bulk/ExistingEntityResolver';
import { SoftDeletedEntityRecovery } from '@/shared/components/bulk/SoftDeletedEntityRecovery';
import { BulkOperationPreview } from '@/shared/components/bulk/BulkOperationPreview';
import { BulkOperationResult } from '@/shared/components/bulk/BulkOperationResult';
import { BulkOperationEngine } from '@/shared/components/bulk/BulkOperationEngine';
import { Button } from '@/shared/components/Button';

interface AssetBulkManagerProps {
  projectId: string;
  projectCode: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type WorkflowStep = 'GRID' | 'RECOVERY_PROMPT' | 'RESOLVE' | 'PREVIEW' | 'EXECUTING' | 'RESULT';

const ASSET_COLUMNS: GridColumn[] = [
  { key: 'code', label: 'Asset Code', type: 'text', placeholder: 'e.g. AST_CHR_CYBER_COP', required: true, width: '180px' },
  { key: 'name', label: 'Asset Name', type: 'text', placeholder: 'e.g. Cyber Cop Hero Rig', width: '200px' },
  {
    key: 'category',
    label: 'Category',
    type: 'select',
    options: ['Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev', 'Matte Painting', 'Crowd Agent', 'Costume / Groom'],
    width: '150px',
  },
  {
    key: 'software',
    label: 'DCC Tool',
    type: 'select',
    options: ['Maya', 'Houdini', 'Blender', 'ZBrush', 'Substance Painter', 'Unreal Engine 5', 'Solaris', 'Mari'],
    width: '140px',
  },
  { key: 'poly_count', label: 'Poly Count', type: 'number', placeholder: '1500000', width: '120px' },
  { key: 'lod_levels', label: 'LODs', type: 'number', placeholder: '4', width: '90px' },
  { key: 'assigned_artist_name', label: 'Assigned Artist', type: 'text', placeholder: 'e.g. Sarah Jenkins', width: '160px' },
  { key: 'description', label: 'Description', type: 'text', placeholder: 'LookDev & USD specs', width: '220px' },
];

const SAMPLE_ASSETS = [
  { code: 'AST_CHR_COP_01', name: 'Cyber Police Patrolman Unit', category: 'Character', software: 'Maya', poly_count: 2400000, lod_levels: 4, assigned_artist_name: 'Sarah Jenkins', description: 'Hero biped tactical cop character rig with cloth grooming.' },
  { code: 'AST_ENV_NEON_TOWER', name: 'Megacorp Spire Skybridge', category: 'Environment', software: 'Houdini', poly_count: 14500000, lod_levels: 5, assigned_artist_name: 'David Kim', description: 'Modular architectural kit with ACEScg emissive signage.' },
  { code: 'AST_VEH_DRONE_SCOUT', name: 'Hexacopter Surveillance Drone', category: 'Vehicle', software: 'Blender', poly_count: 850000, lod_levels: 3, assigned_artist_name: 'Elena Rostova', description: 'Lightweight articulated rotor drone with tracking gimbal.' },
  { code: 'AST_PROP_HOLODECK', name: 'Tactical Holotable Terminal', category: 'Prop', software: 'Maya', poly_count: 350000, lod_levels: 3, assigned_artist_name: 'Alex Chen', description: 'Interactive volumetric display asset.' },
];

export const AssetBulkManager: React.FC<AssetBulkManagerProps> = ({
  projectId,
  projectCode,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { checkExistence, bulkCreate, isCheckingExistence, isBulkCreating } = useBulkAssets();

  const [step, setStep] = useState<WorkflowStep>('GRID');
  const [rows, setRows] = useState<Record<string, any>[]>(SAMPLE_ASSETS);
  const [resolutionItems, setResolutionItems] = useState<EntityResolutionItem<Asset>[]>([]);
  const [activeFilter, setActiveFilter] = useState<EntityResolutionState | 'ALL'>('ALL');
  const [operationResponse, setOperationResponse] = useState<BulkOperationResponse<Asset> | null>(null);

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

    const initialItems = rawItems as unknown as EntityResolutionItem<Asset>[];

    const codesToCheck = initialItems
      .filter((it) => it.state !== 'INVALID' && it.state !== 'DUPLICATE_IN_REQUEST')
      .map((it) => it.code);

    try {
      const resp = await checkExistence({
        project_id: projectId,
        codes: codesToCheck,
        entity_type: 'asset',
      });

      // Merge backend check results
      const mergedItems: EntityResolutionItem<Asset>[] = initialItems.map((item) => {
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
      console.error('Validation error:', err);
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
            version: 'v001',
          } as Partial<Asset>,
        }));

      const resp = await bulkCreate({
        project_id: projectId,
        items: itemsToProcess,
      });

      setOperationResponse(resp);
      setStep('RESULT');
      onSuccess?.();
    } catch (err) {
      console.error('Asset bulk execution error:', err);
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
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Bulk Asset Management & USD Staging</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  Project: {projectCode}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Stage 3D models, props, and lookdev assets, resolve archives, and create in batch.
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
                  Input asset manifests below or paste tabular data from spreadsheet / turnover documents.
                </p>
              </div>

              <BulkImportGrid
                columns={ASSET_COLUMNS}
                rows={rows}
                onChange={setRows}
                sampleRows={SAMPLE_ASSETS}
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
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  {isCheckingExistence ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Validating Asset Database & USD Prims...</span>
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
              entityType="Asset"
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
                  className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <span>Review Asset Execution Preview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {(step === 'PREVIEW' || step === 'EXECUTING') && (
            <BulkOperationPreview
              entityType="Asset"
              items={resolutionItems}
              onBack={() => setStep('RESOLVE')}
              onExecute={handleExecute}
              isExecuting={step === 'EXECUTING' || isBulkCreating}
            />
          )}

          {step === 'RESULT' && operationResponse && (
            <BulkOperationResult
              entityType="Asset"
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
