import React, { useRef, useState, useCallback } from 'react';
import { WorkspaceTab, EntityReference } from '@/types/workspace';
import { WorkspacePanel } from './WorkspacePanel';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { ArrowLeftRight, X, Maximize2, Columns, Rows } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

interface SplitViewProps {
  tab: WorkspaceTab;
}

export const SplitView: React.FC<SplitViewProps> = ({ tab }) => {
  const { setSplitRatio, closeSplit, swapSplitEntities, setSplitDirection, openInWorkspace } =
    useWorkspaceStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const ratio = tab.splitRatio || 0.5;
  const isHorizontal = tab.splitDirection !== 'vertical';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let newRatio: number;

      if (isHorizontal) {
        newRatio = (moveEvent.clientX - rect.left) / rect.width;
      } else {
        newRatio = (moveEvent.clientY - rect.top) / rect.height;
      }

      setSplitRatio(tab.id, newRatio);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!tab.isSplit || !tab.secondary) {
    return <WorkspacePanel entityRef={tab.primary} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-full w-full overflow-hidden select-none',
        isHorizontal ? 'flex-col md:flex-row' : 'flex-col'
      )}
    >
      {/* Primary Panel */}
      <div
        style={{
          flexBasis: isHorizontal ? `${ratio * 100}%` : `${ratio * 100}%`,
          maxWidth: isHorizontal ? `${ratio * 100}%` : '100%',
          maxHeight: !isHorizontal ? `${ratio * 100}%` : '100%',
        }}
        className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col"
      >
        <WorkspacePanel entityRef={tab.primary} />
      </div>

      {/* Interactive Resizer Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'group relative bg-slate-950 flex items-center justify-center transition-colors z-20 shrink-0 select-none',
          isHorizontal
            ? 'w-2 hover:w-2.5 cursor-col-resize hover:bg-indigo-600/60 border-x border-slate-800'
            : 'h-2 hover:h-2.5 cursor-row-resize hover:bg-indigo-600/60 border-y border-slate-800',
          isDragging && 'bg-indigo-600'
        )}
      >
        {/* Floating Quick Action Hub on Divider */}
        <div
          className={cn(
            'absolute hidden group-hover:flex items-center space-x-1 p-1 bg-slate-900 border border-slate-700 rounded-lg shadow-xl text-slate-300 z-30',
            isHorizontal
              ? 'top-4 left-1/2 -translate-x-1/2'
              : 'left-4 top-1/2 -translate-y-1/2'
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => swapSplitEntities(tab.id)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Swap Panels"
          >
            <ArrowLeftRight className="w-3 h-3" />
          </button>
          <button
            onClick={() =>
              setSplitDirection(tab.id, isHorizontal ? 'vertical' : 'horizontal')
            }
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
            title={isHorizontal ? 'Switch to Vertical Split' : 'Switch to Horizontal Split'}
          >
            {isHorizontal ? <Rows className="w-3 h-3" /> : <Columns className="w-3 h-3" />}
          </button>
          <button
            onClick={() => closeSplit(tab.id)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
            title="Close Split View"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Secondary Panel */}
      <div
        style={{
          flexBasis: isHorizontal ? `${(1 - ratio) * 100}%` : `${(1 - ratio) * 100}%`,
          maxWidth: isHorizontal ? `${(1 - ratio) * 100}%` : '100%',
          maxHeight: !isHorizontal ? `${(1 - ratio) * 100}%` : '100%',
        }}
        className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col bg-slate-900/95"
      >
        <WorkspacePanel
          entityRef={tab.secondary}
          isSecondary
          onCloseSecondary={() => closeSplit(tab.id)}
        />
      </div>
    </div>
  );
};
