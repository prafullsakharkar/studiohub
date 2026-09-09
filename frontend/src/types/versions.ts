import { BaseEntity, Department, ProductionStatus } from './common';
import { MediaItem, MediaType } from './media';
import { AttachmentItem } from './attachments';

export interface VersionPublishingInfo {
  dcc_software?: string;
  dcc_version?: string;
  usd_stage_path?: string;
  usd_layer_identifier?: string;
  layers?: string[];
  pyblish_status?: 'Passed' | 'Warnings' | 'Failed';
  validation_errors?: string[];
  is_hero_promoted?: boolean;
  published_at?: string;
  publisher_name?: string;
  publisher_id?: string;
  publisher_avatar?: string;
  comment?: string;
}

export interface VersionReviewRef {
  id: string;
  code: string;
  title: string;
  status: ProductionStatus | 'Approved' | 'Retake' | 'Pending Review';
  lead_reviewer_name: string;
  lead_reviewer_avatar?: string;
  created_at: string;
  annotations_count: number;
  verdict?: 'Approved' | 'Retake' | 'Pending Review';
  supervisor_notes?: string;
}

export interface VersionPlaylistRef {
  id: string;
  code: string;
  name: string;
  type: string;
  item_order: number;
  status: string;
  is_locked: boolean;
  created_at: string;
}

export interface VersionNote {
  id: string;
  author_id?: string;
  author_name: string;
  author_avatar?: string;
  author_role: string;
  content: string;
  department?: string;
  timecode?: string;
  frame_number?: number;
  created_at: string;
  is_internal_only?: boolean;
}

export interface VersionActivityItem {
  id: string;
  action: 'CREATED' | 'UPDATED' | 'PUBLISHED' | 'UNPUBLISHED' | 'REVIEW_REQUESTED' | 'APPROVED' | 'RETAKE' | 'ADDED_TO_PLAYLIST' | 'MEDIA_UPLOADED' | 'ARCHIVED';
  user_name: string;
  user_avatar?: string;
  user_role?: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface ProductionVersion extends BaseEntity {
  id: string;
  code: string; // e.g. VER-NK010-0010-COMP-v004
  version_number: string; // e.g. v004, v001, v012
  version_index?: number; // 4, 1, 12

  // Entity Associations
  project_id: string;
  project_code: string;
  project_name: string;

  entity_type?: 'Shot' | 'Asset';
  entity_id?: string;
  entity_code?: string;
  entity_name?: string;

  shot_id?: string;
  shot_code?: string;
  asset_id?: string;
  asset_code?: string;

  task_id?: string;
  task_code?: string;
  task_title?: string;
  task_name?: string;

  department: Department | string;

  // Artist Attribution
  artist_id?: string;
  artist_name?: string;
  artist_avatar?: string;
  artist_email?: string;
  artist?: {
    id: string;
    name: string;
    role?: string;
    avatar?: string;
    email?: string;
  };

  // Status & Flags
  status: ProductionStatus;
  is_published: boolean;
  is_hero?: boolean;
  is_archived?: boolean;

  // Media Data
  media_id?: string;
  media_type?: MediaType | string;
  thumbnail_url: string;
  video_url?: string;
  source_file_url?: string;
  frame_range?: string;
  start_frame?: number;
  end_frame?: number;
  frame_count?: number;
  duration_seconds?: number;
  resolution: string;
  fps: number;
  file_size_mb: number;
  color_space: string;
  file_path?: string;
  dcc_software?: string;

  // Context & Metadata
  notes?: string;
  description?: string;
  changelog?: string;
  tags?: string[];
  reviews_count?: number;
  notes_count?: number;

  // Linked collections
  media_items?: MediaItem[];
  attachments?: AttachmentItem[];
  reviews?: VersionReviewRef[];
  review_sessions?: any[];
  playlists?: VersionPlaylistRef[];
  publishing_info?: VersionPublishingInfo;
  notes_list?: VersionNote[];
  activity?: VersionActivityItem[];

  created_at: string;
  updated_at: string;
}

export type Version = ProductionVersion;
