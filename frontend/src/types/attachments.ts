import { BaseEntity } from './common';

export type AttachmentCategory =
  | 'VFX Breakdown'
  | 'Camera & Lens Report'
  | 'Legal & Clearance'
  | 'Call Sheet'
  | 'Color Pipeline Spec'
  | 'Script Notes'
  | 'CAD / Specification'
  | 'Reference Photography'
  | 'Reference Documentation'
  | 'Texture / Shader Parameter'
  | 'Production Brief'
  | 'Concept & LookDev'
  | 'On-Set HDR Survey'
  | 'Call Sheet & Schedule'
  | 'Quality Control Log'
  | 'Contract & Rights'
  | 'General Attachment'
  | string;

export type SecurityClassification =
  | 'Confidential (Tier 4)'
  | 'Internal Studio Only'
  | 'Vendor Shareable'
  | 'Internal Production'
  | 'Confidential Tier 1'
  | 'Public Reference'
  | string;

export interface AttachmentItem extends BaseEntity {
  id: string;
  code: string;
  file_name: string;
  project_id: string;
  project_code: string;
  entity_type?: 'project' | 'asset' | 'shot' | 'task' | 'version' | 'review' | 'delivery' | string;
  entity_id?: string;
  entity_code?: string;
  category: AttachmentCategory;
  file_type: string; // 'PDF Document', 'OpenEXR Calibration Grid', 'JSON Data', 'STEP CAD', 'Excel Sheet', 'OpenColorIO Config'
  file_size_kb: number;
  security_classification: SecurityClassification;
  version: string;
  download_url: string;
  preview_url?: string;
  raw_content?: string; // For inspectable JSON/YAML/text specs
  uploaded_by: string;
  uploaded_by_avatar?: string;
  uploaded_at: string;
  description: string;
  mime_type?: string;
  tags?: string[];
}
