import { BaseEntity, ProductionStatus } from './common';

export type UniversalEntityType =
  | 'organization'
  | 'client'
  | 'vendor'
  | 'person'
  | 'department'
  | 'team'
  | 'office'
  | 'project'
  | 'sequence'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'review'
  | 'note'
  | 'delivery'
  | 'schedule'
  | 'resource'
  | 'publishing'
  | 'playlist'
  | 'workflow'
  | 'timelog'
  | 'calendar'
  | 'media'
  | 'attachment';

export type WorkspaceDisplayMode = 'full' | 'split' | 'drawer' | 'peek' | 'embedded';
export type SplitDirection = 'horizontal' | 'vertical';

export interface EntityReference {
  id: string;
  type: UniversalEntityType;
  title?: string;
  code?: string;
  subtitle?: string;
  status?: ProductionStatus | string;
  thumbnail_url?: string;
  project_code?: string;
  meta?: Record<string, any>;
}

export interface WorkspaceTab {
  id: string;
  title: string;
  primary: EntityReference;
  secondary?: EntityReference;
  isSplit: boolean;
  splitDirection: SplitDirection;
  splitRatio: number; // 0.2 to 0.8 (default 0.5)
  activeSectionKey: string;
  isPinned: boolean;
  history: EntityReference[];
  historyIndex: number;
  updatedAt: number;
}

export interface ContextStackEntry {
  id: string;
  entity: EntityReference;
  timestamp: number;
  label?: string;
}

export interface PeekState {
  isOpen: boolean;
  entity: EntityReference | null;
  position?: { x: number; y: number };
}

export interface DrawerState {
  isOpen: boolean;
  entity: EntityReference | null;
  activeTab: string;
  width: number;
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
  banner_url?: string;
  created_at?: string;
  updated_at?: string;
  properties: Record<string, any>;
  tags?: string[];
  // Relational connections for non-linear transversal exploration
  relations: {
    parent?: EntityReference;
    client?: EntityReference;
    project?: EntityReference;
    sequence?: EntityReference;
    shot?: EntityReference;
    asset?: EntityReference;
    assignee?: EntityReference;
    reviewer?: EntityReference;
    team?: EntityReference;
    department?: EntityReference;
    vendor?: EntityReference;
    shots?: EntityReference[];
    assets?: EntityReference[];
    tasks?: EntityReference[];
    versions?: EntityReference[];
    reviews?: EntityReference[];
    people?: EntityReference[];
    teams?: EntityReference[];
    deliveries?: EntityReference[];
    notes?: Array<{
      id: string;
      author: string;
      role: string;
      text: string;
      timestamp: string;
      avatar_url?: string;
    }>;
    activity?: Array<{
      id: string;
      action: string;
      user: string;
      timestamp: string;
      target?: string;
    }>;
  };
}
