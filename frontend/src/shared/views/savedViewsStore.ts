import { SavedView, EntityType, DataViewMode, FilterGroup } from '@/types/crud';

const STORAGE_KEY = 'studiohub_saved_views_v1';

export const DEFAULT_PRESET_VIEWS: SavedView[] = [
  // Shot Views
  {
    id: 'view-shot-default-table',
    name: 'All Active Shots',
    entityType: 'shot',
    viewMode: 'table',
    filters: {
      id: 'root-shot-1',
      logicalOperator: 'AND',
      conditions: [{ id: 'c-1', field: 'status', operator: 'notEquals', value: 'Omitted' }],
    },
    sort: [{ field: 'code', direction: 'asc' }],
    visibleColumns: ['code', 'name', 'status', 'project_code', 'frame_count', 'assigned_artist_name', 'current_version'],
    isDefault: true,
    isFavorite: true,
    isShared: true,
    createdBy: 'System Default',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
  },
  {
    id: 'view-shot-board',
    name: 'Status Pipeline Board',
    entityType: 'shot',
    viewMode: 'board',
    groupBy: 'status',
    filters: {
      id: 'root-shot-2',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'code', direction: 'asc' }],
    visibleColumns: ['code', 'name', 'status', 'project_code'],
    isFavorite: true,
    isShared: true,
    createdBy: 'VFX Supervisor',
    createdAt: '2026-02-10T00:00:00Z',
    updatedAt: '2026-08-18T00:00:00Z',
  },
  {
    id: 'view-shot-gallery',
    name: 'Thumbnail Plate Gallery',
    entityType: 'shot',
    viewMode: 'gallery',
    filters: {
      id: 'root-shot-3',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'code', direction: 'asc' }],
    visibleColumns: ['code', 'name', 'status', 'thumbnail_url', 'frame_count'],
    isShared: true,
    createdBy: 'Lead Comp',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
  },
  {
    id: 'view-shot-timeline',
    name: 'Production Delivery Schedule',
    entityType: 'shot',
    viewMode: 'timeline',
    filters: {
      id: 'root-shot-4',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'code', direction: 'asc' }],
    visibleColumns: ['code', 'name', 'status'],
    isShared: true,
    createdBy: 'Producer',
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-08-15T00:00:00Z',
  },

  // Task Views
  {
    id: 'view-task-default-board',
    name: 'Kanban Workflow Board',
    entityType: 'task',
    viewMode: 'board',
    groupBy: 'status',
    filters: {
      id: 'root-task-1',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'priority', direction: 'desc' }],
    visibleColumns: ['title', 'code', 'status', 'priority', 'assignee_name', 'department', 'due_date'],
    isDefault: true,
    isFavorite: true,
    isShared: true,
    createdBy: 'Production Manager',
    createdAt: '2026-01-05T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
  },
  {
    id: 'view-task-calendar',
    name: 'Due Date Calendar',
    entityType: 'task',
    viewMode: 'calendar',
    filters: {
      id: 'root-task-2',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'due_date', direction: 'asc' }],
    visibleColumns: ['title', 'code', 'status', 'due_date'],
    isFavorite: true,
    isShared: true,
    createdBy: 'Lead Coordinator',
    createdAt: '2026-02-12T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
  },
  {
    id: 'view-task-hierarchy',
    name: 'Hierarchy by Project & Department',
    entityType: 'task',
    viewMode: 'hierarchy',
    groupBy: 'project_code',
    filters: {
      id: 'root-task-3',
      logicalOperator: 'AND',
      conditions: [],
    },
    sort: [{ field: 'code', direction: 'asc' }],
    visibleColumns: ['title', 'code', 'status', 'department'],
    isShared: true,
    createdBy: 'Pipeline TD',
    createdAt: '2026-02-20T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
  },

  // Project Views
  {
    id: 'view-project-default-grid',
    name: 'Active Shows Grid',
    entityType: 'project',
    viewMode: 'grid',
    filters: {
      id: 'root-proj-1',
      logicalOperator: 'AND',
      conditions: [{ id: 'c-p1', field: 'status', operator: 'notEquals', value: 'Archived' }],
    },
    sort: [{ field: 'delivery_date', direction: 'asc' }],
    visibleColumns: ['code', 'name', 'status', 'client_name', 'progress', 'delivery_date'],
    isDefault: true,
    isFavorite: true,
    isShared: true,
    createdBy: 'Head of Production',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-08-10T00:00:00Z',
  },
];

class SavedViewsStore {
  private views: SavedView[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.views = JSON.parse(stored);
      } else {
        this.views = [...DEFAULT_PRESET_VIEWS];
        this.save();
      }
    } catch {
      this.views = [...DEFAULT_PRESET_VIEWS];
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.views));
    } catch {
      // Ignore storage errors
    }
  }

  getViewsForEntity(entityType: EntityType): SavedView[] {
    const list = this.views.filter((v) => v.entityType === entityType);
    if (list.length === 0) {
      // Generate default view
      const def: SavedView = {
        id: `view-${entityType}-default`,
        name: `All ${entityType}s`,
        entityType,
        viewMode: 'table',
        filters: { id: `root-${entityType}`, logicalOperator: 'AND', conditions: [] },
        sort: [],
        visibleColumns: [],
        isDefault: true,
        isFavorite: true,
        isShared: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.views.push(def);
      this.save();
      return [def];
    }
    return list;
  }

  getView(id: string): SavedView | undefined {
    return this.views.find((v) => v.id === id);
  }

  createView(viewData: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>): SavedView {
    const newView: SavedView = {
      ...viewData,
      id: `view-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (newView.isDefault) {
      this.views.forEach((v) => {
        if (v.entityType === newView.entityType) v.isDefault = false;
      });
    }

    this.views.push(newView);
    this.save();
    return newView;
  }

  updateView(id: string, updates: Partial<SavedView>): SavedView | null {
    const idx = this.views.findIndex((v) => v.id === id);
    if (idx === -1) return null;

    if (updates.isDefault) {
      const entityType = this.views[idx].entityType;
      this.views.forEach((v) => {
        if (v.entityType === entityType) v.isDefault = false;
      });
    }

    this.views[idx] = {
      ...this.views[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.views[idx];
  }

  duplicateView(id: string): SavedView | null {
    const source = this.getView(id);
    if (!source) return null;

    return this.createView({
      ...source,
      name: `${source.name} (Copy)`,
      isDefault: false,
    });
  }

  renameView(id: string, newName: string): boolean {
    const updated = this.updateView(id, { name: newName });
    return !!updated;
  }

  toggleFavorite(id: string): boolean {
    const view = this.getView(id);
    if (!view) return false;
    this.updateView(id, { isFavorite: !view.isFavorite });
    return true;
  }

  toggleShared(id: string): boolean {
    const view = this.getView(id);
    if (!view) return false;
    this.updateView(id, { isShared: !view.isShared });
    return true;
  }

  setDefault(id: string): boolean {
    const view = this.getView(id);
    if (!view) return false;
    this.updateView(id, { isDefault: true });
    return true;
  }

  deleteView(id: string): boolean {
    const initialLen = this.views.length;
    this.views = this.views.filter((v) => v.id !== id);
    if (this.views.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }
}

export const savedViewsStore = new SavedViewsStore();
