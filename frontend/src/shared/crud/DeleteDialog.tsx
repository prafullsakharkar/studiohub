import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  itemTitle?: string;
  itemType?: string;
  isDeleting?: boolean;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Permanent Deletion',
  itemTitle,
  itemType = 'record',
  isDeleting = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            isLoading={isDeleting}
            className="gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Permanently Delete</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold">This action cannot be undone.</p>
            <p className="text-slate-400 mt-0.5">
              Are you sure you want to delete {itemTitle ? <span className="font-bold text-rose-200">"{itemTitle}"</span> : `this ${itemType}`}?
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          All references, connected logs, and associated media links will be permanently unlinked from this workspace.
        </p>
      </div>
    </Modal>
  );
};
