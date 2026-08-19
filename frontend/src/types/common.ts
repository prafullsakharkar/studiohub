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
  | 'In Progress'
  | 'Pending Review'
  | 'Approved'
  | 'Retake'
  | 'Omitted'
  | 'On Hold';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type Department =
  | 'Concept Art'
  | 'Modeling'
  | 'Texturing & LookDev'
  | 'Rigging'
  | 'Animation'
  | 'FX & Simulation'
  | 'Lighting'
  | 'Compositing'
  | 'Editorial'
  | 'Pipeline TD';
