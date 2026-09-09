import React from 'react';
import { BulkAction, EntityType } from '@/types/crud';
import { Archive, Trash2, Tag, CheckCircle2, UserCheck, Share2, Download } from 'lucide-react';

export function createStandardBulkActions<T extends { id: string }>(
  entityType: EntityType,
  handlers: {
    onBulkDelete?: (ids: string[]) => void;
    onBulkArchive?: (ids: string[]) => void;
    onBulkStatusChange?: (ids: string[], status: string) => void;
    onBulkExport?: (ids: string[], items: T[]) => void;
  }
): BulkAction<T>[] {
  const actions: BulkAction<T>[] = [];

  if (handlers.onBulkStatusChange) {
    actions.push({
      id: 'bulk-approve',
      label: 'Mark Approved',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      action: (ids) => handlers.onBulkStatusChange!(ids, 'Approved'),
    });
  }

  if (handlers.onBulkArchive) {
    actions.push({
      id: 'bulk-archive',
      label: 'Archive Selected',
      icon: <Archive className="w-3.5 h-3.5 text-amber-400" />,
      action: (ids) => handlers.onBulkArchive!(ids),
    });
  }

  if (handlers.onBulkDelete) {
    actions.push({
      id: 'bulk-delete',
      label: 'Delete Selected',
      variant: 'danger',
      icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
      action: (ids) => handlers.onBulkDelete!(ids),
    });
  }

  return actions;
}
