import { BaseEntity, Department, PriorityLevel, ProductionStatus } from '@/types/common';

export interface Task extends BaseEntity {
  title: string;
  code: string;
  project_id: string;
  project_code: string;
  entity_type: 'Shot' | 'Asset' | 'Sequence';
  entity_id: string;
  entity_code: string;
  department: Department;
  status: ProductionStatus;
  priority: PriorityLevel;
  assignee_id?: string;
  assignee_name?: string;
  assignee_avatar?: string;
  reviewer_id?: string;
  reviewer_name?: string;
  due_date: string;
  estimated_hours: number;
  logged_hours: number;
  description: string;
  software: string;
}

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    title: 'Volumetric Rain & Neon Reflections Simulation',
    code: 'TSK-FX-1092',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Shot',
    entity_id: 'shot-001',
    entity_code: 'NK_010_010',
    department: 'FX & Simulation',
    status: 'In Progress',
    priority: 'Critical',
    assignee_id: 'usr-003',
    assignee_name: 'Elena Rostova',
    assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    reviewer_id: 'usr-001',
    reviewer_name: 'Alex Chen',
    due_date: '2026-08-25',
    estimated_hours: 48,
    logged_hours: 32.5,
    description: 'Simulate interaction between falling torrential rain particles and high-velocity spinner hull forces with spray sheets.',
    software: 'Houdini 20.5',
    created_at: '2026-08-01T09:00:00Z',
    updated_at: '2026-08-17T14:30:00Z',
  },
  {
    id: 'task-002',
    title: 'Plasma Missile Impact Pyroclastic Explosion',
    code: 'TSK-FX-1095',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Shot',
    entity_id: 'shot-003',
    entity_code: 'NK_010_030',
    department: 'FX & Simulation',
    status: 'Pending Review',
    priority: 'High',
    assignee_id: 'usr-004',
    assignee_name: 'Sarah Jenkins',
    assignee_avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    reviewer_id: 'usr-001',
    reviewer_name: 'Alex Chen',
    due_date: '2026-08-20',
    estimated_hours: 36,
    logged_hours: 38,
    description: 'Pyro solver explosion on bridge abutment. Ensure high particle count sparks bounce against road geometry.',
    software: 'Houdini 20.5',
    created_at: '2026-08-05T11:00:00Z',
    updated_at: '2026-08-17T09:15:00Z',
  },
  {
    id: 'task-003',
    title: 'Mecha Android Hydraulic Muscle Rigging',
    code: 'TSK-RIG-0412',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Asset',
    entity_id: 'ast-002',
    entity_code: 'AST_CHR_MECHA_09',
    department: 'Rigging',
    status: 'In Progress',
    priority: 'Medium',
    assignee_id: 'usr-002',
    assignee_name: 'Marcus Vance',
    assignee_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    reviewer_id: 'usr-001',
    reviewer_name: 'Alex Chen',
    due_date: '2026-08-30',
    estimated_hours: 60,
    logged_hours: 44,
    description: 'Build automated IK/FK switchable limbs and piston sliding constraints for knee and elbow joints.',
    software: 'Maya 2025',
    created_at: '2026-08-02T10:00:00Z',
    updated_at: '2026-08-16T17:00:00Z',
  },
  {
    id: 'task-004',
    title: 'Final Deep Compositing & Beauty Grade',
    code: 'TSK-CMP-0891',
    project_id: 'proj-001',
    project_code: 'NK99',
    entity_type: 'Shot',
    entity_id: 'shot-002',
    entity_code: 'NK_010_020',
    department: 'Compositing',
    status: 'Approved',
    priority: 'High',
    assignee_id: 'usr-003',
    assignee_name: 'Elena Rostova',
    assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    reviewer_id: 'usr-001',
    reviewer_name: 'Alex Chen',
    due_date: '2026-08-15',
    estimated_hours: 24,
    logged_hours: 22,
    description: 'Composite CG render passes, cryptomattes, depth of field, lens flare blooms, and film grain.',
    software: 'NukeX 15',
    created_at: '2026-08-08T09:00:00Z',
    updated_at: '2026-08-14T17:30:00Z',
  },
  {
    id: 'task-005',
    title: 'Dragon Wing Membrane Dynamic Tear Simulation',
    code: 'TSK-FX-1204',
    project_id: 'proj-002',
    project_code: 'AETH2',
    entity_type: 'Shot',
    entity_id: 'shot-004',
    entity_code: 'AETH_101_040',
    department: 'FX & Simulation',
    status: 'Not Started',
    priority: 'Critical',
    assignee_id: 'usr-003',
    assignee_name: 'Elena Rostova',
    assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    reviewer_id: 'usr-001',
    reviewer_name: 'Alex Chen',
    due_date: '2026-09-10',
    estimated_hours: 50,
    logged_hours: 0,
    description: 'Vellum cloth simulation for leathery wings reacting to aerodynamic turbulence and ballista hits.',
    software: 'Houdini 20.5',
    created_at: '2026-08-15T14:00:00Z',
    updated_at: '2026-08-15T14:00:00Z',
  },
];
