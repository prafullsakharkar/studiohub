import React, { useState, useRef, useEffect, useId } from 'react';
import { cn } from '@/shared/utils/cn';

export interface MenuItem {
  id: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  divider?: boolean;
  /** View/action permission required to show this item. Unauthorized items are hidden. */
  permission?: string;
  onClick?: () => void;
}

export interface MenuProps {
  trigger: React.ReactElement;
  items: MenuItem[];
  align?: 'left' | 'right';
  className?: string;
  'aria-label'?: string;
  /**
   * Optional permission checker. When provided, items carrying a `permission`
   * the checker denies are hidden (never rendered). Callers inside the auth
   * tree pass `can` from `useAuth`; without it all items render (legacy).
   */
  canItem?: (permission?: string) => boolean;
}

export const Menu: React.FC<MenuProps> = ({
  trigger,
  items,
  align = 'right',
  className,
  'aria-label': ariaLabel = 'Actions menu',
  canItem,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return;
    setIsOpen(false);
    item.onClick?.();
  };

  // Unauthorized menu items are hidden (never rendered), not merely disabled.
  // Route guards remain the authoritative boundary; this removes discovery.
  const visibleItems = canItem
    ? items.filter((item) => item.divider || canItem(item.permission))
    : items;

  return (
    <div ref={containerRef} className="relative inline-flex">
      {React.cloneElement(trigger as React.ReactElement<any>, {
        onClick: (e: React.MouseEvent) => {
          (trigger as React.ReactElement<any>).props.onClick?.(e);
          setIsOpen((prev) => !prev);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': isOpen,
        'aria-controls': isOpen ? menuId : undefined,
      })}

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          className={cn(
            'absolute top-full mt-1.5 z-50 min-w-[180px] rounded-xl bg-slate-900/95 border border-slate-800 p-1.5 shadow-2xl backdrop-blur-md',
            'animate-in fade-in-0 zoom-in-95 duration-100',
            align === 'right' ? 'right-0' : 'left-0',
            className
          )}
        >
          {visibleItems.map((item, idx) => {
            if (item.divider) {
              return <div key={`divider-${idx}`} className="my-1 border-t border-slate-800/80" />;
            }

            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => handleItemClick(item)}
                className={cn(
                  'flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer select-none text-left',
                  'focus-visible:outline-hidden focus-visible:bg-slate-800',
                  item.danger
                    ? 'text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                  item.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                )}
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
                {item.shortcut && <span className="text-[10px] text-slate-500 font-mono">{item.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Dropdown = Menu;
