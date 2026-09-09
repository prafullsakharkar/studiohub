import { BaseEntity } from './common';

export type PlaylistType =
  | 'Dailies Reel'
  | 'Client Review'
  | 'Sequence Assembly'
  | 'VFX Turnaround'
  | 'Color Grade Sync'
  | 'Dailies'
  | 'Editorial Sync'
  | 'Executive Screening';

export type PlaylistStatus =
  | 'Draft'
  | 'Ready for Review'
  | 'In Session'
  | 'Archived'
  | 'Approved'
  | 'In Progress';

export interface PlaylistEntry {
  id: string;
  item_order: number;
  entity_type: 'Shot' | 'Asset' | 'Version';
  entity_id?: string;
  entity_code: string;
  version_id?: string;
  version_number: string;
  video_url?: string;
  thumbnail_url: string;
  duration_frames: number;
  frame_range?: string;
  fps: number;
  artist_name: string;
  department: string;
  status: string;
  approval_status?: string;
  notes_count: number;
  review_id?: string;
}

export interface PlaylistShareSettings {
  is_public: boolean;
  allow_client_approval: boolean;
  require_passcode: boolean;
  passcode?: string;
  share_token: string;
  client_id?: string;
  expires_at?: string;
  client_visible_only?: boolean;
}

export interface PlaylistActivity {
  id: string;
  type: 'create' | 'add_item' | 'remove_item' | 'reorder' | 'share' | 'start_review' | 'archive' | 'restore';
  actor_name: string;
  actor_avatar?: string;
  description: string;
  timestamp: string;
}

export interface Playlist extends BaseEntity {
  id: string;
  code: string;
  name: string;
  project_id: string;
  project_code: string;
  project_name?: string;
  type: PlaylistType;
  description: string;
  author_name: string;
  author_id: string;
  author_avatar?: string;
  items_count: number;
  total_duration_frames: number;
  total_duration_timecode: string;
  status: PlaylistStatus;
  is_locked: boolean;
  is_archived?: boolean;
  client?: {
    id: string;
    code: string;
    name: string;
    representative_name: string;
  };
  entries: PlaylistEntry[];
  share_settings?: PlaylistShareSettings;
  activity?: PlaylistActivity[];
}
