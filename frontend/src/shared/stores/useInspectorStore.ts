import { create } from 'zustand';

export type InspectorEntityType = 'shot' | 'asset' | 'task' | 'review' | null;

export interface InspectorState {
  isOpen: boolean;
  entityType: InspectorEntityType;
  entityData: any;
  activeTab: 'details' | 'history' | 'files' | 'notes';
  openInspector: (type: InspectorEntityType, data: any, defaultTab?: 'details' | 'history' | 'files' | 'notes') => void;
  closeInspector: () => void;
  setActiveTab: (tab: 'details' | 'history' | 'files' | 'notes') => void;
  updateEntityData: (newData: any) => void;
}

export const useInspectorStore = create<InspectorState>((set) => ({
  isOpen: false,
  entityType: null,
  entityData: null,
  activeTab: 'details',
  openInspector: (type, data, defaultTab = 'details') =>
    set({
      isOpen: true,
      entityType: type,
      entityData: data,
      activeTab: defaultTab,
    }),
  closeInspector: () =>
    set({
      isOpen: false,
      entityType: null,
      entityData: null,
    }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  updateEntityData: (newData) =>
    set((state) => ({
      entityData: { ...(state.entityData || {}), ...newData },
    })),
}));
