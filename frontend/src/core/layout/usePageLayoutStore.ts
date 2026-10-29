import { create } from 'zustand';

export type LayoutDensity = 'compact' | 'comfortable' | 'spacious';
export type ContainerWidth = 'full' | 'contained';
export type PreferredViewMode = 'table' | 'grid' | 'board' | 'timeline' | 'calendar' | 'hierarchy' | 'gallery';

export interface PageLayoutConfig {
  density: LayoutDensity;
  containerWidth: ContainerWidth;
  headerSticky: boolean;
  preferredViewMode?: PreferredViewMode;
}

export const DEFAULT_PAGE_LAYOUT: PageLayoutConfig = {
  density: 'comfortable',
  containerWidth: 'full',
  headerSticky: true,
  preferredViewMode: 'table',
};

const STORAGE_KEY = 'studio_page_layout_default';

function loadPersistedLayout(): PageLayoutConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        density: parsed.density || 'comfortable',
        containerWidth: parsed.containerWidth || 'full',
        headerSticky: parsed.headerSticky ?? true,
        preferredViewMode: parsed.preferredViewMode || 'table',
      };
    }
  } catch (e) {
    console.warn('Failed to load persisted layout config:', e);
  }
  return DEFAULT_PAGE_LAYOUT;
}

function persistLayout(config: PageLayoutConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to persist layout config:', e);
  }
}

/**
 * Standard CSS layout classes matching the Organization page spacing and margins.
 */
export const PAGE_LAYOUT_CLASSES = {
  // Edge-to-edge full container
  container: 'flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 animate-in fade-in duration-200',
  
  // Organization-standard header
  header: 'bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0',
  headerInner: 'flex flex-col md:flex-row md:items-center justify-between gap-4',
  
  // Organization-standard tab navigation strip
  tabsNav: 'flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-800/60 pt-2.5 pb-1 font-mono text-xs',
  
  // Organization-standard main scrollable body
  bodyComfortable: 'flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar',
  bodyCompact: 'flex-1 min-h-0 p-3 sm:p-4 space-y-4 flex flex-col overflow-y-auto custom-scrollbar',
  bodySpacious: 'flex-1 min-h-0 p-6 sm:p-8 space-y-8 flex flex-col overflow-y-auto custom-scrollbar',
  
  // Contained body wrapper (when containerWidth is 'contained')
  containedWrapper: 'max-w-7xl w-full mx-auto',

  // Table row cell density classes
  tableCellCompact: 'px-2.5 py-1.5 text-[11px]',
  tableCellComfortable: 'px-3 py-2.5 text-xs',
  tableCellSpacious: 'px-4 py-3.5 text-sm',

  // Table header cell density classes
  tableHeaderCompact: 'px-2.5 py-2 text-[11px]',
  tableHeaderComfortable: 'px-3 py-3 text-xs',
  tableHeaderSpacious: 'px-4 py-4 text-sm',
} as const;

interface PageLayoutStoreState extends PageLayoutConfig {
  setDensity: (density: LayoutDensity) => void;
  setContainerWidth: (containerWidth: ContainerWidth) => void;
  setHeaderSticky: (headerSticky: boolean) => void;
  setPreferredViewMode: (viewMode: PreferredViewMode) => void;
  resetLayout: () => void;
  getBodySpacingClass: () => string;
  getTableRowDensityClass: () => string;
  getTableHeaderDensityClass: () => string;
}

export const usePageLayoutStore = create<PageLayoutStoreState>((set, get) => ({
  ...loadPersistedLayout(),

  setDensity: (density) => {
    const updated = { ...get(), density };
    persistLayout(updated);
    set({ density });
  },

  setContainerWidth: (containerWidth) => {
    const updated = { ...get(), containerWidth };
    persistLayout(updated);
    set({ containerWidth });
  },

  setHeaderSticky: (headerSticky) => {
    const updated = { ...get(), headerSticky };
    persistLayout(updated);
    set({ headerSticky });
  },

  setPreferredViewMode: (preferredViewMode) => {
    const updated = { ...get(), preferredViewMode };
    persistLayout(updated);
    set({ preferredViewMode });
  },

  resetLayout: () => {
    persistLayout(DEFAULT_PAGE_LAYOUT);
    set(DEFAULT_PAGE_LAYOUT);
  },

  getBodySpacingClass: () => {
    const { density, containerWidth } = get();
    let bodyClass: string = PAGE_LAYOUT_CLASSES.bodyComfortable;
    if (density === 'compact') bodyClass = PAGE_LAYOUT_CLASSES.bodyCompact;
    if (density === 'spacious') bodyClass = PAGE_LAYOUT_CLASSES.bodySpacious;

    if (containerWidth === 'contained') {
      return `${bodyClass} ${PAGE_LAYOUT_CLASSES.containedWrapper}`;
    }
    return bodyClass;
  },

  getTableRowDensityClass: () => {
    const { density } = get();
    if (density === 'compact') return PAGE_LAYOUT_CLASSES.tableCellCompact;
    if (density === 'spacious') return PAGE_LAYOUT_CLASSES.tableCellSpacious;
    return PAGE_LAYOUT_CLASSES.tableCellComfortable;
  },

  getTableHeaderDensityClass: () => {
    const { density } = get();
    if (density === 'compact') return PAGE_LAYOUT_CLASSES.tableHeaderCompact;
    if (density === 'spacious') return PAGE_LAYOUT_CLASSES.tableHeaderSpacious;
    return PAGE_LAYOUT_CLASSES.tableHeaderComfortable;
  },
}));
