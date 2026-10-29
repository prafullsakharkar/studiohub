import React from 'react';
import { cn } from '@/shared/utils/cn';
import { Modal } from '@/shared/components/Modal';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
  className?: string;
}

/**
 * Canonical StudioHub Dialog.
 *
 * Single authoritative modal implementation for all form and confirmation
 * dialogs. Thin wrapper over the shared Modal primitive, which owns the a11y
 * semantics (role=dialog, aria-modal, labelledby), Escape handling, focus
 * containment and responsive sizing.
 *
 * Use for: FormDialog, ConfirmDialog, entity create/edit, previews.
 * Do not use for: full-height inspectors (use Drawer), workspace peek (use PeekPanel).
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'lg',
  className,
}) => {
  if (!isOpen) return null;

  // Modal already renders the single role="dialog" element (aria-modal, aria-labelledby its own
  // title, focus containment). Wrapping it in a second role="dialog" announced nested dialogs.
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size={size} footer={footer}>
      <div className={cn('min-w-0', className)}>{children}</div>
    </Modal>
  );
};
