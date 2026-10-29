import React from 'react';
import { usePageLayoutStore, PAGE_LAYOUT_CLASSES, type LayoutDensity, type ContainerWidth } from '@/core/layout/usePageLayoutStore';
import { cn } from '@/shared/utils/cn';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
}

export interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export interface PageTitleProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}

export interface PageActionsProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageTabsProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageBodyProps {
  children: React.ReactNode;
  className?: string;
  densityOverride?: LayoutDensity;
  containerWidthOverride?: ContainerWidth;
}

/**
 * Root Page Layout Container
 * Enforces unified spacing, backdrop, and viewport scrolling across all studio pages.
 */
export const PageLayout: React.FC<PageLayoutProps> & {
  Header: React.FC<PageHeaderProps>;
  Title: React.FC<PageTitleProps>;
  Actions: React.FC<PageActionsProps>;
  Tabs: React.FC<PageTabsProps>;
  Body: React.FC<PageBodyProps>;
} = ({ children, className, id = 'page-layout-root' }) => {
  return (
    <div id={id} className={cn(PAGE_LAYOUT_CLASSES.container, className)}>
      {children}
    </div>
  );
};

const PageHeader: React.FC<PageHeaderProps> = ({ children, className, sticky }) => {
  const { headerSticky: storeHeaderSticky } = usePageLayoutStore();
  const isSticky = sticky !== undefined ? sticky : storeHeaderSticky;
  return (
    <header
      className={cn(
        PAGE_LAYOUT_CLASSES.header,
        isSticky && 'sticky top-0 z-20 sticky-page-header',
        className
      )}
    >
      {children}
    </header>
  );
};

const PageTitle: React.FC<PageTitleProps> = ({ icon, title, subtitle, badges, className }) => {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      {icon && (
        <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400 shrink-0">
          {icon}
        </div>
      )}
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-lg font-bold tracking-tight text-white truncate">{title}</h1>
          {badges}
        </div>
        {subtitle && (
          <div className="text-xs text-slate-400 truncate max-w-2xl">{subtitle}</div>
        )}
      </div>
    </div>
  );
};

const PageActions: React.FC<PageActionsProps> = ({ children, className }) => {
  return (
    <div className={cn('flex items-center gap-2.5 shrink-0 flex-wrap', className)}>
      {children}
    </div>
  );
};

const PageTabs: React.FC<PageTabsProps> = ({ children, className }) => {
  const containerRef = React.useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  React.useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    window.addEventListener('resize', checkScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, children]);

  const handleScrollStep = (dir: 'left' | 'right') => {
    const el = containerRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.5, 180);
    el.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    const el = containerRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  return (
    <div className="relative flex items-center border-t border-slate-800/60 pt-2.5 pb-1">
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => handleScrollStep('left')}
          className="mr-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md z-10 shrink-0"
          title="Scroll tabs left"
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}

      <nav
        ref={containerRef}
        onScroll={checkScroll}
        onWheel={handleWheel}
        className={cn(
          'flex items-center gap-1 overflow-x-auto overflow-y-hidden no-scrollbar font-mono text-xs flex-1 min-w-0 scroll-smooth touch-pan-x',
          className
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {children}
      </nav>

      {canScrollRight && (
        <button
          type="button"
          onClick={() => handleScrollStep('right')}
          className="ml-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-all shadow-md z-10 shrink-0"
          title="Scroll tabs right"
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const PageBody: React.FC<PageBodyProps> = ({
  children,
  className,
  densityOverride,
  containerWidthOverride,
}) => {
  const { density: storeDensity, containerWidth: storeWidth } = usePageLayoutStore();
  const density = densityOverride || storeDensity;
  const containerWidth = containerWidthOverride || storeWidth;

  let spacingClass: string = PAGE_LAYOUT_CLASSES.bodyComfortable;
  if (density === 'compact') spacingClass = PAGE_LAYOUT_CLASSES.bodyCompact;
  if (density === 'spacious') spacingClass = PAGE_LAYOUT_CLASSES.bodySpacious;

  return (
    <main
      className={cn(
        spacingClass,
        containerWidth === 'contained' && PAGE_LAYOUT_CLASSES.containedWrapper,
        className
      )}
    >
      {children}
    </main>
  );
};

PageLayout.Header = PageHeader;
PageLayout.Title = PageTitle;
PageLayout.Actions = PageActions;
PageLayout.Tabs = PageTabs;
PageLayout.Body = PageBody;
