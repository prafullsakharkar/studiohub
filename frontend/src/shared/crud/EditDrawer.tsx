import React, { useState } from 'react';
import { X, Edit3, Network, Save } from 'lucide-react';
import { FieldDefinition, EntityType } from '@/types/crud';
import { EntityForm } from './EntityForm';
import { RelatedEntities } from '@/shared/relationships/RelatedEntities';
import { entityRegistry } from '@/shared/relationships/entityRegistry';

interface EditDrawerProps<T = any> {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: string;
  item: T;
  fields: FieldDefinition<T>[];
  onSave: (values: T) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function EditDrawer<T extends Record<string, any> & { id: string }>({
  isOpen,
  onClose,
  entityType,
  entityId,
  item,
  fields,
  onSave,
  isSubmitting = false,
}: EditDrawerProps<T>) {
  const [activeTab, setActiveTab] = useState<'details' | 'relations'>('details');

  if (!isOpen) return null;

  const meta = entityRegistry.getMetadata(entityType);
  const title = item.name || item.title || item.code || `Edit ${meta?.label || entityType}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Drawer Header */}
          <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-wider text-indigo-400 font-bold block">
                {meta?.label || entityType} Editor
              </span>
              <h3 className="text-base font-bold text-slate-100 truncate max-w-md">
                {title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Tab Strip */}
          <div className="flex border-b border-slate-800 px-4 bg-slate-950/40">
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'details'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Attributes & Fields</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('relations')}
              className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
                activeTab === 'relations'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Connected Relationships</span>
            </button>
          </div>

          {/* Drawer Content */}
          <div className="p-5 overflow-y-auto flex-1 space-y-4">
            {activeTab === 'details' ? (
              <EntityForm
                fields={fields}
                initialValues={item}
                onSubmit={async (values) => {
                  await onSave(values);
                  onClose();
                }}
                onCancel={onClose}
                submitLabel="Save Changes"
                isSubmitting={isSubmitting}
              />
            ) : (
              <div className="space-y-4">
                <RelatedEntities
                  entityType={entityType}
                  entityId={entityId}
                  title={`Direct Relationships for ${title}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
