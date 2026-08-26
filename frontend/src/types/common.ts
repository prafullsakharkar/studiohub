export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export type ProductionStatus =
  | 'Not Started'
  | 'Turnover'
  | 'Bidding'
  | 'In Progress'
  | 'Pending Review'
  | 'Approved'
  | 'Retake'
  | 'Final Color'
  | 'Completed'
  | 'On Hold'
  | 'Archived'
  | 'Omitted'
  | 'in_progress'
  | 'ready_for_review'
  | 'changes_requested'
  | 'final_approved'
  | 'on_hold'
  | string;

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical' | string;

export type Department =
  | 'Concept Art'
  | 'Modeling'
  | '3D Modeling & Assets'
  | 'Texturing & LookDev'
  | 'Rigging'
  | 'Character & Creature Rigging'
  | 'Animation'
  | 'Character & Creature Animation'
  | 'FX & Simulation'
  | 'FX / Simulation'
  | 'Lighting'
  | 'Lighting & LookDev'
  | 'Compositing'
  | 'Compositing (Nuke)'
  | 'Editorial'
  | 'Pipeline TD'
  | 'Pipeline & Core Infrastructure'
  | string;
