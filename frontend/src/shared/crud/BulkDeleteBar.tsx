import React from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/shared/components/Button';

export interface BulkDeleteBarProps {
  selectedCount: number;
  entityLabel: string;
  canDelete: boolean;
  isDeleting?: boolean;
  onDelete: () => void;
  onClear: () => void;
}

/** Floating bulk-action bar for workspace entity multi-select (delete only). */
export const BulkDeleteBar: React.FC<BulkDeleteBarProps> = ({
  selectedCount,
  entityLabel,
  canDelete,
  isDeleting = false,
  onDelete,
  onClear,
}) => {
  if (selectedCount === 0 || !canDelete) return null;
  return (
    <div
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected ${entityLabel}`}
      className="sticky bottom-4 z-30 mx-auto flex w-fit items-center gap-3 rounded-xl border border-indigo-500/40 bg-slate-900/95 px-4 py-2 shadow-2xl backdrop-blur"
    >
      <span className="text-xs font-mono text-slate-200">
        {selectedCount} selected
      </span>
      <Button
        size="xs"
        variant="danger"
        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
        onClick={onDelete}
        isLoading={isDeleting}
      >
        Delete {entityLabel}
      </Button>
      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
