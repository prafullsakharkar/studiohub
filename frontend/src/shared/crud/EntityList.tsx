import React, { useState } from 'react';
import {
  EntityType,
  FieldDefinition,
  DataViewMode,
  BulkAction,
  EntityAction,
} from '@/types/crud';
import { ProductionView } from '@/shared/views/ProductionView';
import { CreateDialog } from './CreateDialog';
import { EditDrawer } from './EditDrawer';
import { DeleteDialog } from './DeleteDialog';
import { ArchiveDialog } from './ArchiveDialog';
import { EntityDetail } from './EntityDetail';
import { createStandardBulkActions } from './BulkActions';
import { createStandardEntityActions } from './EntityActions';
import { entityRegistry } from '@/shared/relationships/entityRegistry';

interface EntityListProps<T = any> {
  entityType: EntityType;
  items: T[];
  fields: FieldDefinition<T>[];
  onItemCreate?: (item: Partial<T>) => void | Promise<void>;
  onItemUpdate?: (item: T) => void | Promise<void>;
  onItemDelete?: (id: string) => void | Promise<void>;
  onItemArchive?: (id: string) => void | Promise<void>;
  onItemRestore?: (id: string) => void | Promise<void>;
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onBulkArchive?: (ids: string[]) => void | Promise<void>;
  onBulkStatusChange?: (ids: string[], status: string) => void | Promise<void>;
  initialViewMode?: DataViewMode;
  initialGroupBy?: string;
  className?: string;
}

export function EntityList<T extends Record<string, any> & { id: string; status?: string }>({
  entityType,
  items: initialItems,
  fields,
  onItemCreate,
  onItemUpdate,
  onItemDelete,
  onItemArchive,
  onItemRestore,
  onBulkDelete,
  onBulkArchive,
  onBulkStatusChange,
  initialViewMode = 'table',
  initialGroupBy,
  className = '',
}: EntityListProps<T>) {
  // Local active collection state for responsive mutations
  const [items, setItems] = useState<T[]>(initialItems);

  // Synchronize when parent prop updates
  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Modal / Drawer state controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [detailItem, setDetailItem] = useState<T | null>(null);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  const [archivingItem, setArchivingItem] = useState<{ item: T; isRestore: boolean } | null>(null);

  const meta = entityRegistry.getMetadata(entityType);

  // Handlers
  const handleCreateSubmit = async (values: T) => {
    const newItem: T = {
      ...values,
      id: values.id || `${entityType}-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    if (onItemCreate) await onItemCreate(newItem);
    setIsCreateOpen(false);
  };

  const handleUpdateSave = async (updated: T) => {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    if (onItemUpdate) await onItemUpdate(updated);
    setEditingItem(null);
    if (detailItem && detailItem.id === updated.id) {
      setDetailItem(updated);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    setItems((prev) => prev.filter((item) => item.id !== deletingItem.id));
    if (onItemDelete) await onItemDelete(deletingItem.id);
    if (detailItem && detailItem.id === deletingItem.id) {
      setDetailItem(null);
    }
    setDeletingItem(null);
  };

  const handleArchiveConfirm = async () => {
    if (!archivingItem) return;
    const { item, isRestore } = archivingItem;
    const newStatus = isRestore ? 'Active' : 'Archived';
    const updated = { ...item, status: newStatus };

    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
    if (isRestore && onItemRestore) {
      await onItemRestore(item.id);
    } else if (!isRestore && onItemArchive) {
      await onItemArchive(item.id);
    }

    if (detailItem && detailItem.id === item.id) {
      setDetailItem(updated);
    }
    setArchivingItem(null);
  };

  const handleClone = (item: T) => {
    const cloned: T = {
      ...item,
      id: `${entityType}-${Date.now()}`,
      name: item.name ? `${item.name} (Clone)` : undefined,
      title: item.title ? `${item.title} (Clone)` : undefined,
      code: item.code ? `${item.code}-COPY` : undefined,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [cloned, ...prev]);
  };

  // Standard entity actions for row menus
  const entityActions: EntityAction<T>[] = createStandardEntityActions<T>(entityType, {
    onView: (item) => setDetailItem(item),
    onEdit: (item) => setEditingItem(item),
    onClone: handleClone,
    onArchive: (item) => setArchivingItem({ item, isRestore: false }),
    onRestore: (item) => setArchivingItem({ item, isRestore: true }),
    onDelete: (item) => setDeletingItem(item),
  });

  // Standard bulk actions
  const bulkActions: BulkAction<T>[] = createStandardBulkActions<T>(entityType, {
    onBulkDelete: async (ids) => {
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
      if (onBulkDelete) await onBulkDelete(ids);
    },
    onBulkArchive: async (ids) => {
      setItems((prev) =>
        prev.map((i) => (ids.includes(i.id) ? { ...i, status: 'Archived' } : i))
      );
      if (onBulkArchive) await onBulkArchive(ids);
    },
    onBulkStatusChange: async (ids, status) => {
      setItems((prev) =>
        prev.map((i) => (ids.includes(i.id) ? { ...i, status } : i))
      );
      if (onBulkStatusChange) await onBulkStatusChange(ids, status);
    },
  });

  // If Detail view is open, render EntityDetail
  if (detailItem) {
    return (
      <EntityDetail
        entityType={entityType}
        item={detailItem}
        fields={fields}
        onBack={() => setDetailItem(null)}
        onEdit={(item) => setEditingItem(item)}
        onClone={handleClone}
        onArchive={(item) => setArchivingItem({ item, isRestore: false })}
        onRestore={(item) => setArchivingItem({ item, isRestore: true })}
        onDelete={(item) => setDeletingItem(item)}
        className={className}
      />
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Universal Production Multi-View */}
      <ProductionView
        entityType={entityType}
        data={items}
        fields={fields}
        initialViewMode={initialViewMode}
        initialGroupBy={initialGroupBy}
        bulkActions={bulkActions}
        entityActions={entityActions}
        onItemClick={(item) => setDetailItem(item)}
        onAddNew={() => setIsCreateOpen(true)}
      />

      {/* 1. Create Modal Dialog */}
      <CreateDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        entityType={entityType}
        fields={fields}
        onSubmit={handleCreateSubmit}
      />

      {/* 2. Edit Side Drawer */}
      {editingItem && (
        <EditDrawer
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          entityType={entityType}
          entityId={editingItem.id}
          item={editingItem}
          fields={fields}
          onSave={handleUpdateSave}
        />
      )}

      {/* 3. Delete Confirmation Dialog */}
      <DeleteDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteConfirm}
        itemTitle={deletingItem?.name || deletingItem?.title || deletingItem?.code}
        itemType={meta?.label || entityType}
      />

      {/* 4. Archive / Restore Dialog */}
      {archivingItem && (
        <ArchiveDialog
          isOpen={!!archivingItem}
          onClose={() => setArchivingItem(null)}
          onConfirm={handleArchiveConfirm}
          itemTitle={archivingItem.item.name || archivingItem.item.title || archivingItem.item.code}
          itemType={meta?.label || entityType}
          isRestoreMode={archivingItem.isRestore}
        />
      )}
    </div>
  );
}
