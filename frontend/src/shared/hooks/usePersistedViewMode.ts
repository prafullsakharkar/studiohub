import { useState } from 'react';
import type { DataViewMode } from '@/types/common';

type EntityViewMode = 'table' | 'grid';

const keyFor = (entityType: string) => `studiohub_entity_view_${entityType}`;

export function usePersistedViewMode(entityType: string): [EntityViewMode, (m: EntityViewMode) => void] {
  const [mode, setMode] = useState<EntityViewMode>(() => {
    try {
      const raw = localStorage.getItem(keyFor(entityType));
      return raw === 'grid' || raw === 'table' ? raw : 'table';
    } catch {
      return 'table';
    }
  });
  const set = (m: EntityViewMode) => {
    setMode(m);
    try {
      localStorage.setItem(keyFor(entityType), m);
    } catch {
      // storage unavailable (private mode): state still works for the session
    }
  };
  return [mode, set];
}
