export type IntegrationCategory =
  | 'pipeline'
  | 'storage'
  | 'identity'
  | 'communication'
  | 'production'
  | 'media'
  | 'finance'
  | 'analytics';

export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | 'syncing' | 'paused';
export type IntegrationAuthType = 'oauth2' | 'api_key' | 'saml' | 'service_account' | 'webhook';
export type SyncDirection = 'bidirectional' | 'inbound' | 'outbound';

export interface IntegrationLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  duration_ms?: number;
  payload?: Record<string, any>;
  endpoint?: string;
}

export interface IntegrationConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'boolean' | 'select' | 'textarea';
  value: any;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  description?: string;
}

export interface Integration {
  id: string;
  provider_id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  icon_name: string;
  version: string;
  status: IntegrationStatus;
  auth_type: IntegrationAuthType;
  health_score: number; // 0 - 100
  is_official: boolean;
  docs_url?: string;
  
  // Configuration
  configuration: Record<string, any>;
  config_fields: IntegrationConfigField[];
  credentials_masked: Record<string, string>;
  
  // Capabilities & Events
  supported_events: string[];
  events_subscribed: string[];
  permissions_required: string[];
  
  // Sync Status & Metrics
  sync_config: {
    direction: SyncDirection;
    auto_sync_interval_mins: number;
    last_sync_at?: string;
    last_sync_status: 'success' | 'failed' | 'partial' | 'idle';
    synced_records_count: number;
    error_count_24h: number;
    avg_latency_ms: number;
  };

  // Activity Logs
  logs: IntegrationLog[];
  
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationTestResult {
  success: boolean;
  latency_ms: number;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface MigrationStep {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_records: number;
  processed_records: number;
  errors_count: number;
  message?: string;
}

export interface MigrationJob {
  id: string;
  source_provider: 'shotgrid' | 'ftrack' | 'kitsu';
  target_project_id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  steps: MigrationStep[];
  entity_mappings: {
    projects: boolean;
    shots: boolean;
    assets: boolean;
    tasks: boolean;
    versions: boolean;
    users: boolean;
  };
}
