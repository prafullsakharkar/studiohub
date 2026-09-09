import { create } from 'zustand';
import {
  WorkspaceTab,
  EntityReference,
  UniversalEntityType,
  WorkspaceDisplayMode,
  SplitDirection,
  DrawerState,
  PeekState,
  ContextStackEntry,
} from '@/types/workspace';
import { workspacePersistence } from './workspacePersistence';

interface WorkspaceStoreState {
  tabs: WorkspaceTab[];
  activeTabId: string;
  drawer: DrawerState;
  peek: PeekState;
  contextStack: ContextStackEntry[];
  
  // Workspace Actions
  openInWorkspace: (
    entity: EntityReference,
    mode?: WorkspaceDisplayMode,
    options?: {
      replace?: boolean;
      splitDirection?: SplitDirection;
      tabId?: string;
      label?: string;
    }
  ) => void;

  openTab: (entity: EntityReference, title?: string) => string;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  duplicateTab: (tabId: string) => void;
  togglePinTab: (tabId: string) => void;
  reorderTabs: (sourceIndex: number, destIndex: number) => void;

  // Split View Actions
  setSplitMode: (tabId: string, isSplit: boolean, secondary?: EntityReference, direction?: SplitDirection) => void;
  setSplitRatio: (tabId: string, ratio: number) => void;
  setSplitDirection: (tabId: string, direction: SplitDirection) => void;
  swapSplitEntities: (tabId: string) => void;
  closeSplit: (tabId: string) => void;

  // Drawer Actions
  openDrawer: (entity: EntityReference, activeTab?: string) => void;
  closeDrawer: () => void;
  setDrawerTab: (tab: string) => void;
  setDrawerWidth: (width: number) => void;

  // Peek Actions
  openPeek: (entity: EntityReference, position?: { x: number; y: number }) => void;
  closePeek: () => void;

  // History & Context Stack Navigation
  navigateTabHistory: (tabId: string, direction: 'back' | 'forward') => void;
  pushToContextStack: (entity: EntityReference, label?: string) => void;
  jumpToContextStackIndex: (index: number) => void;
  clearContextStack: () => void;

  // Tab Section Switcher (e.g. Overview, Shots, Tasks, Versions)
  setTabActiveSection: (tabId: string, sectionKey: string) => void;

  // URL Sync
  syncWithUrlParams: (params: {
    primaryType?: string;
    primaryId?: string;
    secondaryType?: string;
    secondaryId?: string;
    view?: string;
    drawerType?: string;
    drawerId?: string;
    drawerTab?: string;
  }) => void;
}

const defaultPrimary: EntityReference = {
  id: 'proj-001',
  type: 'project',
  title: 'Cyberpunk 2099: Neo-Kyoto',
  code: 'NK99',
  subtitle: 'Feature Film',
  status: 'In Progress',
  thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
};

const initialDefaultTab: WorkspaceTab = {
  id: 'tab-default-01',
  title: 'Project NK99',
  primary: defaultPrimary,
  isSplit: false,
  splitDirection: 'horizontal',
  splitRatio: 0.5,
  activeSectionKey: 'overview',
  isPinned: true,
  history: [defaultPrimary],
  historyIndex: 0,
  updatedAt: Date.now(),
};

