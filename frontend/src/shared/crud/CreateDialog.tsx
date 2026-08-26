import React from 'react';
import { FieldDefinition, EntityType } from '@/types/crud';
import { Modal } from '@/shared/components/Modal';
import { EntityForm } from './EntityForm';
import { entityRegistry } from '@/shared/relationships/entityRegistry';

interface CreateDialogProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  fields: FieldDefinition<T>[];
  onSubmit: (values: T) => void | Promise<void>;
  initialValues?: Partial<T>;
  isSubmitting?: boolean;
}

export function CreateDialog<T extends Record<string, any>>({
  isOpen,
  onClose,
  entityType,
  fields,
  onSubmit,
  initialValues,
  isSubmitting = false,
}: CreateDialogProps<T>) {
  const meta = entityRegistry.getMetadata(entityType);
  const title = `Create New ${meta?.label || entityType}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="xl"
    >
      <div className="space-y-4">
        <EntityForm
          fields={fields}
          initialValues={initialValues}
          onSubmit={async (vals) => {
            await onSubmit(vals);
            onClose();
          }}
          onCancel={onClose}
          submitLabel={`Create ${meta?.label || entityType}`}
          isSubmitting={isSubmitting}
        />
      </div>
    </Modal>
  );
}
