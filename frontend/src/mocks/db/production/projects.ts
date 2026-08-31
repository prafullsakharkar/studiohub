import { BaseEntity, ProductionStatus } from '@/types/common';

export interface Project extends BaseEntity {
  organization_id?: string;
  name: string;
  code: string;
  type: 'Feature Film' | 'Episodic Series' | 'Commercial' | 'Game Cinematic';
  description: string;
  status: ProductionStatus;
  fps: number;
  resolution: string;
  aspect_ratio: string;
  color_space: string;
  start_date: string;
  delivery_date: string;
  thumbnail_url: string;
  total_shots: number;
  approved_shots: number;
  in_progress_shots: number;
  total_assets: number;
  budget_usd: number;
  supervisor_id: string;
  supervisor_name: string;
  coordinator_id: string;
  coordinator_name: string;
  client_id: string;
  client_name: string;
  client_contact_id?: string;
  client_contact_name?: string;
  vendor_ids?: string[];
  vendor_names?: string[];
  vendor_team_ids?: string[];
}

export const mockProjects: Project[] = [
  {
    organization_id: 'org-apex-01',
    id: 'proj-001',
    name: 'Cyberpunk 2099: Neo-Kyoto',
    code: 'NK99',
    type: 'Feature Film',
    description: 'Futuristic sci-fi feature film featuring complex photorealistic volumetric environments, digital doubles, and vehicle chases.',
    status: 'In Progress',
    fps: 24,
    resolution: '4096x2160 (4K DCI)',
    aspect_ratio: '2.39:1',
    color_space: 'ACEScg / ACEScc',
    start_date: '2025-11-01',
    delivery_date: '2026-10-30',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
    total_shots: 240,
    approved_shots: 142,
    in_progress_shots: 78,
    total_assets: 85,
    budget_usd: 4800000,
    supervisor_id: 'usr-001',
    supervisor_name: 'Alex Chen',
    coordinator_id: 'usr-002',
    coordinator_name: 'Marcus Vance',
    client_id: 'cl-001',
    client_name: 'Warner Nexus Studios',
    client_contact_id: 'cc-001',
    client_contact_name: 'Sarah Jenkins',
    vendor_ids: ['ven-001', 'ven-002'],
    vendor_names: ['Silhouette FX Labs India', 'Nordic Creatures & FX'],
    vendor_team_ids: ['vt-001', 'vt-002'],
    created_at: '2025-10-15T09:00:00Z',
    updated_at: '2026-08-10T14:20:00Z',
  },
  {
    organization_id: 'org-apex-01',
    id: 'proj-002',
    name: 'Chronicles of Aethelgard: Season 2',
    code: 'AETH2',
    type: 'Episodic Series',
    description: 'Epic high-fantasy saga with photorealistic creature rigs, magical FX simulations, and castle destruction sequences.',
    status: 'In Progress',
    fps: 23.976,
    resolution: '3840x2160 (UHD)',
    aspect_ratio: '2.00:1',
    color_space: 'ACEScg',
    start_date: '2026-01-15',
    delivery_date: '2026-12-15',
    thumbnail_url: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=800&auto=format&fit=crop&q=80',
    total_shots: 380,
    approved_shots: 195,
    in_progress_shots: 140,
    total_assets: 120,
    budget_usd: 6200000,
    supervisor_id: 'usr-001',
    supervisor_name: 'Alex Chen',
    coordinator_id: 'usr-002',
    coordinator_name: 'Marcus Vance',
    client_id: 'cl-002',
    client_name: 'Amazon Prime Original Productions',
    client_contact_id: 'cc-003',
    client_contact_name: 'David Zhao',
    vendor_ids: ['ven-002', 'ven-003'],
    vendor_names: ['Nordic Creatures & FX', 'PixelPulse Tracking & Photogrammetry'],
    vendor_team_ids: ['vt-003'],
    created_at: '2025-12-01T11:00:00Z',
    updated_at: '2026-08-12T16:45:00Z',
  },
  {
    organization_id: 'org-apex-01',
    id: 'proj-003',
    name: 'Apex Velocity: Hyperdrive Trailer',
    code: 'VEL01',
    type: 'Game Cinematic',
    description: 'High-octane game reveal trailer featuring next-generation space combat, laser simulations, and nebula environments.',
    status: 'Pending Review',
    fps: 60,
    resolution: '3840x2160 (UHD)',
    aspect_ratio: '16:9',
    color_space: 'Rec.709 / Linear',
    start_date: '2026-04-01',
    delivery_date: '2026-09-01',
    thumbnail_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    total_shots: 54,
    approved_shots: 46,
    in_progress_shots: 8,
    total_assets: 34,
    budget_usd: 1200000,
    supervisor_id: 'usr-004',
    supervisor_name: 'Kenji Sato',
    coordinator_id: 'usr-003',
    coordinator_name: 'Elena Rostova',
    client_id: 'cl-004',
    client_name: 'PlayStation Studios Creative Group',
    client_contact_id: 'cc-005',
    client_contact_name: 'Marcus Bell',
    vendor_ids: ['ven-001'],
    vendor_names: ['Silhouette FX Labs India'],
    vendor_team_ids: ['vt-001'],
    created_at: '2026-03-10T08:30:00Z',
    updated_at: '2026-08-01T10:15:00Z',
  },
  {
    organization_id: 'org-apex-01',
    id: 'proj-004',
    name: 'Luminary Aurora: Cosmic Awakening',
    code: 'LUM01',
    type: 'Commercial',
    description: 'Super Bowl commercial featuring hyper-stylized aurora borealis, crystalline fluid dynamics, and luxury automotive beauty lighting.',
    status: 'Approved',
    fps: 30,
    resolution: '3840x2160 (UHD)',
    aspect_ratio: '16:9',
    color_space: 'ACEScc',
    start_date: '2026-06-01',
    delivery_date: '2026-08-25',
    thumbnail_url: 'https://images.unsplash.com/photo-1507499739999-097706ad8914?w=800&auto=format&fit=crop&q=80',
    total_shots: 18,
    approved_shots: 18,
    in_progress_shots: 0,
    total_assets: 12,
    budget_usd: 650000,
    supervisor_id: 'usr-004',
    supervisor_name: 'Kenji Sato',
    coordinator_id: 'usr-003',
    coordinator_name: 'Elena Rostova',
    client_id: 'cl-003',
    client_name: 'A24 Independent Visions',
    client_contact_id: 'cc-004',
    client_contact_name: 'Chloe Monet',
    vendor_ids: [],
    vendor_names: [],
    vendor_team_ids: [],
    created_at: '2026-05-15T12:00:00Z',
    updated_at: '2026-08-20T09:00:00Z',
  },
];
