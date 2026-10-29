import { useAuth } from '@/modules/auth';
import type React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import type {
  UniversalEntityType,
  EntityReference,
} from '@/types/workspace';
import {
  searchUniversalEntities,
  formatEntityType,
} from '@/core/workspace/entityRegistry';
import { accessControl } from '@/core/permissions/accessControl';

/** Entity-type → view permission. Types without a granted view perm are hidden. */
const UNIVERSAL_TYPE_VIEW_PERMISSION: Record<string, string> = {
  project: 'project.view',
  shot: 'shot.view',
  asset: 'asset.view',
  task: 'task.view',
  version: 'version.view',
  review: 'review.view',
  playlist: 'review.view',
  media: 'media.view',
  person: 'people.view',
  client: 'client.view',
  vendor: 'vendor.view',
  department: 'department.view',
  team: 'team.view',
  office: 'office.view',
};
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import {
  Search,
  X,
  Columns,
  Maximize2,
  PanelRight,
  Eye,
  Layers,
  Sparkles,
} from 'lucide-react';
import { getEntityIcon, getEntityColorClass } from './EntityRef';
import { cn } from '@/shared/utils/cn';

interface UniversalEntitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversalEntitySearchModal: React.FC<UniversalEntitySearchModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<UniversalEntityType | 'all'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const { openInWorkspace, openPeek, openDrawer, openTab } = useWorkspaceStore();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setFilterType('all');
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  const { can, user } = useAuth();
  const canViewUniversalCategory = (type: UniversalEntityType): boolean => {
    const permission = UNIVERSAL_TYPE_VIEW_PERMISSION[type];
    if (permission && !can(permission)) return false;
    return true;
  };

  const canViewUniversalType = (item: EntityReference): boolean => {
    const permission = UNIVERSAL_TYPE_VIEW_PERMISSION[item.type];
    if (permission && !can(permission)) return false;

    if (item.type === 'project') {
      return accessControl.canAccessProject(user, item.id);
    }

    return true;
  };

  const results = useMemo(() => {
    const raw = searchUniversalEntities(
      query,
      filterType === 'all' ? undefined : filterType
    ).filter((item) => canViewUniversalType(item));

    if (filterType !== 'all') {
      return raw;
    }

    const categoryPriority: Record<string, number> = {
      project: 1,
      shot: 2,
      asset: 3,
      task: 4,
      version: 5,
      review: 6,
      playlist: 7,
      media: 8,
      person: 9,
      client: 10,
      vendor: 11,
      department: 12,
      team: 13,
      office: 14,
    };

    return [...raw].sort((a, b) => {
      const pA = categoryPriority[a.type] || 99;
      const pB = categoryPriority[b.type] || 99;
      return pA - pB;
    });
  }, [query, filterType, can]);

  const allResults = useMemo(
    () => searchUniversalEntities(query).filter((item) => canViewUniversalType(item)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, can, user]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allResults.length };
    allResults.forEach((item) => {
      counts[item.type] = (counts[item.type] || 0) + 1;
    });
    return counts;
  }, [allResults]);

  const categories: Array<{ id: UniversalEntityType | 'all'; label: string }> = [
    { id: 'all', label: 'All Categories' },
    { id: 'project', label: 'Projects' },
    { id: 'shot', label: 'Shots' },
    { id: 'asset', label: 'Assets' },
    { id: 'task', label: 'Tasks' },
    { id: 'version', label: 'Versions' },
    { id: 'person', label: 'People' },
    { id: 'client', label: 'Clients' },
    { id: 'vendor', label: 'Vendors' },
  ].filter((cat) => cat.id === 'all' || canViewUniversalCategory(cat.id));

  const groupedCategories = useMemo(() => {
    if (filterType !== 'all') return [];
    const groups: Array<{ category: { id: UniversalEntityType | 'all'; label: string }; items: EntityReference[] }> = [];

    categories.forEach((cat) => {
      if (cat.id === 'all') return;
      const items = results.filter((r) => r.type === cat.id);
      if (items.length > 0) {
        groups.push({ category: cat, items });
      }
    });

    // Also include any entity types not in standard category pills
    const listedTypes = new Set(categories.map((c) => c.id as string));
    const others = results.filter((r) => !listedTypes.has(r.type));
    if (others.length > 0) {
      groups.push({
        category: { id: 'all' as any, label: 'Other Entities' },
        items: others,
      });
    }

    return groups;
  }, [results, filterType, categories]);

  if (!isOpen) return null;

  const renderEntityRow = (item: EntityReference) => {
    const Icon = getEntityIcon(item.type);
    const colorClass = getEntityColorClass(item.type);

    return (
      <div
        key={`${item.type}-${item.id}`}
        onClick={() => {
          onClose();
          openTab(item);
        }}
        className="p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <div className={cn('p-2 rounded-lg border shrink-0', colorClass)}>
            <Icon className="w-4 h-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60 shrink-0 min-w-[70px] text-center">
                {formatEntityType(item.type)}
              </span>
              <span className="font-mono text-xs font-bold text-white truncate">
                {item.type === 'person' ? item.title : (item.code || item.title)}
              </span>
              {item.status && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300 shrink-0">
                  {item.status}
                </span>
              )}
            </div>
            {item.title && item.title !== item.code && item.type !== 'person' && (
              <p className="text-slate-300 text-[11px] truncate mt-0.5 font-medium">
                {item.title}
              </p>
            )}
            {item.subtitle && (
              <p className="text-slate-500 font-mono text-[10px] truncate mt-0.5">
                {item.subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              openPeek(item);
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-800"
            title="Quick Peek"
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              openInWorkspace(item, 'split');
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-800"
            title="Open in Split View"
          >
            <Columns className="w-3.5 h-3.5 text-indigo-400" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              openDrawer(item);
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-slate-300 border border-slate-800"
            title="Open in Drawer"
          >
            <PanelRight className="w-3.5 h-3.5 text-purple-400" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/75 backdrop-blur-xs animate-in fade-in select-none">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] font-sans">
        {/* Search Input Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            placeholder="Search across all studio entities (e.g. NK_010, Warner, Cyberpunk, Alex)..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-hidden font-mono"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 overflow-x-auto no-scrollbar text-xs font-mono select-none">
          {categories.map((cat) => {
            const count = categoryCounts[cat.id] || 0;
            const isActive = filterType === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setFilterType(cat.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all shrink-0 flex items-center space-x-1.5 text-xs font-medium cursor-pointer',
                  isActive
                    ? 'bg-indigo-600 text-white font-bold shadow-xs shadow-indigo-500/25 border border-indigo-500'
                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
                )}
                aria-selected={isActive}
                data-state={isActive ? 'active' : 'inactive'}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
                    isActive
                      ? 'bg-indigo-700/80 text-white font-bold'
                      : 'bg-slate-800 text-slate-400'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 text-xs space-y-4">
          {(!results || results.length === 0) ? (
            <div className="p-8 text-center text-slate-500 font-mono">
              No matching studio entities found for "{query}".
            </div>
          ) : filterType === 'all' ? (
            groupedCategories.map(({ category, items }) => (
              <div key={category.id} className="space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-950/40 rounded-lg border border-slate-800/50">
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {category.label}
                  </span>
                  <span className="text-slate-500 font-normal">{items.length} items</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(renderEntityRow)}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1.5">
              {results.map(renderEntityRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
