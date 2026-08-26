import { BaseEntity, Department } from './common';

export type PublishStatus =
  | 'Draft'
  | 'Queued'
  | 'Validating'
  | 'Publishing'
  | 'Published'
  | 'Failed'
  | 'Republished'
  | 'Unpublished';

export type PublishDestinationType =
  | 'Storage Cluster'
  | 'Client Delivery Ingest'
  | 'Render Farm Cache'
  | 'Cloud S3 Bucket'
  | 'Vendor Ingest'
  | 'Daily Review Repo'
  | 'USD Asset Cache';

export interface PublishDestination {
  id: string;
  name: string;
  type: PublishDestinationType;
  path: string;
  protocol: 'NFS' | 'SMB' | 'S3' | 'Aspera' | 'Local POSIX';
  is_default?: boolean;
  region?: string;
}

export interface PublishValidationRule {
  id: string;
  name: string;
  category: 'Preflight' | 'Color & ACES' | 'USD Schema' | 'Naming' | 'Texture & Dependencies' | 'Frame Range';
  status: 'passed' | 'warning' | 'failed' | 'skipped';
  message: string;
  details?: string;
  auto_fixable?: boolean;
}

export interface PublishActivity {
  id: string;
  publish_id: string;
  type: 'create' | 'validate' | 'publish' | 'republish' | 'unpublish' | 'retry' | 'fail' | 'status_change';
  title: string;
  description: string;
  user_name: string;
  user_avatar?: string;
  user_role?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PublishHistorySnapshot {
  id: string;
  publish_id: string;
  revision_number: number;
  version_number: string;
  status: PublishStatus;
  dcc_software: string;
  output_path: string;
  artist_name: string;
  published_at: string;
  change_reason: string;
  checksum_sha256: string;
}

export interface PublishItem extends BaseEntity {
  publish_code?: string;
  project_id: string;
  project_code: string;
  project_name?: string;
  entity_type: 'Shot' | 'Asset' | 'Sequence';
  entity_id: string;
  entity_code: string;
  entity_name?: string;
  task_id?: string;
  task_name?: string;
  version_id?: string;
  version_number: string;
  artist_id?: string;
  artist_name?: string;
  artist_avatar?: string;
  publisher_id?: string;
  publisher_name?: string;
  publisher_avatar?: string;
  department: Department | string;
  destination?: PublishDestination;
  status?: PublishStatus | string;
  pyblish_status?: string;
  dcc_software: 'Nuke' | 'Maya' | 'Houdini' | 'Blender' | 'Unreal' | 'USD' | 'Custom Pipeline' | string;
  dcc_version?: string;
  dcc_file_path?: string;
  output_path?: string;
  usd_stage_path?: string;
  usd_layer_identifier?: string;
  is_hero_promoted?: boolean;
  frame_range?: string;
  total_frames?: number;
  fps?: number;
  resolution?: string;
  file_count?: number;
  total_size_bytes?: number;
  total_size_formatted?: string;
  file_size_mb?: number;
  checksum_sha256?: string;
  color_space?: string;
  validation_rules?: PublishValidationRule[];
  validation_passed?: boolean;
  validation_errors?: string[];
  republish_count?: number;
  parent_publish_id?: string;
  error_message?: string;
  published_at?: string;
  thumbnail_url?: string;
  comment?: string;
  activity?: PublishActivity[];
  history?: PublishHistorySnapshot[];
}
