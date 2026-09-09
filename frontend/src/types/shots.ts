import { BaseEntity, ProductionStatus } from '@/types/common';

export interface ShotPipelineStatus {
  layout: ProductionStatus;
  animation: ProductionStatus;
  fx: ProductionStatus;
  lighting: ProductionStatus;
  comp: ProductionStatus;
}

export interface Shot extends BaseEntity {
  project_id: string;
  project_code: string;
  sequence_code: string;
  code: string;
  name: string;
  description: string;
  status: ProductionStatus;
  frame_in: number;
  frame_out: number;
  frame_count: number;
  handle_frames: number;
  thumbnail_url: string;
  video_url?: string;
  current_version: string;
  assigned_artist_id?: string;
  assigned_artist_name?: string;
  supervisor_approved: boolean;
  client_approved: boolean;
  pipeline: ShotPipelineStatus;
}
