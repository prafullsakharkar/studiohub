import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { 
  Layout, 
  Check, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Pin, 
  Table, 
  LayoutGrid, 
  Kanban, 
  Clock, 
  Calendar, 
  GitBranch, 
  Image as ImageIcon 
} from 'lucide-react';
import { usePageLayoutStore, type LayoutDensity, ContainerWidth, type PreferredViewMode } from '@/core/layout/usePageLayoutStore';
import { cn } from '@/shared/utils/cn';

export const LayoutDensityControl: React.FC<{ className?: string; buttonVariant?: 'compact' | 'standard' }> = ({ 
  className,
  buttonVariant = 'standard',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    density,
    containerWidth,
    headerSticky,
    preferredViewMode,
    setDensity,
    setContainerWidth,
    setHeaderSticky,
    setPreferredViewMode,
    resetLayout,
  } = usePageLayoutStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const densities: { id: LayoutDensity; label: string; desc: string }[] = [
    { id: 'compact', label: 'Compact', desc: 'Tight spacing (p-3/4) for high data density' },
    { id: 'comfortable', label: 'Comfortable', desc: 'Standard studio spacing (p-4/6)' },
    { id: 'spacious', label: 'Spacious', desc: 'Expansive breathing room (p-6/8)' },
  ];

  const viewModes: { id: PreferredViewMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'table', label: 'Table', icon: Table },
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'board', label: 'Board', icon: Kanban },
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'hierarchy', label: 'Hierarchy', icon: GitBranch },
    { id: 'gallery', label: 'Gallery', icon: ImageIcon },
  ];

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        id="global-page-layout-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 border",
          buttonVariant === 'compact'
            ? "p-1.5 border-transparent hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
            : "px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border-slate-800 shadow-xs"
        )}
        title="Global Page Layout, Density & View Mode Controls"
        aria-label="Global Page Layout Controls"
      >
        <Layout className="w-4 h-4 text-indigo-400 shrink-0" />
        {buttonVariant === 'standard' && (
          <>
            <span className="capitalize hidden sm:inline">{density}</span>
            <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
              {containerWidth === 'full' ? '100%' : '7XL'}
            </span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 p-3 text-xs space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Layout className="w-3.5 h-3.5 text-indigo-400" />
              Global Page Layout
            </span>
            <button
              onClick={() => resetLayout()}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset layout to system defaults"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Density choices */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Spacing & Table Density
            </span>
            <div className="grid grid-cols-3 gap-1 pt-1">
              {densities.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDensity(d.id)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-center font-medium transition-all text-[11px] flex flex-col items-center justify-center gap-0.5 cursor-pointer',
                    density === d.id
                      ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                      : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                  )}
                  title={d.desc}
                >
                  <span>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Container Width */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Container Width
            </span>
            <div className="grid grid-cols-2 gap-1 pt-1">
              <button
                onClick={() => setContainerWidth('full')}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-center font-medium transition-all text-[11px] flex items-center justify-center gap-1.5 cursor-pointer',
                  containerWidth === 'full'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                )}
              >
                <Maximize2 className="w-3 h-3" />
                <span>Edge-to-Edge</span>
              </button>
              <button
                onClick={() => setContainerWidth('contained')}
                className={cn(
                  'py-1.5 px-2 rounded-lg text-center font-medium transition-all text-[11px] flex items-center justify-center gap-1.5 cursor-pointer',
                  containerWidth === 'contained'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800/80'
                )}
              >
                <Minimize2 className="w-3 h-3" />
                <span>Contained (7XL)</span>
              </button>
            </div>
          </div>

          {/* Sticky Header Setting */}
          <div className="flex items-center justify-between py-1 px-1 bg-slate-950/50 rounded-lg border border-slate-800/60">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
              <Pin className={cn("w-3 h-3", headerSticky ? "text-indigo-400" : "text-slate-500")} />
              <span>Sticky Header Bar</span>
            </div>
            <button
              type="button"
              onClick={() => setHeaderSticky(!headerSticky)}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors cursor-pointer",
                headerSticky
                  ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              )}
            >
              {headerSticky ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Preferred Default View Mode */}
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              Default View Mode
            </span>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {viewModes.map((v) => {
                const IconComponent = v.icon;
                const isSelected = preferredViewMode === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setPreferredViewMode(v.id)}
                    className={cn(
                      'py-1.5 px-1.5 rounded-lg text-center transition-all text-[10px] flex flex-col items-center justify-center gap-1 cursor-pointer truncate',
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80'
                    )}
                    title={`Default view mode: ${v.label}`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span className="truncate">{v.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-2 text-[10px] text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Persisted globally</span>
            </div>
            <span className="font-mono text-[9px] text-slate-500">vfx.layout.v2</span>
          </div>
        </div>
      )}
    </div>
  );
};