const persisted = workspacePersistence.load();

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  tabs: persisted?.tabs && persisted.tabs.length > 0 ? persisted.tabs : [initialDefaultTab],
  activeTabId:
    persisted?.activeTabId && persisted.tabs?.some((t) => t.id === persisted.activeTabId)
      ? persisted.activeTabId
      : (persisted?.tabs?.[0]?.id || initialDefaultTab.id),
  drawer: persisted?.drawer || {
    isOpen: false,
    entity: null,
    activeTab: 'details',
    width: 480,
  },
  peek: {
    isOpen: false,
    entity: null,
  },
  contextStack: [
    {
      id: `stack-${Date.now()}`,
      entity: defaultPrimary,
      timestamp: Date.now(),
      label: 'Initial Entry',
    },
  ],

  openInWorkspace: (entity, mode = 'full', options = {}) => {
    const { tabs, activeTabId, openTab, pushToContextStack } = get();
    pushToContextStack(entity, options.label);

    if (mode === 'drawer') {
      set({
        drawer: {
          isOpen: true,
          entity,
          activeTab: 'details',
          width: 480,
        },
      });
      return;
    }

    if (mode === 'peek') {
      set({
        peek: {
          isOpen: true,
          entity,
        },
      });
      return;
    }

    if (mode === 'split') {
      const currentTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
      if (currentTab) {
        const updatedTabs = tabs.map((tab) => {
          if (tab.id === currentTab.id) {
            return {
              ...tab,
              isSplit: true,
              secondary: entity,
              splitDirection: options.splitDirection || tab.splitDirection || 'horizontal',
              updatedAt: Date.now(),
            };
          }
          return tab;
        });
        set({ tabs: updatedTabs });
        workspacePersistence.save({ tabs: updatedTabs, activeTabId: currentTab.id, drawer: get().drawer });
      }
      return;
    }

    // Default 'full' mode:
    if (options.replace && activeTabId) {
      // Replace current tab primary
      const updatedTabs = tabs.map((tab) => {
        if (tab.id === activeTabId) {
          const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), entity];
          return {
            ...tab,
            title: entity.title || entity.code || `${entity.type.toUpperCase()}`,
            primary: entity,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            updatedAt: Date.now(),
          };
        }
        return tab;
      });
      set({ tabs: updatedTabs });
      workspacePersistence.save({ tabs: updatedTabs, activeTabId, drawer: get().drawer });
    } else {
      // Open in active tab history or open new tab if pinned
      const activeTab = tabs.find((t) => t.id === activeTabId);
      if (activeTab && !activeTab.isPinned) {
        const newHistory = [...activeTab.history.slice(0, activeTab.historyIndex + 1), entity];
        const updatedTabs = tabs.map((tab) => {
          if (tab.id === activeTab.id) {
            return {
              ...tab,
              title: entity.title || entity.code || `${entity.type.toUpperCase()}`,
              primary: entity,
              history: newHistory,
              historyIndex: newHistory.length - 1,
              updatedAt: Date.now(),
            };
          }
          return tab;
        });
        set({ tabs: updatedTabs });
        workspacePersistence.save({ tabs: updatedTabs, activeTabId: activeTab.id, drawer: get().drawer });
      } else {
        openTab(entity);
      }
    }
  },

  openTab: (entity, customTitle) => {
    const { tabs, pushToContextStack } = get();
    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const title = customTitle || entity.title || entity.code || `${entity.type.toUpperCase()}`;

    const newTab: WorkspaceTab = {
      id: newTabId,
      title,
      primary: entity,
      isSplit: false,
      splitDirection: 'horizontal',
      splitRatio: 0.5,
      activeSectionKey: 'overview',
      isPinned: false,
      history: [entity],
      historyIndex: 0,
      updatedAt: Date.now(),
    };

    const updatedTabs = [...tabs, newTab];
    set({
      tabs: updatedTabs,
      activeTabId: newTabId,
    });
    pushToContextStack(entity, 'New Workspace Tab');
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: newTabId, drawer: get().drawer });
    return newTabId;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) {
      // Reset to default tab
      const resetTabs = [initialDefaultTab];
      set({ tabs: resetTabs, activeTabId: initialDefaultTab.id });
      workspacePersistence.save({ tabs: resetTabs, activeTabId: initialDefaultTab.id, drawer: get().drawer });
      return;
    }

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const updatedTabs = tabs.filter((t) => t.id !== tabId);

    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      const nextIndex = Math.min(tabIndex, updatedTabs.length - 1);
      nextActiveId = updatedTabs[nextIndex].id;
    }

    set({
      tabs: updatedTabs,
      activeTabId: nextActiveId,
    });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: nextActiveId, drawer: get().drawer });
  },

  setActiveTabId: (tabId) => {
    set({ activeTabId: tabId });
    workspacePersistence.save({ tabs: get().tabs, activeTabId: tabId, drawer: get().drawer });
  },

  updateTabTitle: (tabId, title) => {
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, title, updatedAt: Date.now() } : tab
    );
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  duplicateTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const sourceTab = tabs.find((t) => t.id === tabId);
    if (!sourceTab) return;

    const newTabId = `tab-${Date.now()}`;
    const duplicatedTab: WorkspaceTab = {
      ...sourceTab,
      id: newTabId,
      title: `${sourceTab.title} (Copy)`,
      isPinned: false,
      updatedAt: Date.now(),
    };

    const sourceIndex = tabs.findIndex((t) => t.id === tabId);
    const updatedTabs = [
      ...tabs.slice(0, sourceIndex + 1),
      duplicatedTab,
      ...tabs.slice(sourceIndex + 1),
    ];

    set({
      tabs: updatedTabs,
      activeTabId: newTabId,
    });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: newTabId, drawer: get().drawer });
  },

  togglePinTab: (tabId) => {
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, isPinned: !tab.isPinned } : tab
    );
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  reorderTabs: (sourceIndex, destIndex) => {
    const { tabs, activeTabId } = get();
    const result = Array.from(tabs);
    const [removed] = result.splice(sourceIndex, 1);
    result.splice(destIndex, 0, removed);

    set({ tabs: result });
    workspacePersistence.save({ tabs: result, activeTabId, drawer: get().drawer });
  },

  setSplitMode: (tabId, isSplit, secondary, direction = 'horizontal') => {
    const updatedTabs = get().tabs.map((tab) => {
      if (tab.id === tabId) {
        return {
          ...tab,
          isSplit,
          secondary: secondary || tab.secondary,
          splitDirection: direction,
          updatedAt: Date.now(),
        };
      }
      return tab;
    });
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  setSplitRatio: (tabId, ratio) => {
    const clamped = Math.max(0.2, Math.min(0.8, ratio));
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, splitRatio: clamped } : tab
    );
    set({ tabs: updatedTabs });
  },

  setSplitDirection: (tabId, direction) => {
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, splitDirection: direction } : tab
    );
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  swapSplitEntities: (tabId) => {
    const updatedTabs = get().tabs.map((tab) => {
      if (tab.id === tabId && tab.secondary) {
        const temp = tab.primary;
        return {
          ...tab,
          primary: tab.secondary,
          secondary: temp,
          title: tab.secondary.title || tab.secondary.code || tab.title,
          updatedAt: Date.now(),
        };
      }
      return tab;
    });
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  closeSplit: (tabId) => {
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, isSplit: false, secondary: undefined } : tab
    );
    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  openDrawer: (entity, activeTab = 'details') => {
    const drawerState = {
      isOpen: true,
      entity,
      activeTab,
      width: get().drawer.width || 480,
    };
    set({ drawer: drawerState });
    get().pushToContextStack(entity, 'Drawer Inspection');
    workspacePersistence.save({ tabs: get().tabs, activeTabId: get().activeTabId, drawer: drawerState });
  },

  closeDrawer: () => {
    const drawerState = {
      ...get().drawer,
      isOpen: false,
      entity: null,
    };
    set({ drawer: drawerState });
    workspacePersistence.save({ tabs: get().tabs, activeTabId: get().activeTabId, drawer: drawerState });
  },

  setDrawerTab: (tab) => {
    set((state) => ({ drawer: { ...state.drawer, activeTab: tab } }));
  },

  setDrawerWidth: (width) => {
    set((state) => ({ drawer: { ...state.drawer, width: Math.max(360, Math.min(800, width)) } }));
  },

  openPeek: (entity, position) => {
    set({
      peek: {
        isOpen: true,
        entity,
        position,
      },
    });
  },

  closePeek: () => {
    set({
      peek: {
        isOpen: false,
        entity: null,
      },
    });
  },

  navigateTabHistory: (tabId, direction) => {
    const { tabs } = get();
    const updatedTabs = tabs.map((tab) => {
      if (tab.id === tabId) {
        const nextIndex =
          direction === 'back'
            ? Math.max(0, tab.historyIndex - 1)
            : Math.min(tab.history.length - 1, tab.historyIndex + 1);

        const targetEntity = tab.history[nextIndex];
        return {
          ...tab,
          primary: targetEntity,
          title: targetEntity.title || targetEntity.code || tab.title,
          historyIndex: nextIndex,
          updatedAt: Date.now(),
        };
      }
      return tab;
    });

    set({ tabs: updatedTabs });
    workspacePersistence.save({ tabs: updatedTabs, activeTabId: get().activeTabId, drawer: get().drawer });
  },

  pushToContextStack: (entity, label) => {
    const entry: ContextStackEntry = {
      id: `stack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      entity,
      timestamp: Date.now(),
      label: label || `${entity.type.toUpperCase()}: ${entity.code || entity.title}`,
    };

    set((state) => {
      // Keep max 20 entries in context stack
      const updated = [entry, ...state.contextStack.filter((s) => s.entity.id !== entity.id || s.entity.type !== entity.type)].slice(0, 20);
      return { contextStack: updated };
    });
  },

  jumpToContextStackIndex: (index) => {
    const { contextStack, openInWorkspace } = get();
    const target = contextStack[index];
    if (target) {
      openInWorkspace(target.entity, 'full');
    }
  },

  clearContextStack: () => {
    set({ contextStack: [] });
  },

  setTabActiveSection: (tabId, sectionKey) => {
    const updatedTabs = get().tabs.map((tab) =>
      tab.id === tabId ? { ...tab, activeSectionKey: sectionKey } : tab
    );
    set({ tabs: updatedTabs });
  },

  syncWithUrlParams: (params) => {
    if (!params.primaryType || !params.primaryId) return;

    const { tabs, activeTabId } = get();
    const primaryRef: EntityReference = {
      id: params.primaryId,
      type: params.primaryType as UniversalEntityType,
    };

    const isSplit = params.view === 'split' && !!params.secondaryType && !!params.secondaryId;
    const secondaryRef: EntityReference | undefined = isSplit
      ? {
          id: params.secondaryId!,
          type: params.secondaryType as UniversalEntityType,
        }
      : undefined;

    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab) {
      const updatedTabs = tabs.map((t) => {
        if (t.id === activeTab.id) {
          return {
            ...t,
            primary: primaryRef,
            secondary: secondaryRef,
            isSplit,
            updatedAt: Date.now(),
          };
        }
        return t;
      });
      set({ tabs: updatedTabs });
    }

    if (params.drawerType && params.drawerId) {
      set({
        drawer: {
          isOpen: true,
          entity: {
            id: params.drawerId,
            type: params.drawerType as UniversalEntityType,
          },
          activeTab: params.drawerTab || 'details',
          width: 480,
        },
      });
    }
  },
}));
