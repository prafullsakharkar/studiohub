import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Network, Folder, Layers, CheckSquare, Film, Boxes } from 'lucide-react';
import { FieldDefinition } from '@/types/crud';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { EntityReferenceComponent } from '@/shared/relationships/EntityReference';

interface HierarchyViewProps<T = any> {
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
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Group top-level nodes
  const rootGroups: Record<string, T[]> = React.useMemo(() => {
    const map: Record<string, T[]> = {};
    data.forEach((item: any) => {
      const key = String(item[groupBy] || item.project_id || item.category || 'Root Group');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [data, groupBy]);

  const toggleNode = (nodeKey: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3 shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-slate-200">
            Entity Hierarchy Structure (Grouped by: <span className="font-mono text-indigo-400">{groupBy}</span>)
          </h4>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {Object.keys(rootGroups).length} Parent Branches
        </span>
      </div>

      {data.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="space-y-2">
          {Object.entries(rootGroups).map(([groupTitle, items]) => {
            const isCollapsed = collapsedNodes[groupTitle];

            return (
              <div
                key={groupTitle}
                className="rounded-lg bg-slate-950/40 border border-slate-800/80 overflow-hidden"
              >
                {/* Node Parent Header */}
                <div
                  onClick={() => toggleNode(groupTitle)}
                  className="flex items-center justify-between p-3 bg-slate-950/70 hover:bg-slate-900/80 cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                    <Folder className="w-4 h-4 text-amber-400" />
                    <span className="font-mono text-xs font-bold text-slate-200">
                      {groupTitle}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {items.length} child entities
                    </span>
                  </div>
                </div>

                {/* Child Leaves */}
                {!isCollapsed && (
                  <div className="p-2 space-y-1.5 pl-6 border-t border-slate-800/60 bg-slate-900/20">
                    {items.map((item: any) => {
                      const title = item.name || item.title || item.code;
                      const code = item.code || item.slug || item.id;
                      const status = item.status;
                      const priority = item.priority;

                      return (
                        <div
                          key={item.id}
                          onClick={() => onItemClick && onItemClick(item)}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer transition-colors text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[11px] text-indigo-400 font-semibold flex-shrink-0">
                              {code}
                            </span>
                            <span className="text-slate-200 font-medium truncate">
                              {title}
                            </span>
                            {item.department && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {item.department}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
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
      )}
    </div>
  );
}
