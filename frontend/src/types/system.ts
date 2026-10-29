// ---------------------------------------------------------------------------
// from settings.ts
// ---------------------------------------------------------------------------

export interface PipelineSettings {
  default_fps: number;
  default_color_space: string;
  default_resolution: string;
  usd_schema_version: string;
  ocio_config_path: string;
  farm_engine: string;
  storage_mount_path: string;
  enable_ai_denoising: boolean;
  enable_auto_transcode: boolean;
  enable_webhooks: boolean;
  [key: string]: any;
}
export type Settings = PipelineSettings;

// ---------------------------------------------------------------------------
// from apiHealth.ts
// ---------------------------------------------------------------------------

export type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'maintenance' | 'healthy' | 'failing' | string;
export interface DailyUptimePoint {
  date: string;
  uptime: number;
  status: 'operational' | 'degraded' | 'outage' | string;
  incidents: number;
}
export interface ServiceHealthSummary {
  id: string;
  name: string;
  code: string;
  description: string;
  category: string;
  status: ServiceStatus;
  uptime30d: number;
  latencyAvg: number;
  errorRate: number;
  activeNodes: number;
  totalNodes: number;
  endpointsCount: number;
  dailyUptime?: DailyUptimePoint[];
  iconName?: string;
  protocol?: string;
  version?: string;
  [key: string]: any;
}
export interface EndpointMetric {
  id: string;
  name: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  serviceId?: string;
  serviceName?: string;
  category?: string;
  categoryLabel?: string;
  status: 'operational' | 'degraded' | 'outage' | 'healthy' | 'failing' | string;
  latencyMs: number;
  lastChecked: string;
  httpStatus: number;
  uptime24h?: number;
  p95LatencyMs: number;
  errorRatePercent?: number;
  reqPerSec?: number;
  recentLatencies: number[];
  details?: {
    dnsMs?: number;
    tlsMs?: number;
    ttfbMs?: number;
    downloadMs?: number;
    payloadSizeKb?: number;
    version?: string;
    serverLocation?: string;
    [key: string]: any;
  };
  latencyCurrent?: number;
  latencyP95?: number;
  latencyP99?: number;
  rps?: number;
  successRatePercent?: number;
  recentStatusCodes?: { code: number; count: number }[];
  cacheHitRatio?: number;
  databaseQueriesCount?: number;
  [key: string]: any;
}
export interface IncidentEvent {
  id: string;
  title: string;
  service?: string;
  serviceId?: string;
  serviceName?: string;
  severity: 'minor' | 'major' | 'critical' | 'maintenance' | string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved' | string;
  startedAt?: string;
  createdAt?: string;
  resolvedAt?: string;
  impactDescription?: string;
  description?: string;
  rootCause?: string;
  updates: {
    timestamp: string;
    message: string;
    status: string;
  }[];
  [key: string]: any;
}
export interface GlobalHealthMetrics {
  overallStatus: 'operational' | 'degraded' | 'outage' | 'all_systems_operational' | 'degraded_performance' | 'major_outage' | string;
  slaCompliance?: number;
  slaTarget?: number;
  avgLatencyMs?: number;
  averageLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  systemUptime30d?: number;
  globalErrorRate?: number;
  totalRequestsToday?: number;
  successRate?: number;
  activeIncidents?: number;
  activeIncidentsCount?: number;
  lastFullProbeTime?: string;
  healthyEndpointsCount?: number;
  totalEndpointsCount?: number;
  healthyServicesCount?: number;
  totalServicesCount?: number;
  activeServicesCount?: number;
  activeFarmNodes?: number;
  totalFarmNodes?: number;
  [key: string]: any;
}
export interface LiveProbeHistoryItem {
  id: string;
  timestamp: string;
  endpointId?: string;
  endpointPath?: string;
  endpoint?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | string;
  status: number;
  latencyMs: number;
  success: boolean;
  notes?: string;
  [key: string]: any;
}
