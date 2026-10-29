import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal, Check } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export interface TabItem<T = string> {
  id: T;
  label: string;
  icon?: React.ReactNode | React.ElementType;
  badge?: string | number;
  badgeColor?: string;
  count?: number;
  disabled?: boolean;
  hidden?: boolean;
  tooltip?: string;
}

export interface ScrollableTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  variant?: 'pills' | 'underline' | 'buttons' | 'subtle' | 'segments';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showDropdown?: boolean;
  rightSlot?: React.ReactNode;
  className?: string;
  tabClassName?: string | ((tab: TabItem<T>, isActive: boolean) => string);
  containerClassName?: string;
  id?: string;
  ariaLabel?: string;
}

export function ScrollableTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pills',
  size = 'sm',
  showDropdown = true,
  rightSlot,
  className,
  tabClassName,
  containerClassName,
  id,
  ariaLabel = 'Navigation tabs',
}: ScrollableTabsProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const visibleTabs = tabs.filter((tab) => !tab.hidden);

  // Check scroll bounds
  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflowing = scrollWidth > clientWidth + 2;
    setIsOverflowing(overflowing);
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  // Set up listeners for resize and scroll bounds
  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;

    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);
    window.addEventListener('resize', checkScroll);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, visibleTabs.length]);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      const timer = setTimeout(checkScroll, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, checkScroll]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Step scroll
  const scrollStep = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.5, 180);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Mouse wheel horizontal translation
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  // Helper to render icon
  const renderIcon = (icon: React.ReactNode | React.ElementType | undefined) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as React.ElementType;
    return <IconComp className={cn('shrink-0', size === 'xs' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5')} />;
  };

  // Style variations
  const getTabStyles = (tab: TabItem<T>, isActive: boolean) => {
    if (typeof tabClassName === 'function') {
      return tabClassName(tab, isActive);
    }
    if (tabClassName) {
      return tabClassName;
    }

    const sizeClasses = {
      xs: 'px-2.5 py-1 text-[11px] gap-1.5',
      sm: 'px-3.5 py-1.5 text-xs gap-2',
      md: 'px-4 py-2 text-xs gap-2',
      lg: 'px-5 py-2.5 text-sm gap-2.5',
    }[size];

    switch (variant) {
      case 'underline':
        return cn(
          'flex items-center font-medium border-b-2 transition-all shrink-0 whitespace-nowrap',
          sizeClasses,
          isActive
            ? 'border-indigo-500 text-indigo-300 font-semibold'
            : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
        );

      case 'buttons':
        return cn(
          'flex items-center font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap border',
          sizeClasses,
          isActive
            ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
            : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/50'
        );

      case 'segments':
        return cn(
          'flex items-center font-medium rounded-lg transition-all shrink-0 whitespace-nowrap',
          sizeClasses,
          isActive
            ? 'bg-slate-800 text-white shadow'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
        );

      case 'subtle':
        return cn(
          'flex items-center font-medium rounded-lg transition-all shrink-0 whitespace-nowrap',
          sizeClasses,
          isActive
            ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
        );

      case 'pills':
      default:
        return cn(
          'flex items-center font-semibold rounded-xl transition-all shrink-0 whitespace-nowrap font-mono tracking-tight',
          sizeClasses,
          isActive
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        );
    }
  };

  return (
    <div
      id={id}
      className={cn('relative flex items-center select-none', className)}
      role="navigation"
      aria-label={ariaLabel}
    >
      {/* Scroll Left Button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollStep('left')}
          className="mr-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md z-10 shrink-0"
          title="Scroll tabs left"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Main Tab Strip Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        onWheel={handleWheel}
        className={cn(
          'flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar flex-1 min-w-0 scroll-smooth touch-pan-x',
          variant === 'underline' && 'border-b border-slate-800',
          variant === 'segments' && 'p-1 bg-slate-900 border border-slate-800 rounded-xl',
          containerClassName
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              type="button"
              disabled={tab.disabled}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                getTabStyles(tab, isActive),
                tab.disabled && 'opacity-40 cursor-not-allowed'
              )}
              title={tab.tooltip || tab.label}
              aria-selected={isActive}
              role="tab"
            >
              {renderIcon(tab.icon)}
              <span>{tab.label}</span>

              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px] font-mono leading-none',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-700/50'
                  )}
                >
                  {tab.count}
                </span>
              )}

              {tab.badge && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-md text-[10px] font-mono leading-none font-bold',
                    tab.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20')
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollStep('right')}
          className="ml-1 p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md z-10 shrink-0"
          title="Scroll tabs right"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Overflow Dropdown Quick Jump */}
      {showDropdown && isOverflowing && (
        <div ref={dropdownRef} className="relative ml-1 shrink-0 z-20">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              'p-1.5 rounded-lg border transition-all shadow-sm',
              isDropdownOpen
                ? 'bg-indigo-600 text-white border-indigo-500'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
            )}
            title="All tabs list"
            aria-label="Open all tabs list"
            aria-expanded={isDropdownOpen}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 max-h-72 overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 p-1.5 shadow-2xl z-50 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-800/80 mb-1">
                Jump to tab ({visibleTabs.length})
              </div>
              <div className="space-y-0.5">
                {visibleTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      disabled={tab.disabled}
                      onClick={() => {
                        onTabChange(tab.id);
                        setIsDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-all',
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        tab.disabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        {renderIcon(tab.icon)}
                        <span className="truncate">{tab.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {tab.count !== undefined && tab.count > 0 && (
                          <span className={cn('text-[10px] px-1.5 py-0.2 rounded-full', isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400')}>
                            {tab.count}
                          </span>
                        )}
                        {isActive && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional Right Action Slot */}
      {rightSlot && <div className="ml-2 shrink-0">{rightSlot}</div>}
    </div>
  );
}
