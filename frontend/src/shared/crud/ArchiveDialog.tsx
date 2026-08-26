import React from 'react';
import { Archive, RotateCcw } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';

interface ArchiveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemTitle?: string;
  itemType?: string;
  isArchiving?: boolean;
  isRestoreMode?: boolean;
}

export const ArchiveDialog: React.FC<ArchiveDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  itemType = 'record',
  isArchiving = false,
  isRestoreMode = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isRestoreMode ? `Restore ${itemType}` : `Archive ${itemType}`}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isArchiving}>
            Cancel
          </Button>
          <Button
            variant={isRestoreMode ? 'primary' : 'secondary'}
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            isLoading={isArchiving}
            className="gap-1.5"
          >
            {isRestoreMode ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore to Active</span>
              </>
            ) : (
              <>
                <Archive className="w-3.5 h-3.5" />
                <span>Move to Archive</span>
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs">
          <Archive className="w-5 h-5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold">
              {isRestoreMode ? 'Restoring will return this record to active status.' : 'Archiving will hide this record from standard active views.'}
            </p>
            <p className="text-slate-400 mt-0.5">
              {itemTitle ? (
                <span>
                  Target record: <strong className="text-slate-200">{itemTitle}</strong>
                </span>
              ) : (
                `Target ${itemType}`
              )}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          {isRestoreMode
            ? 'The record will immediately re-appear in all default production boards and pipeline tables.'
            : 'You can restore this item at any time by toggling the "Show Archived" filter in your saved views.'}
        </p>
      </div>
    </Modal>
  );
};
