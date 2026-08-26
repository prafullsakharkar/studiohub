import { BaseEntity } from './common';

export type MediaType = 'image' | 'video' | 'audio' | 'sequence' | 'preview' | string;

export interface MediaItem extends BaseEntity {
  id: string;
  code: string;
  name?: string;
  title?: string;
  file_name?: string;
  project_id: string;
  project_code: string;
  entity_type?: 'Project' | 'Asset' | 'Shot' | 'Task' | 'Version' | 'Review' | 'project' | 'asset' | 'shot' | 'task' | 'version' | 'review' | string;
  entity_id?: string;
  entity_code?: string;
  associated_shot_code?: string;
  associated_asset_code?: string;
  media_type: MediaType;
  category?: string; // 'Hero Render' | 'Camera Plate' | 'HDRI Environment' | 'Concept Art' | 'Audio Stem' | 'Turntable' | 'Matte Pass' | 'Clay Render'
  file_format: string; // 'EXR Sequence', 'ARRIRAW 6.5K', 'ProRes 4444 XQ', 'MP4 H.264', 'Broadcast WAV 5.1', 'PNG 16-bit'
  thumbnail_url: string;
  source_url: string;
  preview_url?: string;
  file_size_mb: number;
  resolution?: string; // '3840x2160', '6560x3100', '16384x8192'
  aspect_ratio?: string; // '16:9', '2.39:1', '1:1'
  fps?: number;
  frame_count?: number;
  start_frame?: number;
  end_frame?: number;
  duration_seconds?: number;
  color_space: string; // 'ACEScg', 'ARRI LogC4', 'Rec.709', 'Display P3'
  audio_channels?: string; // '5.1 Surround', 'Stereo 2.0', 'Mute / None'
  bit_depth?: string; // '32-bit Float', '16-bit Half Float', '24-bit', '10-bit'
  checksum_md5?: string;
  storage_tier?: 'Tier 1 NVMe Hot' | 'Tier 2 Flash Shared' | 'Tier 3 Cloud Archive' | string;
  file_path?: string;
  tags?: string[];
  uploaded_by: string;
  uploaded_by_avatar?: string;
  uploaded_at?: string;
  description?: string;
  is_primary?: boolean;
}
