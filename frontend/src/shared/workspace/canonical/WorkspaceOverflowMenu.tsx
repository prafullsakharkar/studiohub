import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, MoreHorizontal, ChevronDown, Check, Loader2 } from 'lucide-react';
import type { WorkspaceAction } from './types';
import { cn } from '@/shared/utils/cn';

export interface WorkspaceOverflowMenuProps {
  actions: WorkspaceAction[];
  triggerVariant?: 'icon' | 'button' | 'ghost';
  label?: string;
  align?: 'left' | 'right';
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

export const WorkspaceOverflowMenu: React.FC<WorkspaceOverflowMenuProps> = ({
  actions,
  triggerVariant = 'icon',
  label = 'More Actions',
  align = 'right',
  className = '',
  size = 'sm',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const visibleActions = actions.filter((action) => action.visible !== false);
  if (visibleActions.length === 0) return null;

  const handleActionClick = (action: WorkspaceAction, e: React.MouseEvent) => {
    if (action.disabled || action.loading) return;
    setIsOpen(false);
    action.onClick(e);
  };

  return (
    <div className={cn('relative inline-block text-left', className)} ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={label}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 select-none cursor-pointer border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-slate-100',
          size === 'xs' ? 'p-1 text-xs gap-1' : size === 'sm' ? 'p-1.5 text-xs gap-1.5' : 'p-2 text-sm gap-2',
          triggerVariant === 'ghost' && 'bg-transparent border-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
        )}
      >
        {triggerVariant === 'button' ? (
          <>
            <span>{label}</span>
            <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-70" />
          </>
        ) : (
          <MoreVertical className={cn(size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'absolute mt-1.5 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl py-1.5 z-50 focus:outline-none backdrop-blur-md',
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          )}
        >
          {visibleActions.map((action, index) => {
            const isDanger = action.danger || action.variant === 'danger';
            return (
              <React.Fragment key={action.id || index}>
                {action.dividerBefore && <div className="my-1 border-t border-slate-800" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={action.disabled || action.loading}
                  onClick={(e) => handleActionClick(action, e)}
                  className={cn(
                    'w-full text-left px-3.5 py-2 text-xs flex items-center justify-between gap-2 transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer',
                    isDanger
                      ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-slate-100',
                    action.className
                  )}
                  title={action.tooltip}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {action.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
                    ) : (
                      action.icon && <span className="shrink-0 opacity-80">{action.icon}</span>
                    )}
                    <span className="truncate">{action.label}</span>
                  </div>
                  {action.shortcut && (
                    <kbd className="font-mono text-[10px] text-slate-500 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                      {action.shortcut}
                    </kbd>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
