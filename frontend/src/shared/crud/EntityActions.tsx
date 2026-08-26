import React from 'react';
import { EntityAction, EntityType } from '@/types/crud';
import { Edit, Eye, Copy, Archive, RotateCcw, Trash2, Network, Link2 } from 'lucide-react';

export function createStandardEntityActions<T extends { id: string; status?: string }>(
  entityType: EntityType,
  handlers: {
    onView?: (item: T) => void;
    onEdit?: (item: T) => void;
    onClone?: (item: T) => void;
    onArchive?: (item: T) => void;
    onRestore?: (item: T) => void;
    onDelete?: (item: T) => void;
  }
): EntityAction<T>[] {
  const actions: EntityAction<T>[] = [];

  if (handlers.onView) {
    actions.push({
      id: 'view',
      label: 'View Details',
      icon: <Eye className="w-3.5 h-3.5 text-indigo-400" />,
      action: handlers.onView,
    });
  }

  if (handlers.onEdit) {
    actions.push({
      id: 'edit',
      label: 'Edit Record',
      icon: <Edit className="w-3.5 h-3.5 text-slate-300" />,
      action: handlers.onEdit,
    });
  }

  if (handlers.onClone) {
    actions.push({
      id: 'clone',
      label: 'Clone Entity',
      icon: <Copy className="w-3.5 h-3.5 text-slate-400" />,
      action: handlers.onClone,
    });
  }

  if (handlers.onArchive) {
    actions.push({
      id: 'archive',
      label: 'Archive',
      icon: <Archive className="w-3.5 h-3.5 text-amber-400" />,
      action: handlers.onArchive,
      isVisible: (item) => item.status !== 'Archived',
    });
  }

  if (handlers.onRestore) {
    actions.push({
      id: 'restore',
      label: 'Restore Active',
      icon: <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />,
      action: handlers.onRestore,
      isVisible: (item) => item.status === 'Archived',
    });
  }

  if (handlers.onDelete) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
      action: handlers.onDelete,
    });
  }

  return actions;
}
