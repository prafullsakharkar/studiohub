import { BaseEntity, ProductionStatus } from '@/types/common';

export type AssetCategory = 'Character' | 'Environment' | 'Vehicle' | 'Prop' | 'FX Rig' | 'Shader & LookDev';

export interface Asset extends BaseEntity {
  project_id: string;
  project_code: string;
  name: string;
  code: string;
  category: AssetCategory;
  description: string;
  status: ProductionStatus;
  version: string;
  thumbnail_url: string;
  file_format: string;
  poly_count: number;
  lod_levels: number;
  assigned_artist_id?: string;
  assigned_artist_name?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  software: 'Maya' | 'Houdini' | 'Blender' | 'ZBrush' | 'Substance Painter' | 'Unreal Engine 5';
}

export const mockAssets: Asset[] = [
  {
    id: 'ast-001',
    project_id: 'proj-001',
    project_code: 'NK99',
    name: 'Cyber Spinner Interceptor Mark IV',
    code: 'AST_VEH_SPINNER_04',
    category: 'Vehicle',
    description: 'High-density hero police spinner vehicle with articulated thruster nozzles, deployable weapons, and full interior cockpit.',
    status: 'Approved',
    version: 'v009',
    thumbnail_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
    file_format: 'USD / Alembic (.abc)',
    poly_count: 3840000,
    lod_levels: 4,
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    software: 'Maya',
    created_at: '2025-11-10T10:00:00Z',
    updated_at: '2026-06-20T14:30:00Z',
  },
  {
    id: 'ast-002',
    project_id: 'proj-001',
    project_code: 'NK99',
    name: 'Mecha Enforcer Combat Android',
    code: 'AST_CHR_MECHA_09',
    category: 'Character',
    description: 'Humanoid tactical police combat android with layered hydraulic armor, emissive power conduits, and facial emotion plates.',
    status: 'In Progress',
    version: 'v006',
    thumbnail_url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600&auto=format&fit=crop&q=80',
    file_format: 'USD / FBX',
    poly_count: 5200000,
    lod_levels: 5,
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    software: 'ZBrush',
    created_at: '2025-12-05T11:00:00Z',
    updated_at: '2026-08-10T09:15:00Z',
  },
  {
    id: 'ast-003',
    project_id: 'proj-002',
    project_code: 'AETH2',
    name: 'Ancient Blood Wyvern Dragon',
    code: 'AST_CRE_WYVERN_01',
    category: 'Character',
    description: 'Massive winged reptilian monster featuring procedural wing membrane tear shaders, multi-layered muscle simulation, and saliva FX rigs.',
    status: 'In Progress',
    version: 'v011',
    thumbnail_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
    file_format: 'USD / Houdini HDA',
    poly_count: 8900000,
    lod_levels: 5,
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    software: 'Houdini',
    created_at: '2026-01-18T13:00:00Z',
    updated_at: '2026-08-15T16:40:00Z',
  },
  {
    id: 'ast-004',
    project_id: 'proj-001',
    project_code: 'NK99',
    name: 'Neo-Tokyo Holographic Neon Billboards Kit',
    code: 'AST_ENV_HOLO_SIGNS',
    category: 'Shader & LookDev',
    description: 'Comprehensive modular kit of 48 dynamic animated holographic billboard shaders with glitch controllers and depth parallax.',
    status: 'Approved',
    version: 'v004',
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    file_format: 'MaterialX / USD',
    poly_count: 450000,
    lod_levels: 3,
    assigned_artist_id: 'usr-003',
    assigned_artist_name: 'Elena Rostova',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    software: 'Substance Painter',
    created_at: '2026-02-14T10:00:00Z',
    updated_at: '2026-07-22T11:20:00Z',
  },
];
