import { BaseEntity } from './common';

export type DeliveryStatus =
  | 'Draft'
  | 'Preparing'
  | 'Validating'
  | 'Ready'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Changes Requested'
  | 'Rejected'
  | 'Failed'
  | 'Completed'
  | 'Cancelled';

export type DeliveryDestinationType =
  | 'Aspera Connect'
  | 'Signiant Media Shuttle'
  | 'AWS S3 Bucket'
  | 'Frame.io Enterprise'
  | 'LTO Tape Archive'
  | 'Client SFTP'
  | 'Hard Drive Ingest';

export interface DeliveryDestination {
  id: string;
  name: string;
  type: DeliveryDestinationType;
  endpoint: string;
  credentials_configured: boolean;
  transfer_rate_mbps?: number;
  storage_region?: string;
  port?: number;
  target_directory?: string;
}

export interface DeliveryClientInfo {
  id: string;
  code: string;
  name: string;
  representative_name: string;
  contact_email: string;
  avatar?: string;
  portal_url?: string;
  auto_notify?: boolean;
}

export interface DeliveryVendorInfo {
  id: string;
  code: string;
  name: string;
  vendor_lead_name: string;
  contact_email: string;
  avatar?: string;
}

export interface DeliveryVersionRef {
  id: string;
  entity_type: 'Shot' | 'Asset';
  entity_code: string;
  version_number: string;
  department: string;
  artist_name: string;
  resolution: string;
  fps: number;
  frame_range: string;
  duration_frames: number;
  duration_tc: string;
  file_format:
    | 'EXR 16-bit float'
    | 'ProRes 4444 XQ'
    | 'ProRes 422 HQ'
    | 'DNxHR HQX'
    | 'USD Stage Package'
    | 'H.264 Client Review';
  thumbnail_url: string;
  video_url?: string;
  file_size_formatted: string;
  file_size_bytes: number;
  checksum_sha256: string;
  color_space: string;
  status: 'Ready' | 'Validating' | 'Packaging' | 'Failed';
  is_hero?: boolean;
  notes_count?: number;
}

export interface DeliveryMediaFile {
  id: string;
  filename: string;
  file_type:
    | 'Media Stream'
    | 'Image Sequence'
    | 'Color CDL/LUT'
    | 'Audio Stem'
    | 'Manifest XML/JSON'
    | 'Matte Pass'
    | 'Delivery Slate';
  file_size_bytes: number;
  file_size_formatted: string;
  checksum_sha256: string;
  path: string;
  status: 'Verified' | 'Pending' | 'Corrupt';
}

export interface DeliveryValidationCheck {
  id: string;
  title: string;
  category:
    | 'Resolution & Aspect Ratio'
    | 'Frame Drops & Continuity'
    | 'ACEScg & CDL Compliance'
    | 'Slate & Burn-In Metadata'
    | 'Audio Sync & 5.1/Stereo'
    | 'SHA-256 Checksums'
    | 'Delivery Naming Spec';
  status: 'passed' | 'warning' | 'failed' | 'checking';
  details: string;
  severity: 'blocking' | 'warning' | 'info';
  checked_at?: string;
}

export interface DeliveryActivity {
  id: string;
  delivery_id: string;
  type:
    | 'create'
    | 'prepare'
    | 'validate'
    | 'submit'
    | 'approve'
    | 'reject'
    | 'retry'
    | 'complete'
    | 'cancel'
    | 'status_change'
    | 'media_added'
    | 'transfer_update';
  title: string;
  description: string;
  actor_name: string;
  actor_avatar?: string;
  actor_role?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface DeliveryHistorySnapshot {
  id: string;
  delivery_id: string;
  revision: number;
  status: DeliveryStatus;
  submitted_at?: string;
  client_action_at?: string;
  verdict?: 'Approved' | 'Rejected' | 'Changes Requested';
  notes?: string;
  manifest_checksum: string;
}

export interface DeliveryPackage extends BaseEntity {
  package_code: string;
  title: string;
  description?: string;
  project_id: string;
  project_code: string;
  project_name: string;
  client: DeliveryClientInfo;
  vendor?: DeliveryVendorInfo;
  destination: DeliveryDestination;
  due_date: string;
  milestone_name: string;
  status: DeliveryStatus;
  versions: DeliveryVersionRef[];
  media_files: DeliveryMediaFile[];
  validation_checks: DeliveryValidationCheck[];
  validation_score: number;
  all_validations_passed: boolean;
  total_size_bytes: number;
  total_size_formatted: string;
  total_shots_count: number;
  total_frames_count: number;
  transfer_progress_percent?: number;
  transfer_speed_mbps?: number;
  estimated_completion_time?: string;
  submitted_at?: string;
  submitted_by_name?: string;
  approved_at?: string;
  approved_by_name?: string;
  rejection_reason?: string;
  rejection_notes?: string;
  tracking_url?: string;
  aspera_manifest_id?: string;
  thumbnail_url?: string;
  activity: DeliveryActivity[];
  history: DeliveryHistorySnapshot[];
}
