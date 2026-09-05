import { BaseEntity, ProductionStatus } from '@/types/common';

export type AssetCategory =
  | 'Character'
  | 'Environment'
  | 'Vehicle'
  | 'Prop'
  | 'FX Rig'
  | 'Shader & LookDev'
  | 'Matte Painting'
  | 'Crowd Agent'
  | 'Costume / Groom';

export type AssetSoftware =
  | 'Maya'
  | 'Houdini'
  | 'Blender'
  | 'ZBrush'
  | 'Substance Painter'
  | 'Unreal Engine 5'
  | 'Solaris'
  | 'Mari';

export interface AssetVersionRecord {
  version: string;
  published_at: string;
  published_by: string;
  published_by_avatar?: string;
  dcc_software: string;
  file_format: string;
  file_size_mb: number;
  poly_count: number;
  lod_levels: number;
  usd_layer_path: string;
  is_hero: boolean;
  comment: string;
  pyblish_status: 'Passed' | 'Warnings' | 'Failed';
}

export interface AssetHierarchyNode {
  id: string;
  name: string;
  code: string;
  category: AssetCategory;
  poly_count: number;
  status: ProductionStatus;
  children?: AssetHierarchyNode[];
}

export interface Asset extends BaseEntity {
  project_id: string;
  project_code: string;
  project_name?: string;
  name: string;
  code: string;
  category: AssetCategory;
  description: string;
  status: ProductionStatus;
  version: string;
  thumbnail_url: string;
  turntable_video_url?: string;
  file_format: string;
  poly_count: number;
  lod_levels: number;
  software: AssetSoftware;
  department_id: string;
  department_name: string;
  team_id: string;
  team_name: string;
  assigned_artist_id?: string;
  assigned_artist_name?: string;
  assigned_artist_avatar?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  parent_asset_id?: string;
  parent_asset_name?: string;
  children_count?: number;
  tags: string[];
  usd_prim_path?: string;
  usd_stage_url?: string;
  material_count?: number;
  texture_resolution?: string;
  bounding_box?: string;
  review_status?: 'Approved' | 'Pending Review' | 'Retake' | 'Needs Attention';
  task_status?: 'Not Started' | 'In Progress' | 'Pending Review' | 'Approved' | 'Retake';
  is_archived?: boolean;
  versions?: AssetVersionRecord[];
  hierarchy?: AssetHierarchyNode[];
}

