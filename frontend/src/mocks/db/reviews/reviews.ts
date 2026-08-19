import { BaseEntity, ProductionStatus } from '@/types/common';

export interface ReviewAnnotation {
  id: string;
  frame_number: number;
  timecode: string;
  author_name: string;
  author_avatar?: string;
  comment: string;
  drawing_coordinates?: { x: number; y: number; color: string; size: number }[];
  created_at: string;
}

export interface ReviewSession extends BaseEntity {
  title: string;
  code: string;
  project_id: string;
  project_code: string;
  entity_type: 'Shot' | 'Asset';
  entity_id: string;
  entity_code: string;
  version_number: string;
  video_url: string;
  thumbnail_url: string;
  status: ProductionStatus;
  lead_reviewer_id: string;
  lead_reviewer_name: string;
  annotations: ReviewAnnotation[];
  resolution: string;
  fps: number;
  total_frames: number;
  supervisor_verdict?: 'Approved' | 'Retake' | 'Pending Review';
  supervisor_notes?: string;
}

export const mockReviews: ReviewSession[] = [
  {
    id: 'rev-001',
    title: 'NK_010_030 Drone Explosion FX Pass v003',
    code: 'REV-2026-0817-01',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Shot',
    entity_id: 'shot-003',
    entity_code: 'NK_010_030',
    version_number: 'v003',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    status: 'Pending Review',
    lead_reviewer_id: 'usr-001',
    lead_reviewer_name: 'Alex Chen',
    resolution: '4096x2160',
    fps: 24,
    total_frames: 192,
    supervisor_verdict: 'Pending Review',
    supervisor_notes: 'Impact timing looks strong. Sparks in upper right frame need higher drag forces to prevent clipping.',
    annotations: [
      {
        id: 'ann-01',
        frame_number: 48,
        timecode: '01:00:02:00',
        author_name: 'Alex Chen (Supervisor)',
        comment: 'Initial plasma detonation flash needs a 1-frame bloom exponential falloff.',
        created_at: '2026-08-17T11:25:00Z',
      },
      {
        id: 'ann-02',
        frame_number: 96,
        timecode: '01:00:04:00',
        author_name: 'Elena Rostova (Lead Comp)',
        comment: 'Debris silhouette against background neon signs is well balanced.',
        created_at: '2026-08-17T13:10:00Z',
      },
    ],
    created_at: '2026-08-17T10:00:00Z',
    updated_at: '2026-08-17T14:00:00Z',
  },
  {
    id: 'rev-002',
    title: 'NK_010_010 Spinner Dive Lighting & Volume Pass v004',
    code: 'REV-2026-0816-04',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Shot',
    entity_id: 'shot-001',
    entity_code: 'NK_010_010',
    version_number: 'v004',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    status: 'In Progress',
    lead_reviewer_id: 'usr-001',
    lead_reviewer_name: 'Alex Chen',
    resolution: '4096x2160',
    fps: 24,
    total_frames: 148,
    supervisor_verdict: 'Pending Review',
    supervisor_notes: 'Atmospheric depth mist is looking great. Check contact shadow on cockpit windscreen.',
    annotations: [
      {
        id: 'ann-03',
        frame_number: 64,
        timecode: '01:00:02:16',
        author_name: 'Alex Chen (Supervisor)',
        comment: 'Increase red neon rim light saturation on spinner starboard wing.',
        created_at: '2026-08-16T15:00:00Z',
      },
    ],
    created_at: '2026-08-16T12:00:00Z',
    updated_at: '2026-08-16T16:00:00Z',
  },
  {
    id: 'rev-003',
    title: 'AETH_101_040 Dragon Parapet Landing Anim v005',
    code: 'REV-2026-0815-02',
    project_id: 'proj-002',
    project_code: 'AETH2',
    entity_type: 'Shot',
    entity_id: 'shot-004',
    entity_code: 'AETH_101_040',
    version_number: 'v005',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    thumbnail_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    status: 'In Progress',
    lead_reviewer_id: 'usr-001',
    lead_reviewer_name: 'Alex Chen',
    resolution: '3840x2160',
    fps: 23.976,
    total_frames: 220,
    supervisor_verdict: 'Pending Review',
    supervisor_notes: 'Weight on rear claws is much improved. Ready for FX smoke pass handover.',
    annotations: [],
    created_at: '2026-08-15T14:30:00Z',
    updated_at: '2026-08-15T16:00:00Z',
  },
];
