import React, { useState } from 'react';
import { KnowledgeEntityRelationship, SearchableEntityType } from '@/types/intelligence';
import { Link2, Plus, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KnowledgeEntityLinksProps {
  linkedEntities: KnowledgeEntityRelationship[];
  onAddLink: (link: Omit<KnowledgeEntityRelationship, 'id'>) => void;
  onRemoveLink: (linkId: string) => void;
  canEdit?: boolean;
}

export const KnowledgeEntityLinks: React.FC<KnowledgeEntityLinksProps> = ({
  linkedEntities,
  onAddLink,
  onRemoveLink,
  canEdit = true,
}) => {
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [targetType, setTargetType] = useState<SearchableEntityType>('shot');
  const [targetTitle, setTargetTitle] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [relType, setRelType] = useState<KnowledgeEntityRelationship['relationship_type']>('applies_to');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetTitle.trim()) return;

    onAddLink({
      target_entity_type: targetType,
      target_entity_id: `ent-${Date.now()}`,
      target_entity_title: targetTitle.trim(),
      target_entity_code: targetCode.trim() || undefined,
      relationship_type: relType,
    });

    setTargetTitle('');
    setTargetCode('');
    setIsAdding(false);
  };

  const getEntityUrl = (entity: KnowledgeEntityRelationship) => {
    switch (entity.target_entity_type) {
      case 'shot':
        return `/shots/${entity.target_entity_id}`;
      case 'task':
        return `/tasks/${entity.target_entity_id}`;
      case 'project':
        return `/projects/${entity.target_entity_id}`;
      case 'asset':
        return `/assets/${entity.target_entity_id}`;
      default:
        return `/${entity.target_entity_type}s`;
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <Link2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Connected Production Entities</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {linkedEntities.length}
          </span>
        </div>
        {canEdit && (
          <button
            id="btn-add-entity-link"
            onClick={() => setIsAdding(!isAdding)}
            className="text-xs px-2 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Link Entity</span>
          </button>
        )}
      </div>

      {/* Add Link Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2.5">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Entity Type</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as any)}
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
              >
                <option value="shot">Shot</option>
                <option value="task">Task</option>
                <option value="project">Project</option>
                <option value="asset">Asset</option>
                <option value="client">Client</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Relationship</label>
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value as any)}
                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
              >
                <option value="applies_to">Applies To</option>
                <option value="governed_by">Governed By</option>
                <option value="documentation_for">Documentation For</option>
                <option value="referenced_by">Referenced By</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="col-span-2">
              <input
                type="text"
                required
                placeholder="Entity Title (e.g. Shot NK99-010-010)"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-400"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Code (optional)"
                value={targetCode}
                onChange={(e) => setTargetCode(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-400 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
            >
              Save Link
            </button>
          </div>
        </form>
      )}

      {/* Linked List */}
      {linkedEntities.length > 0 ? (
        <div className="space-y-1.5">
          {linkedEntities.map((link) => (
            <div
              key={link.id}
              className="group flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 text-xs text-slate-300"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {link.target_entity_type}
                </span>
                <span className="text-slate-400 text-[11px] font-mono">
                  ({link.relationship_type.replace(/_/g, ' ')})
                </span>
                <button
                  onClick={() => navigate(getEntityUrl(link))}
                  className="font-medium text-slate-200 hover:text-indigo-300 truncate flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{link.target_entity_title}</span>
                  {link.target_entity_code && (
                    <span className="text-slate-400 font-mono">[{link.target_entity_code}]</span>
                  )}
                  <ExternalLink className="w-3 h-3 text-slate-400 ml-1" />
                </button>
              </div>

              {canEdit && (
                <button
                  onClick={() => onRemoveLink(link.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 transition-opacity"
                  title="Remove link"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-400 py-1">No production entities linked yet.</p>
      )}
    </div>
  );
};
