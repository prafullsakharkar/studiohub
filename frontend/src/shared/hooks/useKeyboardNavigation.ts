import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseKeyboardNavigationProps {
  onOpenCommandPalette: () => void;
  onOpenShortcutsModal?: () => void;
  onOpenPermissionsModal?: () => void;
}

export const useKeyboardNavigation = ({
  onOpenCommandPalette,
  onOpenShortcutsModal,
  onOpenPermissionsModal,
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
        switch (target) {
          case 'd':
            e.preventDefault();
            navigate('/dashboard');
            break;
          case 'p':
            e.preventDefault();
            navigate('/projects');
            break;
          case 's':
            e.preventDefault();
            navigate('/shots');
            break;
          case 'a':
            e.preventDefault();
            navigate('/assets');
            break;
          case 't':
            e.preventDefault();
            navigate('/tasks');
            break;
          case 'r':
            e.preventDefault();
            navigate('/reviews');
            break;
          case 'o':
            e.preventDefault();
            navigate('/organizations');
            break;
          case 'c':
            e.preventDefault();
            navigate('/clients');
            break;
          case 'v':
            e.preventDefault();
            navigate('/vendors');
            break;
          case 'u':
            e.preventDefault();
            navigate('/people');
            break;
          case 'l':
            e.preventDefault();
            navigate('/activity');
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
  }, [navigate, onOpenCommandPalette, onOpenShortcutsModal, onOpenPermissionsModal]);
};
