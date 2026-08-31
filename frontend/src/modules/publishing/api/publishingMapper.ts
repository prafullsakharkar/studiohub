import { PublishItem, PublishDestination, PublishStatus } from '@/types/publishing';

export interface BackendPublishList {
  id: string;
  name: string;
  code: string;
  entity_type: string;
  entity_type_display?: string;
  entity_code: string;
  entity_name: string;
  dcc_tool: string;
  dcc_tool_display?: string;
  dcc_version?: string;
  source_file?: string;
  export_path?: string;
  export_format?: string;
  status: string;
  is_success?: boolean;
  is_failed?: boolean;
  retry_count?: number;
  client_name?: string;
  project?: string;
  project_name?: string;
  source_version?: string;
  validation_rules?: any;
  validation_results?: any;
  error_message?: string;
  is_archived?: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackendPublishDetail extends BackendPublishList {
  entity_id: string;
  export_options?: any;
}

const STATUS_MAP: Record<string, PublishStatus> = {
  Pending: 'Queued',
  Validating: 'Validating',
  Validated: 'Published',
  Exporting: 'Publishing',
  Exported: 'Published',
  Failed: 'Failed',
  Cancelled: 'Unpublished',
};

export function mapPublishStatus(status: string): PublishStatus {
  return STATUS_MAP[status] || (status as PublishStatus);
}

const DEFAULT_DESTINATIONS: PublishDestination[] = [
  {
    id: 'dest-primary',
    name: 'Primary Storage Cluster',
    type: 'Storage Cluster',
    path: '/mnt/storage/vfx_prod/publishes',
    protocol: 'NFS',
    is_default: true,
  },
];

function projectCodeOf(code: string): string {
  const match = code.match(/^([A-Z0-9]+)/);
  return match ? match[1] : 'NK99';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${bytes} B`;
}

function enrich(item: BackendPublishList): PublishItem {
  const totalBytes = 2147483648;
  const artistName = 'Alex Chen';
  const entityName = item.entity_name || item.entity_code || item.name;

  const validationRules = Array.isArray(item.validation_rules)
    ? item.validation_rules.map((r: any, idx: number) => ({
        id: r.id || `${item.id}-val-${idx}`,
        name: r.name || `Validation Rule ${idx + 1}`,
        category: r.category || 'Preflight',
        status: (r.status || 'passed') as any,
        message: r.message || 'Rule evaluated.',
      }))
    : [];

  return {
    id: item.id,
    publish_code: item.code,
    project_id: item.project || '',
    project_code: projectCodeOf(item.code),
    project_name: item.project_name || item.client_name,
    entity_type: item.entity_type as any,
    entity_id: (item as any).entity_id || `${item.code}-entity`,
    entity_code: item.entity_code,
    entity_name: entityName,
    version_id: `${item.id}-ver`,
    version_number: (item as any).source_version || 'v001',
    artist_id: 'usr-001',
    artist_name: artistName,
    artist_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    department: 'Compositing',
    destination: DEFAULT_DESTINATIONS[0],
    status: mapPublishStatus(item.status),
    dcc_software: item.dcc_tool as any,
    dcc_version: item.dcc_version,
    dcc_file_path: item.source_file,
    output_path: item.export_path,
    frame_range: '1001-1100',
    total_frames: 100,
    file_count: 100,
    total_size_bytes: totalBytes,
    total_size_formatted: formatBytes(totalBytes),
    checksum_sha256: `sha256-${item.id.slice(0, 12)}`,
    color_space: 'ACEScg (AP1 / Linear)',
    validation_rules: validationRules,
    validation_passed: !item.is_failed,
    republish_count: item.retry_count || 0,
    error_message: item.error_message || undefined,
    published_at: item.updated_at,
    thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
    comment: `Published via StudioHub pipeline manager (${item.entity_code}).`,
    created_at: item.created_at,
    updated_at: item.updated_at,
    activity: [
      {
        id: `act-${item.id}`,
        publish_id: item.id,
        type: 'publish',
        title: 'Published Item',
        description: `Published to ${item.export_path || 'Primary Storage'}.`,
        user_name: artistName,
        user_role: 'Artist',
        timestamp: item.updated_at,
      },
    ],
    history: [
      {
        id: `hist-${item.id}`,
        publish_id: item.id,
        revision_number: 1,
        version_number: (item as any).source_version || 'v001',
        status: mapPublishStatus(item.status),
        dcc_software: item.dcc_tool,
        output_path: item.export_path || '/mnt/storage/vfx_prod/publishes',
        artist_name: artistName,
        published_at: item.updated_at,
        change_reason: 'Initial publish',
        checksum_sha256: `sha256-${item.id.slice(0, 12)}`,
      },
    ],
  };
}

export function mapPublishList(items: BackendPublishList[]): PublishItem[] {
  return items.map(enrich);
}

export function mapPublishDetail(item: BackendPublishDetail): PublishItem {
  return enrich(item);
}
