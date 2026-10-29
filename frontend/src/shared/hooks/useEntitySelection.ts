import { useCallback, useState } from 'react';

/** Row selection state shared by EntityTable + GridView bulk flows. */
export function useEntitySelection() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }, []);

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.includes(id));
      return allSelected ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])];
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  return { selectedIds, toggleSelect, toggleSelectAll, clearSelection };
}
