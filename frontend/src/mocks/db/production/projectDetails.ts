export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  phase: 'Pre-Production' | 'Turnover & Ingest' | 'Layout & Previz' | 'Asset Build' | 'Animation & FX' | 'Lighting & Comp' | 'Final Color Grading' | 'Delivery';
  due_date: string;
  status: 'Completed' | 'In Progress' | 'Upcoming' | 'Delayed';
  progress_pct: number;
  owner_name: string;
  deliverables_count: number;
  notes?: string;
}

export interface ProjectSequenceBreakdown {
  id: string;
  project_id: string;
  sequence_code: string;
  name: string;
  shot_count: number;
  approved_shots: number;
  in_progress_shots: number;
  lead_artist: string;
  complexity: 'High' | 'Medium' | 'Extreme' | 'Standard';
  description: string;
}

export interface ProjectCrewMember {
  id: string;
  project_id: string;
  person_id: string;
  name: string;
  role: string;
  department: string;
  team: string;
  office: string;
  allocation_pct: number;
  avatar_url: string;
  logged_hours: number;
  estimated_hours: number;
  skills: string[];
}

export interface ProjectDeliverableItem {
  id: string;
  project_id: string;
  package_name: string;
  format: string;
  resolution: string;
  audio_config: string;
  color_space: string;
  frame_count: number;
  file_size_gb: number;
  delivery_target: string;
  status: 'Delivered' | 'In QC' | 'Packaging' | 'Draft' | 'Approved';
  checksum_sha256: string;
  delivered_at?: string;
  recipient: string;
}

export interface ProjectActivityItem {
  id: string;
  project_id: string;
  user_name: string;
  user_avatar: string;
  user_role: string;
  action: string;
  target_type: 'Shot' | 'Asset' | 'Task' | 'Review' | 'Milestone' | 'Delivery' | 'Project';
  target_code: string;
  timestamp: string;
  details?: string;
}

export const mockProjectMilestones: ProjectMilestone[] = [
  {
    id: 'pms-001',
    project_id: 'proj-001',
    title: 'Plate Turnover & Camera Tracking Ingest',
    phase: 'Turnover & Ingest',
    due_date: '2026-02-15',
    status: 'Completed',
    progress_pct: 100,
    owner_name: 'Marcus Vance',
    deliverables_count: 240,
    notes: 'All 8K ARRIRAW master plates debayered and ACEScg Linear converted.',
  },
  {
    id: 'pms-002',
    project_id: 'proj-001',
    title: 'Hero Cyber Assets & Digital Doubles Lock',
    phase: 'Asset Build',
    due_date: '2026-04-30',
    status: 'Completed',
    progress_pct: 100,
    owner_name: 'Sarah Jenkins',
    deliverables_count: 85,
    notes: '85 OpenUSD asset payloads approved with MaterialX lookdev shaders.',
  },
  {
    id: 'pms-003',
    project_id: 'proj-001',
    title: 'Sequence 010 Hover Chase Temp Comp Screening',
    phase: 'Animation & FX',
    due_date: '2026-07-15',
    status: 'Completed',
    progress_pct: 100,
    owner_name: 'Alex Chen',
    deliverables_count: 54,
    notes: 'Director approval on volumetric plasma trail dynamics and vehicle crashes.',
  },
  {
    id: 'pms-004',
    project_id: 'proj-001',
    title: 'Sequence 020 Cyber Citadel Final Comp & Dailies',
    phase: 'Lighting & Comp',
    due_date: '2026-09-15',
    status: 'In Progress',
    progress_pct: 78,
    owner_name: 'Elena Rostova',
    deliverables_count: 110,
    notes: 'Deep compositing lighting passes and atmospheric smog haze refinements.',
  },
  {
    id: 'pms-005',
    project_id: 'proj-001',
    title: 'Final ACES DCI 4K Master Screening & Client Delivery',
    phase: 'Delivery',
    due_date: '2026-10-30',
    status: 'Upcoming',
    progress_pct: 25,
    owner_name: 'Alex Chen',
    deliverables_count: 240,
    notes: '16-bit OpenEXR half-float frames + ProRes 4444 XQ master reference clips.',
  },
];

