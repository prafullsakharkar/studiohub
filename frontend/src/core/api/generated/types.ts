/**
 * StudioHub — Generated Canonical Contract Types
 *
 * Authoritative types mirroring Django REST Framework models and serializers
 * across both Mock API (MSW) and Real REST API modes.
 */

import { PaginatedResponse, DrfErrorResponse, QueryParams } from '@/types/common';
export type { PaginatedResponse, DrfErrorResponse, QueryParams };

export type { ProductionStatus, PriorityLevel, Department, BaseEntity } from '@/types/common';

// Re-export core domain types strictly aligned with DRF serializers
export type {
  User,
  MembershipType,
  AuthTokens,
} from '@/types/identity';

export type {
  Project,
  ProjectStatus,
  ProjectType,
} from '@/types/production';

export type {
  Shot,
  ShotPipelineStatus,
  ShotCutInfo,
  PlateInfo,
} from '@/types/production';

export type {
  Asset,
  AssetCategory,
  AssetSoftware,
  AssetTechnicalSpecs,
  AssetVersionRecord,
} from '@/types/production';

export type {
  Task,
  TaskEntityType,
  TimelogCategory,
  TaskSchedule,
  TaskDependency,
} from '@/types/production';

export type {
  ReviewSession,
  ReviewComment,
  ReviewAnnotation,
} from '@/types/production';

export type {
  ProductionVersion,
  Version,
  VersionPublishingInfo,
} from '@/types/production';

export type {
  DeliveryPackage,
} from '@/types/production';

export type {
  AuditLog,
  AuditSeverity,
} from '@/types/audit';

export type {
  Software,
  SoftwareVersion,
  MasterStatus,
  MasterTaskType,
  MasterAssetType,
} from '@/types/masterData';

export type {
  Sequence,
} from '@/types/production';

export type {
  Show,
} from '@/types/production';

/**
 * Standard Django REST Framework Token Pair Response
 */
export interface AuthTokenResponse {
  tokens: {
    access: string;
    refresh: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatar?: string;
    department?: string;
    title?: string;
  };
}

/**
 * Refresh Token Request & Response
 */
export interface TokenRefreshRequest {
  refresh: string;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

/**
 * Common DRF Mutation Action Response (e.g. status transition, approval, verdict)
 */
export interface ActionSuccessResponse {
  status: 'ok' | 'success';
  message?: string;
  id?: string;
  [key: string]: any;
}
