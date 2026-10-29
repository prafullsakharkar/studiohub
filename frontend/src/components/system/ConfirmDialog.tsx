import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { mapHttpError } from '@/api/errors/errorMapper';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/shared/components/Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use the danger style and explain refusals (e.g. 409 has_dependants). */
  destructive?: boolean;
  /**
   * Runs the action. If it throws, the dialog stays open and shows why, using the server's
   * message (a delete blocked by references says what still points at the record).
   */
  onConfirm: () => Promise<unknown> | unknown;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}) => {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ message: string; requestId?: string } | null>(null);

  const close = () => {
    if (pending) return;
    setFailure(null);
    onClose();
  };

  const confirm = async () => {
    setPending(true);
    setFailure(null);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      const apiError = mapHttpError(error);
      setFailure({ message: apiError.userMessage || apiError.message, requestId: apiError.requestId });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={close} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} size="sm" onClick={confirm} disabled={pending}>
            {pending ? 'Working…' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-slate-300">
        <div>{message}</div>
        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-800/70 bg-rose-950/60 p-3 text-xs text-rose-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <div>
              <p>{failure.message}</p>
              {failure.requestId && <p className="mt-1 font-mono text-[10px] text-rose-300/70">Ref: {failure.requestId}</p>}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