export const mockProjectSequences: ProjectSequenceBreakdown[] = [
  {
    id: 'pseq-001',
    project_id: 'proj-001',
    sequence_code: 'SEQ_010',
    name: 'Neo-Kyoto Skyway Pursuit',
    shot_count: 64,
    approved_shots: 58,
    in_progress_shots: 6,
    lead_artist: 'Alex Chen',
    complexity: 'Extreme',
    description: 'High-altitude vehicle chase across multi-tier holographic megacity skyways with explosive volumetric FX.',
  },
  {
    id: 'pseq-002',
    project_id: 'proj-001',
    sequence_code: 'SEQ_020',
    name: 'Citadel Core Infiltration',
    shot_count: 86,
    approved_shots: 52,
    in_progress_shots: 34,
    lead_artist: 'Elena Rostova',
    complexity: 'High',
    description: 'Intricate digital environment extension, glass shattering simulations, and digital double stealth maneuvers.',
  },
  {
    id: 'pseq-003',
    project_id: 'proj-001',
    sequence_code: 'SEQ_030',
    name: 'Holo-Spire Rooftop Climax',
    shot_count: 90,
    approved_shots: 32,
    in_progress_shots: 38,
    lead_artist: 'Kenji Sato',
    complexity: 'Extreme',
    description: 'Towering storm sequence with lightning ionization, rain shader lookdev, and cinematic destruction.',
  },
];

export const mockProjectCrewMembers: ProjectCrewMember[] = [
  {
    id: 'pcrew-001',
    project_id: 'proj-001',
    person_id: 'usr-001',
    name: 'Alex Chen',
    role: 'VFX Supervisor',
    department: 'FX & Simulation',
    team: 'Alpha FX Squad',
    office: 'Montreal HQ (Main Stage)',
    allocation_pct: 100,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    logged_hours: 320,
    estimated_hours: 450,
    skills: ['Houdini 20.5', 'Solaris/USD', 'NukeX', 'ACES Color Grading'],
  },
  {
    id: 'pcrew-002',
    project_id: 'proj-001',
    person_id: 'usr-002',
    name: 'Marcus Vance',
    role: 'VFX Producer',
    department: 'Pipeline & Core Infrastructure',
    team: 'Core Pipeline Architects',
    office: 'Montreal HQ (Main Stage)',
    allocation_pct: 100,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    logged_hours: 280,
    estimated_hours: 360,
    skills: ['Bidding & Quoting', 'OpenUSD Integration', 'Budget Scheduling'],
  },
  {
    id: 'pcrew-003',
    project_id: 'proj-001',
    person_id: 'usr-003',
    name: 'Elena Rostova',
    role: 'Lead Compositor',
    department: 'Compositing',
    team: 'Comp Finishing Collective',
    office: 'Montreal HQ (Main Stage)',
    allocation_pct: 100,
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    logged_hours: 240,
    estimated_hours: 320,
    skills: ['Nuke Studio', 'Deep Comp', 'Cryptomatte', 'Grain Management'],
  },
  {
    id: 'pcrew-004',
    project_id: 'proj-001',
    person_id: 'usr-004',
    name: 'Kenji Sato',
    role: 'Lead Lighting & LookDev Artist',
    department: 'Lighting & LookDev',
    team: 'Solaris & LookDev Unit',
    office: 'London Site (West End)',
    allocation_pct: 75,
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    logged_hours: 195,
    estimated_hours: 260,
    skills: ['Karma XPU', 'MaterialX', 'Katana', 'Arnold 7.3'],
  },
  {
    id: 'pcrew-005',
    project_id: 'proj-001',
    person_id: 'usr-005',
    name: 'Sarah Jenkins',
    role: 'Senior Character Modeler',
    department: 'Modeling & Surfacing',
    team: 'Creature & Character Guild',
    office: 'London Site (West End)',
    allocation_pct: 60,
    avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    logged_hours: 160,
    estimated_hours: 200,
    skills: ['ZBrush', 'Maya 2024', 'Substance Painter', 'OpenUSD Geometries'],
  },
];

