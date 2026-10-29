import type React from 'react';
import { useState } from 'react';
import {
  CheckSquare,
  Edit3,
  Archive,
  RotateCcw,
  Download,
  Trash2,
  X,
  MoreHorizontal,
  ChevronDown,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { usePermissions } from '@/core/permissions/usePermissions';
import type { EntityType } from '@/types/common';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

export interface BulkActionBarProps {
  entityType: EntityType | 'Sequence' | 'Shot' | 'Asset' | 'Task' | string;
  selectedCount: number;
  totalCount?: number;
  onClearSelection: () => void;
  onSelectAll?: () => void;
  onBulkUpdate?: () => void;
  onOpenBulkUpdate?: () => void;
  onBulkArchive?: () => void;
  onBulkRestore?: () => void;
  onBulkDelete?: () => void;
  onExportSelected?: (format: 'csv' | 'json') => void;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  className?: string;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  entityType,
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onBulkUpdate,
  onOpenBulkUpdate,
  onBulkArchive,
  onBulkRestore,
  onBulkDelete,
  onExportSelected,
  onExportCSV,
  onExportJSON,
  className = '',
}) => {
  const { canPerform } = usePermissions();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  if (selectedCount === 0) return null;

  const normalizedEntityType = entityType.toLowerCase() as EntityType;
  const canUpdate = canPerform(normalizedEntityType, 'bulk_update');
  const canArchive = canPerform(normalizedEntityType, 'bulk_archive');
  const canRestore = canPerform(normalizedEntityType, 'bulk_restore');
  const canDelete = canPerform(normalizedEntityType, 'delete');

  const handleUpdateClick = onOpenBulkUpdate || onBulkUpdate;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-slate-900/95 border border-indigo-500/40 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200 text-sm max-w-4xl w-[calc(100%-2rem)] md:w-auto ${className}`}
    >
      {/* Selected Counter */}
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <div className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
          <CheckSquare className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-baseline gap-1.5 font-mono">
          <span className="font-bold text-white text-base">{selectedCount}</span>
          <span className="text-xs text-slate-400">
            {entityType}
            {selectedCount > 1 ? 's' : ''} selected
          </span>
          {totalCount && (
            <span className="text-[11px] text-slate-500">
              (of {totalCount})
            </span>
          )}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {handleUpdateClick && (
          <Button
            size="sm"
            variant="primary"
            disabled={!canUpdate}
            onClick={handleUpdateClick}
            className="flex items-center gap-1.5 shadow-xs"
            title={canUpdate ? 'Bulk Update selected records' : 'Permission denied: update'}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Bulk Update</span>
          </Button>
        )}

        {onBulkArchive && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canArchive}
            onClick={onBulkArchive}
            className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 hover:border-amber-500/40"
            title={canArchive ? 'Archive / Soft Delete selected records' : 'Permission denied: archive'}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Archive</span>
          </Button>
        )}

        {onBulkRestore && (
          <Button
            size="sm"
            variant="secondary"
            disabled={!canRestore}
            onClick={onBulkRestore}
            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40"
            title={canRestore ? 'Restore selected archived records' : 'Permission denied: restore'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore</span>
          </Button>
        )}

        {/* More Actions Dropdown */}
        <div className="relative">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className="flex items-center gap-1 text-slate-300"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </Button>

          {isMoreOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsMoreOpen(false)}
              />
              <div className="absolute right-0 bottom-full mb-2 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 space-y-1 font-mono text-xs animate-in fade-in duration-150">
                {onSelectAll && (
                  <button
                    onClick={() => {
                      onSelectAll();
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center justify-between"
                  >
                    <span>Select All ({totalCount || 'All'})</span>
                    <span className="text-[10px] text-slate-500">⌘A</span>
                  </button>
                )}

                {(onExportSelected || onExportCSV) && (
                  <button
                    onClick={() => {
                      if (onExportCSV) onExportCSV();
                      else if (onExportSelected) onExportSelected('csv');
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export CSV</span>
                  </button>
                )}

                {(onExportSelected || onExportJSON) && (
                  <button
                    onClick={() => {
                      if (onExportJSON) onExportJSON();
                      else if (onExportSelected) onExportSelected('json');
                      setIsMoreOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 text-slate-200 flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Export JSON</span>
                  </button>
                )}

                {onBulkDelete && (
                  <div className="pt-1 border-t border-slate-800">
                    <button
                      disabled={!canDelete}
                      onClick={() => {
                        onBulkDelete();
                        setIsMoreOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 flex items-center gap-2 disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hard Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={onClearSelection}
        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors ml-auto"
        title="Deselect all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
