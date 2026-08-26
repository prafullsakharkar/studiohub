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

export const mockAssets: Asset[] = [
  {
    id: 'ast-001',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Cyber Spinner Interceptor Mark IV',
    code: 'AST_VEH_SPINNER_04',
    category: 'Vehicle',
    description: 'High-density hero police spinner vehicle with articulated thruster nozzles, deployable weapons, full interior cockpit, and ACEScg calibrated MaterialX lookdev shaders.',
    status: 'Approved',
    version: 'v009',
    thumbnail_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
    turntable_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    file_format: 'OpenUSD (.usda / .usdc)',
    poly_count: 3840000,
    lod_levels: 4,
    software: 'Maya',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    children_count: 3,
    tags: ['Hero Vehicle', 'Hard-Surface', 'Interior Cockpit', 'OpenUSD', 'LookDev Approved'],
    usd_prim_path: '/World/Vehicles/Spinner_04',
    usd_stage_url: '@studio/shows/NK99/assets/vehicles/spinner_04/spinner_04.usd@',
    material_count: 18,
    texture_resolution: '8K UDIM (42 tiles)',
    bounding_box: '5.4m x 2.2m x 1.8m',
    review_status: 'Approved',
    task_status: 'Approved',
    is_archived: false,
    created_at: '2025-11-10T10:00:00Z',
    updated_at: '2026-08-20T14:30:00Z',
    versions: [
      {
        version: 'v009',
        published_at: '2026-08-20T14:30:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'Maya 2025 / Solaris',
        file_format: 'OpenUSD Binary (.usdc)',
        file_size_mb: 480,
        poly_count: 3840000,
        lod_levels: 4,
        usd_layer_path: '@studio/shows/NK99/assets/vehicles/spinner_04/v009/spinner_04_v009.usd@',
        is_hero: true,
        comment: 'Final hero sign-off with calibrated MaterialX clearcoat paint and emissive HUD shaders.',
        pyblish_status: 'Passed',
      },
      {
        version: 'v008',
        published_at: '2026-08-14T11:00:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'Maya 2025',
        file_format: 'OpenUSD Binary (.usdc)',
        file_size_mb: 465,
        poly_count: 3840000,
        lod_levels: 4,
        usd_layer_path: '@studio/shows/NK99/assets/vehicles/spinner_04/v008/spinner_04_v008.usd@',
        is_hero: false,
        comment: 'Added LOD3 low-res proxies for background crowd traffic sequences.',
        pyblish_status: 'Passed',
      },
      {
        version: 'v005',
        published_at: '2026-07-28T09:15:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'Maya 2025',
        file_format: 'OpenUSD ASCII (.usda)',
        file_size_mb: 390,
        poly_count: 3200000,
        lod_levels: 3,
        usd_layer_path: '@studio/shows/NK99/assets/vehicles/spinner_04/v005/spinner_04_v005.usd@',
        is_hero: false,
        comment: 'Interior cockpit instrumentation layout and flight stick rigging points.',
        pyblish_status: 'Passed',
      },
    ],
    hierarchy: [
      {
        id: 'ast-001-c1',
        name: 'Spinner Chassis & Hull Armor',
        code: 'AST_VEH_SPINNER_HULL',
        category: 'Vehicle',
        poly_count: 1800000,
        status: 'Approved',
        children: [
          {
            id: 'ast-001-c1a',
            name: 'Gullwing Canopy Doors',
            code: 'AST_VEH_SPINNER_DOORS',
            category: 'Prop',
            poly_count: 320000,
            status: 'Approved',
          },
          {
            id: 'ast-001-c1b',
            name: 'Hydraulic Landing Skids',
            code: 'AST_VEH_SPINNER_SKIDS',
            category: 'Prop',
            poly_count: 240000,
            status: 'Approved',
          },
        ],
      },
      {
        id: 'ast-001-c2',
        name: 'VTOL Jet Thrusters & Vector Nozzles',
        code: 'AST_VEH_SPINNER_THRUSTERS',
        category: 'Vehicle',
        poly_count: 940000,
        status: 'Approved',
      },
      {
        id: 'ast-001-c3',
        name: 'Interior Cockpit & Holographic HUD',
        code: 'AST_VEH_SPINNER_COCKPIT',
        category: 'Prop',
        poly_count: 1100000,
        status: 'Approved',
      },
    ],
  },
  {
    id: 'ast-002',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Mecha Enforcer Combat Android',
    code: 'AST_CHR_MECHA_09',
    category: 'Character',
    description: 'Humanoid tactical police combat android with layered hydraulic armor, emissive power conduits, and facial emotion plates.',
    status: 'In Progress',
    version: 'v006',
    thumbnail_url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=800&auto=format&fit=crop&q=80',
    turntable_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    file_format: 'OpenUSD (.usda / .usdc)',
    poly_count: 5200000,
    lod_levels: 5,
    software: 'ZBrush',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    tags: ['Hero Character', 'Cyborg', 'ZBrush High-Poly', 'Rigging In-Progress'],
    usd_prim_path: '/World/Characters/Mecha_09',
    usd_stage_url: '@studio/shows/NK99/assets/characters/mecha_09/mecha_09.usd@',
    material_count: 24,
    texture_resolution: '8K UDIM (64 tiles)',
    bounding_box: '1.95m x 0.8m x 0.45m',
    review_status: 'Pending Review',
    task_status: 'In Progress',
    is_archived: false,
    created_at: '2025-12-05T11:00:00Z',
    updated_at: '2026-08-21T09:15:00Z',
    versions: [
      {
        version: 'v006',
        published_at: '2026-08-21T09:15:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'ZBrush 2024 / Maya',
        file_format: 'OpenUSD Binary (.usdc)',
        file_size_mb: 620,
        poly_count: 5200000,
        lod_levels: 5,
        usd_layer_path: '@studio/shows/NK99/assets/characters/mecha_09/v006/mecha_09_v006.usd@',
        is_hero: true,
        comment: 'Refined SubD topology for knee piston bends and neck collar rotation.',
        pyblish_status: 'Passed',
      },
      {
        version: 'v004',
        published_at: '2026-08-08T15:20:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'ZBrush 2024',
        file_format: 'OpenUSD Binary (.usdc)',
        file_size_mb: 580,
        poly_count: 4800000,
        lod_levels: 4,
        usd_layer_path: '@studio/shows/NK99/assets/characters/mecha_09/v004/mecha_09_v004.usd@',
        is_hero: false,
        comment: 'Hi-poly sculpt displacement maps baked to 32-bit EXR UDIMs.',
        pyblish_status: 'Passed',
      },
    ],
    hierarchy: [
      {
        id: 'ast-002-c1',
        name: 'Titanium Exoskeleton Chassis',
        code: 'AST_CHR_MECHA_CHASSIS',
        category: 'Character',
        poly_count: 2400000,
        status: 'In Progress',
      },
      {
        id: 'ast-002-c2',
        name: 'Cybernetic Hydraulic Limbs',
        code: 'AST_CHR_MECHA_LIMBS',
        category: 'Character',
        poly_count: 1600000,
        status: 'In Progress',
      },
      {
        id: 'ast-002-c3',
        name: 'Sensor Array & Face Visor',
        code: 'AST_CHR_MECHA_HEAD',
        category: 'Prop',
        poly_count: 1200000,
        status: 'Pending Review',
      },
    ],
  },
  {
    id: 'ast-003',
    project_id: 'proj-002',
    project_code: 'AETH2',
    project_name: 'Aetheria: Age of Dragons',
    name: 'Ancient Blood Wyvern Dragon',
    code: 'AST_CRE_WYVERN_01',
    category: 'Character',
    description: 'Massive winged reptilian monster featuring procedural wing membrane tear shaders, multi-layered muscle simulation, and saliva FX rigs.',
    status: 'In Progress',
    version: 'v011',
    thumbnail_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    turntable_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    file_format: 'OpenUSD / Houdini HDA',
    poly_count: 8900000,
    lod_levels: 5,
    software: 'Houdini',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-03',
    team_name: 'Cyber Creature Unit',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    tags: ['Hero Creature', 'Muscle Simulation', 'Groom & Scales', 'USD Skel', 'Houdini HDA'],
    usd_prim_path: '/World/Creatures/Blood_Wyvern',
    usd_stage_url: '@studio/shows/AETH2/assets/creatures/wyvern_01/wyvern_01.usd@',
    material_count: 32,
    texture_resolution: '8K UDIM (96 tiles)',
    bounding_box: '28.0m x 14.5m x 6.8m',
    review_status: 'Pending Review',
    task_status: 'In Progress',
    is_archived: false,
    created_at: '2026-01-18T13:00:00Z',
    updated_at: '2026-08-22T16:40:00Z',
    versions: [
      {
        version: 'v011',
        published_at: '2026-08-22T16:40:00Z',
        published_by: 'Sarah Jenkins',
        published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: 'Houdini 20.5 / ZBrush',
        file_format: 'OpenUSD Binary (.usdc)',
        file_size_mb: 980,
        poly_count: 8900000,
        lod_levels: 5,
        usd_layer_path: '@studio/shows/AETH2/assets/creatures/wyvern_01/v011/wyvern_01_v011.usd@',
        is_hero: true,
        comment: 'Ziva tissue muscle layer cache integrated with OpenUSD skel binding.',
        pyblish_status: 'Passed',
      },
    ],
  },
  {
    id: 'ast-004',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Neo-Kyoto Holographic Neon Billboards Kit',
    code: 'AST_ENV_HOLO_SIGNS',
    category: 'Shader & LookDev',
    description: 'Comprehensive modular kit of 48 dynamic animated holographic billboard shaders with glitch controllers and depth parallax.',
    status: 'Approved',
    version: 'v004',
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
    file_format: 'MaterialX / OpenUSD',
    poly_count: 450000,
    lod_levels: 3,
    software: 'Substance Painter',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-003',
    assigned_artist_name: 'Elena Rostova',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    tags: ['Modular Kit', 'LookDev', 'MaterialX', 'Cyberpunk', 'Environment'],
    usd_prim_path: '/World/Environment/Props/Holo_Signs',
    usd_stage_url: '@studio/shows/NK99/assets/env/holo_signs/holo_signs.usd@',
    material_count: 48,
    texture_resolution: '4K Textures (12 tiles)',
    bounding_box: '12.0m x 8.0m x 2.0m',
    review_status: 'Approved',
    task_status: 'Approved',
    is_archived: false,
    created_at: '2026-02-14T10:00:00Z',
    updated_at: '2026-07-22T11:20:00Z',
  },
  {
    id: 'ast-005',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Tactical Plasma Rifle Mark IX',
    code: 'AST_PRP_PLASMA_RIFLE',
    category: 'Prop',
    description: 'Precision hard-surface hero plasma rifle with active heat dissipation coils, ammo counter LED display, and USD variant switchers for optics.',
    status: 'Approved',
    version: 'v008',
    thumbnail_url: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenUSD (.usdc)',
    poly_count: 620000,
    lod_levels: 3,
    software: 'Blender',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    tags: ['Hero Weapon', 'Hard-Surface', 'Variants', 'USD Shaders'],
    usd_prim_path: '/World/Props/Weapons/Plasma_Rifle',
    usd_stage_url: '@studio/shows/NK99/assets/props/weapons/plasma_rifle.usd@',
    material_count: 8,
    texture_resolution: '4K UDIM (8 tiles)',
    bounding_box: '0.95m x 0.12m x 0.28m',
    review_status: 'Approved',
    task_status: 'Approved',
    is_archived: false,
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-08-10T14:15:00Z',
  },
  {
    id: 'ast-006',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Hyperloop Transit Station Modular Platform',
    code: 'AST_ENV_HYPERLOOP_STN',
    category: 'Environment',
    description: 'Hero elevated sci-fi transit concourse featuring magnetic levitation tracks, overhead glass canopy, turnstiles, and automated ticketing kiosks.',
    status: 'In Progress',
    version: 'v005',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenUSD (.usda / .usdc)',
    poly_count: 14200000,
    lod_levels: 5,
    software: 'Maya',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-003',
    assigned_artist_name: 'Elena Rostova',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    tags: ['Hero Environment', 'Modular Architecture', 'OpenUSD Point Instancer'],
    usd_prim_path: '/World/Environment/Sets/Hyperloop_Station',
    usd_stage_url: '@studio/shows/NK99/assets/env/hyperloop_station/hyperloop_station.usd@',
    material_count: 54,
    texture_resolution: '8K UDIM (120 tiles)',
    bounding_box: '140.0m x 45.0m x 22.0m',
    review_status: 'Needs Attention',
    task_status: 'In Progress',
    is_archived: false,
    created_at: '2026-03-20T10:30:00Z',
    updated_at: '2026-08-19T17:00:00Z',
  },
  {
    id: 'ast-007',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Autonomous Delivery Drone Scout',
    code: 'AST_VEH_DELIVERY_DRONE',
    category: 'Vehicle',
    description: 'Hexacopter autonomous delivery drone with carbon-fiber landing arms, cargo lock bay, and night-vision sensor dome.',
    status: 'Approved',
    version: 'v007',
    thumbnail_url: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenUSD (.usdc)',
    poly_count: 850000,
    lod_levels: 4,
    software: 'Maya',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    approved_by_id: 'usr-001',
    approved_by_name: 'Alex Chen',
    tags: ['Drone', 'Propeller Rig', 'Crowd Traffic Agent', 'USD Asset'],
    usd_prim_path: '/World/Vehicles/Drones/Delivery_Scout',
    usd_stage_url: '@studio/shows/NK99/assets/vehicles/drones/delivery_scout.usd@',
    material_count: 6,
    texture_resolution: '4K UDIM (6 tiles)',
    bounding_box: '1.2m x 1.2m x 0.45m',
    review_status: 'Approved',
    task_status: 'Approved',
    is_archived: false,
    created_at: '2026-04-05T11:00:00Z',
    updated_at: '2026-07-30T16:00:00Z',
  },
  {
    id: 'ast-008',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Volumetric Ion Thruster Flame FX Rig',
    code: 'AST_FX_ION_THRUST',
    category: 'FX Rig',
    description: 'Procedural Houdini pyro FX flame asset packaged as OpenVDB and USD volume primitives for spinner engines.',
    status: 'In Progress',
    version: 'v003',
    thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenVDB / OpenUSD (.usdvol)',
    poly_count: 0,
    lod_levels: 3,
    software: 'Houdini',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-003',
    assigned_artist_name: 'Elena Rostova',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    tags: ['FX Asset', 'Pyro Simulation', 'OpenVDB', 'Solaris Volume'],
    usd_prim_path: '/World/FX/Thruster_Flame',
    usd_stage_url: '@studio/shows/NK99/assets/fx/ion_thrust/ion_thrust.usd@',
    material_count: 2,
    texture_resolution: 'N/A (Volumetric Shader)',
    bounding_box: '0.6m x 0.6m x 3.5m',
    review_status: 'Pending Review',
    task_status: 'In Progress',
    is_archived: false,
    created_at: '2026-05-12T08:00:00Z',
    updated_at: '2026-08-18T13:45:00Z',
  },
  {
    id: 'ast-009',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Cyberpunk Civilian Crowd Agent Rig',
    code: 'AST_CRW_CIVILIAN_01',
    category: 'Crowd Agent',
    description: 'Optimized crowd skeleton agent with 12 modular costume variations and LOD mesh instancing for street population.',
    status: 'Approved',
    version: 'v005',
    thumbnail_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenUSD (.usdc)',
    poly_count: 120000,
    lod_levels: 4,
    software: 'Maya',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    tags: ['Crowd Agent', 'LOD System', 'Modular Costumes', 'OpenUSD Point Instancer'],
    usd_prim_path: '/World/Crowd/Agents/Civilian_01',
    usd_stage_url: '@studio/shows/NK99/assets/crowd/civilian_01/civilian_01.usd@',
    material_count: 12,
    texture_resolution: '2K Textures (12 maps)',
    bounding_box: '1.75m x 0.6m x 0.35m',
    review_status: 'Approved',
    task_status: 'Approved',
    is_archived: false,
    created_at: '2026-04-18T14:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
  {
    id: 'ast-010',
    project_id: 'proj-001',
    project_code: 'NK99',
    project_name: 'Neo Kyoto 2099',
    name: 'Legacy Police Hover Patrol Bike (Decommissioned)',
    code: 'AST_VEH_HOVERBIKE_LEGACY',
    category: 'Vehicle',
    description: 'Archived preliminary concept model of police patrol hoverbike, superseded by Mark IV Spinner.',
    status: 'Archived',
    version: 'v002',
    thumbnail_url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
    file_format: 'FBX / OBJ',
    poly_count: 1200000,
    lod_levels: 2,
    software: 'Blender',
    department_id: 'dept-02',
    department_name: '3D Modeling & Assets',
    team_id: 'team-02',
    team_name: 'Hero Asset Crew',
    assigned_artist_id: 'usr-004',
    assigned_artist_name: 'Sarah Jenkins',
    assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    tags: ['Archived', 'Concept', 'Hoverbike'],
    is_archived: true,
    created_at: '2025-10-01T09:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
  },
];
