import React, { useId } from 'react';
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
 * dialogs. Wraps the shared Modal primitive with consistent a11y semantics
 * (role=dialog, aria-modal, labelledby), Escape handling, focus containment
 * via the underlying Modal, and responsive sizing.
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
  const titleId = useId();
  const descId = useId();

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? descId : undefined}>
      <Modal isOpen={isOpen} onClose={onClose} title={title} subtitle={subtitle} size={size} footer={footer}>
        <div className={cn('min-w-0', className)}>
          <span id={titleId} className="sr-only">
            {title}
          </span>
          {subtitle && (
            <span id={descId} className="sr-only">
              {subtitle}
            </span>
          )}
          {children}
        </div>
      </Modal>
    </div>
  );
};
