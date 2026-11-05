import type React from 'react';
import { useEffect, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface ModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | 'full' | string;
  className?: string;
  showCloseButton?: boolean;
}

/**
 * Open dialogs, oldest first. Only the top one handles Escape and Tab, so a dialog opened from a dialog closes alone.
 * The top one is the newest that holds no other open dialog: React runs a child's effects before its parent's, so a
 * dialog rendered open inside another one registers first.
 */
type OpenDialog = { el: () => HTMLElement | null };
const openDialogs: OpenDialog[] = [];
const topDialog = (): OpenDialog | undefined =>
  openDialogs.filter((d) => !openDialogs.some((other) => other !== d && Boolean(d.el()?.contains(other.el())))).at(-1);

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const focusableIn = (root: HTMLElement | null): HTMLElement[] => (root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []);

const sizeClasses: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  '4xl': 'max-w-7xl',
  full: 'max-w-[95vw] min-h-[90vh]',
};

export const Modal: React.FC<ModalProps> = ({
  id,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  className,
  showCloseButton = true,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const titleId = useId();

  // The latest onClose, so callers can pass an inline function without re-running the open/close effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Everything that happens while the dialog is open, undone when it closes OR unmounts while open.
  useEffect(() => {
    if (!isOpen) return;
    const token: OpenDialog = { el: () => dialogRef.current };
    openDialogs.push(token);
    triggerRef.current = document.activeElement;
    const isTop = () => topDialog() === token;

    const onKeyDown = (e: KeyboardEvent) => {
      // A dialog opened from inside this one handles the keys while it is open.
      if (!isTop()) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = focusableIn(dialogRef.current);
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    // Initial focus: first control, else the dialog itself.
    const t = setTimeout(() => (focusableIn(dialogRef.current)[0] ?? dialogRef.current)?.focus(), 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      // The page scrolls again only when the last open dialog has gone.
      if (openDialogs.length === 0) document.body.style.overflow = '';
      // Return focus to what opened the dialog.
      const trigger = triggerRef.current;
      triggerRef.current = null;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Dialog Card */}
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            id={id}
            className={cn(
              'relative w-full z-10 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden',
              sizeClasses[size] || sizeClasses.md,
              className
            )}
          >
            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
                <div className="space-y-1 pr-4">
                  {title && (
                    <h3 id={titleId} className="text-lg font-semibold text-slate-100 leading-6">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {subtitle}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content Body */}
            <div className="px-6 py-5 overflow-y-auto flex-1 text-slate-200">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800/80 bg-slate-900/40">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
