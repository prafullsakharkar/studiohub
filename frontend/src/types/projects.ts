import { BaseEntity, ProductionStatus } from '@/types/common';

export interface Project extends BaseEntity {
  organization_id?: string;
  name: string;
  code: string;
  type: 'Feature Film' | 'Episodic Series' | 'Commercial' | 'Game Cinematic';
  description: string;
  status: ProductionStatus;
  fps: number;
  resolution: string;
  aspect_ratio: string;
  color_space: string;
  start_date: string;
  delivery_date: string;
  thumbnail_url: string;
  total_shots: number;
  approved_shots: number;
  in_progress_shots: number;
  total_assets: number;
  budget_usd: number;
  supervisor_id: string;
  supervisor_name: string;
  coordinator_id: string;
  coordinator_name: string;
  client_id: string;
  client_name: string;
  client_contact_id?: string;
  client_contact_name?: string;
  vendor_ids?: string[];
  vendor_names?: string[];
  vendor_team_ids?: string[];
}
