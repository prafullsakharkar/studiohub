import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  Layers,
  Network,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';

export interface HierarchyViewProps<T = any> {
  data: T[];
  groupBy?: string;
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function HierarchyView<T extends { id: string }>({
  data,
  groupBy = 'project_code',
  onItemClick,
  emptyMessage = 'No hierarchy data available.',
}: HierarchyViewProps<T>) {
  // Tree grouping structure
  const groupedTree = useMemo(() => {
    const groups: Record<string, T[]> = {};

    data.forEach((item: any) => {
      // Determine primary grouping key
      let key = item[groupBy];
      if (!key) {
        key = item.sequence_code || item.project_code || item.department || 'Root Items';
      }
      const groupKey = String(key);
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });

    return groups;
  }, [data, groupBy]);

  const groupKeys = Object.keys(groupedTree);

  // Expanded nodes state: default all expanded
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    groupKeys.forEach((k) => (init[k] = true));
    return init;
  });

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groupKeys.forEach((k) => (next[k] = true));
    setExpandedKeys(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groupKeys.forEach((k) => (next[k] = false));
    setExpandedKeys(next);
  };

  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500 italic text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shadow-lg">
      {/* Hierarchy Controls Header */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-slate-200">Hierarchical Tree</h4>
          <span className="text-[11px] font-mono text-slate-500">
            ({groupKeys.length} nodes · {data.length} items)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-mono text-[11px]"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Expand All</span>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors font-mono text-[11px]"
          >
            <Minimize2 className="w-3 h-3" />
            <span>Collapse All</span>
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-3 space-y-2">
        {groupKeys.map((groupKey) => {
          const isExpanded = Boolean(expandedKeys[groupKey]);
          const children = groupedTree[groupKey] || [];

          return (
            <div key={groupKey} className="rounded-lg border border-slate-800/80 bg-slate-950/40 overflow-hidden">
              {/* Group Root Node Header */}
              <div
                onClick={() => toggleExpand(groupKey)}
                className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors select-none"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Folder className="w-4 h-4 text-amber-500/80" />
                  )}

                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {groupKey}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {children.length} {children.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
              </div>

              {/* Child Nodes */}
              {isExpanded && (
                <div className="border-t border-slate-800/60 bg-slate-950/20 divide-y divide-slate-800/40 pl-6 pr-2 py-1">
                  {children.map((child: any) => {
                    const code = child.code || child.slug || child.id;
                    const title = child.name || child.title || child.code;
                    const status = child.status;
                    const priority = child.priority;

                    return (
                      <div
                        key={child.id}
                        onClick={() => onItemClick && onItemClick(child)}
                        className={`py-2 px-3 flex items-center justify-between hover:bg-slate-900/60 rounded-md transition-colors group ${
                          onItemClick ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-2 h-px bg-slate-700 shrink-0" />
                          <FileText className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                          <span className="font-mono text-xs font-semibold text-indigo-400 shrink-0">
                            {code}
                          </span>
                          <span className="text-xs text-slate-200 truncate">{title}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {child.assignee_name && (
                            <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[100px]">
                              {child.assignee_name}
                            </span>
                          )}
                          {priority && <PriorityBadge priority={priority} size="sm" />}
                          {status && <StatusBadge status={status} size="sm" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
