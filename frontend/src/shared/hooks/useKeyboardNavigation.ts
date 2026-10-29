import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardNavigationProps {
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenPermissionsModal?: () => void;
  onOpenTour?: () => void;
  /**
   * Optional route-access checker (registry-driven). When provided, go-to
   * shortcuts to unauthorized destinations are ignored instead of
   * navigating into a 403. Defaults to allow (backward compatible).
   */
  canNavigate?: (path: string) => boolean;
}

export const useKeyboardNavigation = ({
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onOpenPermissionsModal,
  onOpenTour,
  canNavigate,
}: UseKeyboardNavigationProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently focused in an input/textarea/select
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // ⌘K or Ctrl+K -> Global Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      // ⌘ Shift P -> Permissions Simulator
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onOpenPermissionsModal?.();
        return;
      }

      if (isInput) return;

      // '?' -> Keyboard shortcuts cheat sheet
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onOpenShortcutsModal?.();
        return;
      }

      // Go-To sequences: 'g' then <key>
      const now = Date.now();
      if (lastKey === 'g' && now - lastKeyTime < 1000) {
        const target = e.key.toLowerCase();
        const goTo = (path: string) => {
          // Unauthorized destinations are ignored (no silent 403 hop).
          if (canNavigate && !canNavigate(path)) return;
          e.preventDefault();
          navigate(path);
        };
        switch (target) {
          case 'd':
            goTo('/dashboard');
            break;
          case 'p':
            goTo('/projects');
            break;
          case 's':
            goTo('/shots');
            break;
          case 'a':
            goTo('/assets');
            break;
          case 't':
            goTo('/tasks');
            break;
          case 'r':
            goTo('/reviews');
            break;
          case 'c':
            goTo('/clients');
            break;
          case 'v':
            goTo('/vendors');
            break;
          case 'u':
            goTo('/people');
            break;
          case 'l':
            goTo('/activity');
            break;
          case 'h':
            e.preventDefault();
            onOpenTour?.();
            break;
          default:
            break;
        }
        lastKey = '';
        return;
      }

      if (e.key.toLowerCase() === 'g') {
        lastKey = 'g';
        lastKeyTime = now;
      } else {
        lastKey = '';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onOpenCommandPalette, onOpenShortcutsModal, onOpenPermissionsModal, onOpenTour, canNavigate]);
};
