import { BaseEntity, ProductionStatus } from './common';

export type ReviewStatus =
  | 'Draft'
  | 'Submitted'
  | 'In Review'
  | 'In Progress'
  | 'Changes Requested'
  | 'Approved'
  | 'Rejected'
  | 'Closed';

export type ReviewVerdict = 'Approved' | 'Changes Requested' | 'Rejected' | 'Pending';

export interface ReviewDrawingPoint {
  x: number;
  y: number;
}

export interface ReviewDrawingAnnotation {
  id: string;
  frame_number: number;
  timecode: string;
  author_name: string;
  comment?: string;
  color: string;
  size: number;
  tool: 'pen' | 'rect' | 'arrow' | 'circle';
  points?: ReviewDrawingPoint[];
  rect?: { x: number; y: number; width: number; height: number };
  start?: ReviewDrawingPoint;
  end?: ReviewDrawingPoint;
  created_at: string;
}

export interface ReviewAnnotation {
  id: string;
  frame_number: number;
  timecode: string;
  author_name: string;
  author_avatar?: string;
  comment: string;
  drawing_coordinates?: { x: number; y: number; color: string; size: number }[];
  drawing?: ReviewDrawingAnnotation;
  created_at: string;
}

export interface ReviewCommentReply {
  id: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  text: string;
  created_at: string;
}

export interface ReviewComment {
  id: string;
  review_id: string;
  frame_number: number;
  timecode: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  text: string;
  is_resolved: boolean;
  resolved_by?: {
    id: string;
    name: string;
  };
  resolved_at?: string;
  replies?: ReviewCommentReply[];
  annotations?: ReviewDrawingAnnotation[];
  is_client_visible: boolean;
  tags?: string[];
  created_at: string;
  updated_at?: string;
}

export interface ReviewNote {
  id: string;
  review_id: string;
  category: 'Supervisor' | 'Client Feedback' | 'Vendor Directive' | 'Internal Note' | 'Technical QC';
  author_name: string;
  author_avatar?: string;
  author_role?: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
}

export interface ReviewParticipant {
  id: string;
  user_id: string;
  name: string;
  avatar?: string;
  email?: string;
  role: 'Supervisor' | 'Lead Artist' | 'Artist' | 'Client Representative' | 'Vendor Lead' | 'Production Coordinator' | string;
  verdict: ReviewVerdict;
  verdict_date?: string;
  verdict_notes?: string;
  is_required: boolean;
}

export interface ReviewActivity {
  id: string;
  review_id: string;
  type:
    | 'create'
    | 'submit'
    | 'start_review'
    | 'approve'
    | 'reject'
    | 'request_changes'
    | 'comment'
    | 'resolve_comment'
    | 'reopen_comment'
    | 'close'
    | 'add_version'
    | 'annotation'
    | 'note_added';
  actor: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface ReviewVersionRef {
  id: string;
  version_number: string;
  video_url: string;
  thumbnail_url: string;
  artist_name: string;
  status: string;
  is_hero?: boolean;
  resolution?: string;
  fps?: number;
  total_frames?: number;
  dcc_software?: string;
  changelog?: string;
  created_at: string;
}

export type ReviewVersion = ReviewVersionRef;

export interface ReviewClientInfo {
  id: string;
  code: string;
  name: string;
  representative_name: string;
  contact_email: string;
  access_level: 'View' | 'Approve' | 'Full Review';
  is_client_approved?: boolean;
  client_notes?: string;
  client_approved_at?: string;
}

export interface ReviewVendorInfo {
  id: string;
  code: string;
  name: string;
  vendor_lead_name: string;
  department: string;
}

export interface ReviewSession extends BaseEntity {
  title: string;
  code: string;
  description?: string;
  project_id: string;
  project_code: string;
  project_name?: string;
  entity_type: 'Shot' | 'Asset';
  entity_id: string;
  entity_code: string;
  version_id?: string;
  version_number: string;
  video_url: string;
  thumbnail_url: string;
  status: ReviewStatus | ProductionStatus;
  lead_reviewer_id: string;
  lead_reviewer_name: string;
  lead_reviewer_avatar?: string;
  annotations: ReviewAnnotation[];
  resolution: string;
  fps: number;
  total_frames: number;
  frame_range?: string;
  color_space?: string;
  dcc_software?: string;
  department?: string;
  supervisor_verdict?: 'Approved' | 'Retake' | 'Changes Requested' | 'Pending Review';
  supervisor_notes?: string;
  client?: ReviewClientInfo;
  vendor?: ReviewVendorInfo;
  versions?: ReviewVersionRef[];
  reviewers?: ReviewParticipant[];
  comments?: ReviewComment[];
  notes?: ReviewNote[];
  activity?: ReviewActivity[];
  playlist_id?: string;
  playlist_code?: string;
  playlist_name?: string;
}
