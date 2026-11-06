import type React from 'react';
import { useEffect, useRef } from 'react';

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

export interface DialogLayerOptions {
  isOpen: boolean;
  onClose: () => void;
  /** The element with role="dialog": focus is kept inside it. */
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * What every modal dialog does while it is open: Escape closes it, Tab stays inside it, the page behind does not
 * scroll, focus moves in when it opens and back to what opened it when it closes. Undone on close or on unmount while
 * open. Put `data-autofocus` on an element inside (a form) to start focus on its first control instead of the header's close
 * button. A key a control inside has already handled (`preventDefault`) is left to that control.
 * Used by `Modal`; a dialog with its own layout (the command palette) uses it directly.
 */
export function useDialogLayer({ isOpen, onClose, containerRef }: DialogLayerOptions): void {
  // The latest onClose, so callers can pass an inline function without re-running the open/close effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) return;
    const token: OpenDialog = { el: () => containerRef.current };
    openDialogs.push(token);
    const trigger = document.activeElement;

    const onKeyDown = (e: KeyboardEvent) => {
      // A dialog opened from inside this one handles the keys while it is open.
      if (topDialog() !== token || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = focusableIn(containerRef.current);
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
    // Initial focus: the first field of an element marked `data-autofocus` (a form dialog), else the first control,
    // else the dialog itself.
    const t = setTimeout(() => {
      const root = containerRef.current;
      const marked = root?.querySelector<HTMLElement>('[data-autofocus]') ?? null;
      const first = marked ? focusableIn(marked)[0] : undefined;
      (first ?? focusableIn(root)[0] ?? root)?.focus();
    }, 0);

    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKeyDown);
      openDialogs.splice(openDialogs.indexOf(token), 1);
      // The page scrolls again only when the last open dialog has gone.
      if (openDialogs.length === 0) document.body.style.overflow = '';
      // Return focus to what opened the dialog.
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [isOpen, containerRef]);
}
