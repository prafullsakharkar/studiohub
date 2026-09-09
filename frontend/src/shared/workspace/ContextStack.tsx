import React from 'react';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { formatEntityType } from '@/core/workspace/entityRegistry';
import {
  History,
  X,
  Trash2,
  Maximize2,
  Columns,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { EntityRef, getEntityIcon, getEntityColorClass } from './EntityRef';
import { cn } from '@/shared/utils/cn';

interface ContextStackProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContextStack: React.FC<ContextStackProps> = ({ isOpen, onClose }) => {
  const {
    contextStack,
    jumpToContextStackIndex,
    clearContextStack,
    openInWorkspace,
  } = useWorkspaceStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in select-none">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] font-sans">
        {/* Top Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Context History Stack</h3>
              <p className="text-xs text-slate-400 font-mono">
                Recent transversal jumps ({contextStack.length} nodes)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {contextStack.length > 0 && (
              <button
                onClick={clearContextStack}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                title="Clear Context History"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stack Items */}
        <div className="p-4 overflow-y-auto space-y-2.5 custom-scrollbar flex-1 text-xs">
          {contextStack.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono">
              Context history stack is currently empty.
            </div>
          ) : (
            contextStack.map((entry, index) => {
              const Icon = getEntityIcon(entry.entity.type);
              const colorClass = getEntityColorClass(entry.entity.type);

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-xl transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="text-[10px] font-mono text-slate-500 w-5 text-right shrink-0">
                      #{index + 1}
                    </div>

                    <div className={cn('p-1.5 rounded-lg border shrink-0', colorClass)}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
                          {formatEntityType(entry.entity.type)}
                        </span>
                        <span className="font-mono text-xs font-bold text-white truncate">
                          {entry.entity.code || entry.entity.title || entry.entity.id}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                        {entry.label && (
                          <span className="text-indigo-400 font-medium truncate">
                            • {entry.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0 opacity-80 group-hover:opacity-100">
                    <button
                      onClick={() => {
                        onClose();
                        openInWorkspace(entry.entity, 'split');
                      }}
                      className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-mono flex items-center gap-1 border border-slate-800"
                    >
                      <Columns className="w-3 h-3 text-indigo-400" />
                      <span className="hidden sm:inline">Split</span>
                    </button>

                    <button
                      onClick={() => {
                        onClose();
                        jumpToContextStackIndex(index);
                      }}
                      className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold flex items-center gap-1"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Jump</span>
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
