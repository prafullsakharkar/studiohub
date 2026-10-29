export type UniversalEntityType =
  | 'project'
  | 'show'
  | 'episode'
  | 'sequence'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'playlist'
  | 'review'
  | 'delivery'
  | 'publish'
  | 'workflow'
  | 'person'
  | 'client'
  | 'vendor'
  | 'department'
  | 'team'
  | 'office'
  | 'media'
  | 'attachment'
  | 'timelog'
  | 'calendar'
  | string;

export type WorkspaceDisplayMode = 'tab' | 'drawer' | 'split' | 'peek' | string;

export type SplitDirection = 'horizontal' | 'vertical';

export interface EntityReference {
  id: string;
  type: UniversalEntityType;
  title?: string;
  code?: string;
  name?: string;
  subtitle?: string;
  status?: string;
  thumbnail_url?: string;
  [key: string]: any;
}

export interface UniversalEntityDetail {
  id: string;
  type: UniversalEntityType;
  code: string;
  title: string;
  subtitle?: string;
  description?: string;
  status?: string;
  thumbnail_url?: string;
  created_at?: string;
  properties?: Record<string, any>;
  tags?: string[];
  relations?: Record<string, any>;
  [key: string]: any;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  primary: EntityReference;
  secondary?: EntityReference;
  isSplit?: boolean;
  splitDirection?: SplitDirection;
  splitRatio?: number;
  activeSectionKey?: string;
  isPinned?: boolean;
  history?: EntityReference[];
  historyIndex?: number;
  updatedAt?: number;
  [key: string]: any;
}

export interface DrawerState {
  isOpen: boolean;
  entity: EntityReference | null;
  activeTab: string;
  width: number;
}

export interface PeekState {
  isOpen: boolean;
  entity: EntityReference | null;
  position?: { x: number; y: number };
}

export interface ContextStackEntry {
  id: string;
  entity: EntityReference;
  timestamp?: number;
  label?: string;
}
