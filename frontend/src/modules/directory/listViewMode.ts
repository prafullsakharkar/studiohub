import { useCallback, useState } from 'react';

export type ListViewMode = 'table' | 'cards' | 'board';

const keyOf = (screen: string) => `studiohub.listView:${screen}`;

/** The saved choice for a screen; a blocked or empty store means the table. */
const read = (screen: string): ListViewMode => {
  try {
    const saved = localStorage.getItem(keyOf(screen));
    return saved === 'cards' || saved === 'board' ? saved : 'table';
  } catch {
    return 'table';
  }
};

/** Table, cards or (when the list has one) board for one list screen, remembered in this browser only (a convenience, never state that must persist). */
export function useListViewMode(screen: string): [ListViewMode, (mode: ListViewMode) => void] {
  const [mode, setMode] = useState<ListViewMode>(() => read(screen));
  const choose = useCallback(
    (next: ListViewMode) => {
      setMode(next);
      try {
        localStorage.setItem(keyOf(screen), next);
      } catch {
        /* a private window or blocked storage: the choice lasts until the page closes */
      }
    },
    [screen],
  );
  return [mode, choose];
}
