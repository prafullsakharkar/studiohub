import { BaseEntity, ProductionStatus } from '@/types/common';

export interface Project extends BaseEntity {
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
  client_name: string;
}

export const mockProjects: Project[] = [
  {
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
    client_name: 'Warner Nexus Studios',
    created_at: '2025-10-15T09:00:00Z',
    updated_at: '2026-08-10T14:20:00Z',
  },
  {
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
    client_name: 'Amazon Prime Original Productions',
    created_at: '2025-12-01T11:00:00Z',
    updated_at: '2026-08-12T16:45:00Z',
  },
  {
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
    budget_usd: 850000,
    supervisor_id: 'usr-001',
    supervisor_name: 'Alex Chen',
    coordinator_id: 'usr-002',
    coordinator_name: 'Marcus Vance',
    client_name: 'Electronic Arts / Respawn',
    created_at: '2026-03-20T10:30:00Z',
    updated_at: '2026-08-14T09:10:00Z',
  },
  {
    id: 'proj-004',
    name: 'Deep Ocean: Leviathan',
    code: 'LEVI',
    type: 'Feature Film',
    description: 'Deep sea sci-fi thriller featuring bioluminescent creature assets, fluid dynamics, and underwater caustics.',
    status: 'Not Started',
    fps: 24,
    resolution: '4096x2160 (4K DCI)',
    aspect_ratio: '2.39:1',
    color_space: 'ACEScg',
    start_date: '2026-09-01',
    delivery_date: '2027-04-30',
    thumbnail_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop&q=80',
    total_shots: 180,
    approved_shots: 0,
    in_progress_shots: 12,
    total_assets: 45,
    budget_usd: 3400000,
    supervisor_id: 'usr-001',
    supervisor_name: 'Alex Chen',
    coordinator_id: 'usr-002',
    coordinator_name: 'Marcus Vance',
    client_name: 'Paramount Pictures',
    created_at: '2026-07-01T08:00:00Z',
    updated_at: '2026-08-01T10:00:00Z',
  },
];
