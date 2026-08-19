export type Role =
  | 'Platform Admin'
  | 'Organization Admin'
  | 'VFX Supervisor'
  | 'Lead Artist'
  | 'Production Coordinator'
  | 'Artist'
  | 'Client Reviewer'
  | 'Tournament Admin'
  | 'Coach'
  | 'Selector'
  | 'Player'
  | 'Scorer'
  | 'Umpire'
  | 'Fan';

export type Permission =
  | 'projects:create'
  | 'projects:read'
  | 'projects:update'
  | 'projects:delete'
  | 'shots:create'
  | 'shots:read'
  | 'shots:update'
  | 'shots:delete'
  | 'shots:approve'
  | 'assets:create'
  | 'assets:read'
  | 'assets:update'
  | 'assets:delete'
  | 'tasks:create'
  | 'tasks:read'
  | 'tasks:update'
  | 'tasks:delete'
  | 'reviews:create'
  | 'reviews:read'
  | 'reviews:approve'
  | 'audit:read'
  | 'settings:update'
  | 'users:manage';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string;
  role: Role;
  permissions: Permission[];
  organization_id: string;
  organization_name: string;
  department: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: User;
}

export interface RefreshResponse {
  access: string;
}
