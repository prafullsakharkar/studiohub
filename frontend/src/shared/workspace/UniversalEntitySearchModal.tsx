import React, { useState, useEffect, useRef } from 'react';
import {
  UniversalEntityType,
  EntityReference,
} from '@/types/workspace';
import {
  searchUniversalEntities,
  formatEntityType,
} from '@/core/workspace/entityRegistry';
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
  const { openInWorkspace, openPeek, openDrawer } = useWorkspaceStore();

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = searchUniversalEntities(
    query,
    filterType === 'all' ? undefined : filterType
  );

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
  ];

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
        <div className="flex items-center space-x-1.5 px-4 py-2 bg-slate-950/60 border-b border-slate-800 overflow-x-auto custom-scrollbar text-xs font-mono">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={cn(
                'px-2.5 py-1 rounded-lg transition-all shrink-0',
                filterType === cat.id
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto space-y-1.5 custom-scrollbar flex-1 text-xs">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono">
              No matching studio entities found for "{query}".
            </div>
          ) : (
            results.slice(0, 30).map((item) => {
              const Icon = getEntityIcon(item.type);
              const colorClass = getEntityColorClass(item.type);

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => {
                    onClose();
                    openInWorkspace(item, 'full');
                  }}
                  className="p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={cn('p-1.5 rounded-lg border shrink-0', colorClass)}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                          {formatEntityType(item.type)}
                        </span>
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {item.code || item.title}
                        </span>
                        {item.status && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {item.status}
                          </span>
                        )}
                      </div>
                      {item.title && item.title !== item.code && (
                        <p className="text-slate-300 text-[11px] truncate mt-0.5">
                          {item.title}
                        </p>
                      )}
                      {item.subtitle && (
                        <p className="text-slate-500 font-mono text-[10px] truncate">
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
                      className="p-1 rounded bg-slate-900 hover:bg-slate-700 text-slate-300"
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
                      className="p-1 rounded bg-slate-900 hover:bg-slate-700 text-slate-300"
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
                      className="p-1 rounded bg-slate-900 hover:bg-slate-700 text-slate-300"
                      title="Open in Drawer"
                    >
                      <PanelRight className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
