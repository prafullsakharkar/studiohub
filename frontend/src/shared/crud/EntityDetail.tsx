import React, { useState } from 'react';
import {
  ArrowLeft,
  Edit2,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
  Network,
  Clock,
  FileText,
  Layers,
  Calendar,
  ExternalLink,
  Shield,
  Activity as ActivityIcon,
} from 'lucide-react';
import { EntityType, FieldDefinition } from '@/types/crud';
import { entityRegistry } from '@/shared/relationships/entityRegistry';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { EntityReferenceComponent } from '@/shared/relationships/EntityReference';
import { RelatedEntities } from '@/shared/relationships/RelatedEntities';
import { Button } from '@/shared/components/Button';

interface EntityDetailProps<T = any> {
  entityType: EntityType;
  item: T;
  fields: FieldDefinition<T>[];
  onBack?: () => void;
  onEdit?: (item: T) => void;
  onClone?: (item: T) => void;
  onArchive?: (item: T) => void;
  onRestore?: (item: T) => void;
  onDelete?: (item: T) => void;
  className?: string;
}

export function EntityDetail<T extends Record<string, any> & { id: string }>({
  entityType,
  item,
  fields,
  onBack,
  onEdit,
  onClone,
  onArchive,
  onRestore,
  onDelete,
  className = '',
}: EntityDetailProps<T>) {
  const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'activity'>('overview');

  const meta = entityRegistry.getMetadata(entityType);
  const title = item.name || item.title || item.code || `Entity #${item.id}`;
  const code = item.code || item.slug || item.id;
  const status = item.status;
  const priority = item.priority;
  const thumbnail = item.thumbnail_url || item.avatar_url || item.banner_url;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Navigation & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors"
              title="Back to list"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/30">
                {code}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {meta?.label || entityType}
              </span>
              {status && <StatusBadge status={status} size="sm" />}
              {priority && <PriorityBadge priority={priority} size="sm" />}
            </div>
            <h1 className="text-lg font-bold text-slate-100 mt-1">{title}</h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onEdit(item)}
              className="gap-1.5 text-xs py-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>
          )}

          {onClone && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onClone(item)}
              className="gap-1.5 text-xs py-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Clone</span>
            </Button>
          )}

          {status === 'Archived' ? (
            onRestore && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onRestore(item)}
                className="gap-1.5 text-xs py-1.5 text-emerald-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore</span>
              </Button>
            )
          ) : (
            onArchive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onArchive(item)}
                className="gap-1.5 text-xs py-1.5 text-amber-400"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </Button>
            )
          )}

          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(item)}
              className="gap-1.5 text-xs py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-6 px-2">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Properties & Metadata</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('relationships')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'relationships'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Connected Relationships</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={`flex items-center gap-2 py-3 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'activity'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ActivityIcon className="w-4 h-4" />
          <span>Audit Activity Log</span>
        </button>
      </div>

      {/* Tab 1: Properties & Metadata */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Attributes Panel */}
          <div className="lg:col-span-2 space-y-6">
            {thumbnail && (
              <div className="rounded-xl overflow-hidden border border-slate-800 aspect-video bg-black max-h-80 shadow-md">
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                Entity Properties
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((f) => {
                  const val = item[f.key];
                  if (val === undefined || val === null || val === '') return null;

                  return (
                    <div key={f.key} className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-800/60">
                      <span className="text-[11px] font-semibold text-slate-400 block">
                        {f.label}
                      </span>

                      {f.type === 'reference' && f.referenceType ? (
                        <EntityReferenceComponent
                          type={f.referenceType}
                          id={val}
                          variant="pill"
                          showAvatar
                          showCode
                        />
                      ) : f.type === 'status' ? (
                        <StatusBadge status={val} size="sm" />
                      ) : f.type === 'priority' ? (
                        <PriorityBadge priority={val} size="sm" />
                      ) : (
                        <span className="text-xs text-slate-200 font-medium break-words">
                          {String(val)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Side Summary & System Info */}
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <h4 className="font-semibold text-slate-300 border-b border-slate-800 pb-2">
                System Context
              </h4>
              <div className="space-y-2 text-slate-400 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span>Canonical ID:</span>
                  <span className="text-slate-200">{item.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Entity Type:</span>
                  <span className="text-indigo-400 uppercase">{entityType}</span>
                </div>
                {item.created_at && (
                  <div className="flex justify-between">
                    <span>Created At:</span>
                    <span className="text-slate-300">{item.created_at.split('T')[0]}</span>
                  </div>
                )}
                {item.updated_at && (
                  <div className="flex justify-between">
                    <span>Last Updated:</span>
                    <span className="text-slate-300">{item.updated_at.split('T')[0]}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Connected Relationships */}
      {activeTab === 'relationships' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
          <RelatedEntities
            entityType={entityType}
            entityId={item.id}
            title={`Interconnected Graph for ${code}: ${title}`}
          />
        </div>
      )}

      {/* Tab 3: Activity Log */}
      {activeTab === 'activity' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
          <h4 className="text-xs font-semibold text-slate-200">
            Recent Audit & State Changes
          </h4>
          <div className="space-y-3">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Record initialized with status: <strong className="text-slate-100">{status || 'Active'}</strong></span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">2 days ago</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-slate-300">Relationship graph linked to project container</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">Yesterday</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