export const mockProjectDeliverables: ProjectDeliverableItem[] = [
  {
    id: 'pdel-001',
    project_id: 'proj-001',
    package_name: 'NK99_FINAL_DCI4K_ACEScg_SEQ010_v04.tar.gz',
    format: '16-bit Half-Float OpenEXR ZIP',
    resolution: '4096x2160 (4K DCI)',
    audio_config: '5.1 Stems & Dolby Atmos Bed',
    color_space: 'ACEScg / Linear',
    frame_count: 9216,
    file_size_gb: 420.5,
    delivery_target: 'Aspera Client Portal (Warner Nexus)',
    status: 'Delivered',
    checksum_sha256: '9f83a8b417c8d9e0325fa12b55f6c8d7e9b0124a98d7f6e5b4c3a210f9e8d7c6',
    delivered_at: '2026-08-14T18:30:00Z',
    recipient: 'Sarah Jenkins (Executive VFX Producer)',
  },
  {
    id: 'pdel-002',
    project_id: 'proj-001',
    package_name: 'NK99_PRORES4444XQ_TEMP_SCREENING_CUT_v02.mov',
    format: 'Apple ProRes 4444 XQ QuickTime',
    resolution: '3840x2160 (UHD)',
    audio_config: 'Stereo LT/RT 48kHz 24-bit',
    color_space: 'Rec.709 Gamma 2.4',
    frame_count: 5760,
    file_size_gb: 48.2,
    delivery_target: 'Frame.io Editorial Sync Room',
    status: 'Approved',
    checksum_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    delivered_at: '2026-08-10T12:00:00Z',
    recipient: 'Editorial & Studio Review Board',
  },
  {
    id: 'pdel-003',
    project_id: 'proj-001',
    package_name: 'NK99_OPENUSD_STAGE_PAYLOADS_HERO_ASSETS_v01.zip',
    format: 'OpenUSD 24.08 Native USDA/USDC',
    resolution: 'N/A (3D Assets & Shaders)',
    audio_config: 'N/A',
    color_space: 'MaterialX ACEScg',
    frame_count: 0,
    file_size_gb: 185.0,
    delivery_target: 'Outsourcing Vendor Share Gateway (Silhouette FX)',
    status: 'Delivered',
    checksum_sha256: '7d8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
    delivered_at: '2026-07-28T09:15:00Z',
    recipient: 'Silhouette FX Labs India Pipeline Team',
  },
  {
    id: 'pdel-004',
    project_id: 'proj-001',
    package_name: 'NK99_SEQ020_EXR_COMP_FINALS_v01.tar',
    format: 'Multi-Channel OpenEXR (Beauty, Crypto, Depth, Normals)',
    resolution: '4096x2160',
    audio_config: 'Stereo Reference',
    color_space: 'ACEScg',
    frame_count: 8240,
    file_size_gb: 380.0,
    delivery_target: 'Client Studio Cloud Storage Bucket',
    status: 'Packaging',
    checksum_sha256: 'calculating...',
    recipient: 'DI Lab & Color Grading Facility',
  },
];

export const mockProjectActivities: ProjectActivityItem[] = [
  {
    id: 'pact-001',
    project_id: 'proj-001',
    user_name: 'Alex Chen',
    user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    user_role: 'VFX Supervisor',
    action: 'Approved cut version for dailies review',
    target_type: 'Review',
    target_code: 'NK_010_010 v003',
    timestamp: '15 mins ago',
    details: 'Signed off on atmospheric depth fog and shockwave refraction passes.',
  },
  {
    id: 'pact-002',
    project_id: 'proj-001',
    user_name: 'Elena Rostova',
    user_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    user_role: 'Lead Compositor',
    action: 'Published new OpenEXR comp version',
    target_type: 'Shot',
    target_code: 'NK_010_020 v004',
    timestamp: '2 hours ago',
    details: 'Integrated final Houdini pyro simulation cache from Silhouette FX partner.',
  },
  {
    id: 'pact-003',
    project_id: 'proj-001',
    user_name: 'Marcus Vance',
    user_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    user_role: 'VFX Producer',
    action: 'Dispatched vendor package delivery',
    target_type: 'Delivery',
    target_code: 'PKG-VND-088',
    timestamp: '5 hours ago',
    details: 'Transferred 24 tracking and rotomation shot plates to Silhouette FX Labs India.',
  },
  {
    id: 'pact-004',
    project_id: 'proj-001',
    user_name: 'Sarah Jenkins',
    user_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    user_role: 'Senior Modeler',
    action: 'Registered new OpenUSD prim asset',
    target_type: 'Asset',
    target_code: 'AST_VEH_SPINNER_05 v001',
    timestamp: 'Yesterday at 16:40',
    details: 'Published 4 LOD levels and MaterialX shader assignments.',
  },
  {
    id: 'pact-005',
    project_id: 'proj-001',
    user_name: 'Alex Chen',
    user_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    user_role: 'VFX Supervisor',
    action: 'Completed milestone verification',
    target_type: 'Milestone',
    target_code: 'Hero Cyber Assets Lock',
    timestamp: '2 days ago',
    details: 'All 85 asset payloads validated against production USD schemas.',
  },
];
