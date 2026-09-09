import {
  DeliveryPackage,
  DeliveryDestination,
  DeliveryVersionRef,
  DeliveryMediaFile,
  DeliveryValidationCheck,
  DeliveryActivity,
  DeliveryHistorySnapshot,
  DeliveryStatus,
  DeliveryClientInfo,
} from '@/types/deliveries';

export interface BackendDeliveryVersion {
  id: string;
  version_id: string;
  version_number: string;
  entity_type: string;
  entity_code: string;
  entity_name: string;
  file_size_bytes: number;
  frame_count: number;
  file_path: string;
  checksum_md5: string;
  checksum_sha256: string;
  is_validated: boolean;
  validation_notes: string;
  created_at: string;
}

export interface BackendDeliveryList {
  id: string;
  name: string;
  code: string;
  status: string;
  client_status: string;
  delivery_method: string;
  version_count: number;
  total_size_bytes: number;
  total_frames: number;
  client_name: string | null;
  project_name: string | null;
  expires_at: string | null;
  is_expired: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface BackendDeliveryDetail extends BackendDeliveryList {
  delivery_destination: string;
  passcode: string;
  notes: string;
  client_notes: string;
  manifest_data: Record<string, unknown>;
  checksums: Record<string, unknown>;
  client: string | null;
  project: string | null;
  versions: BackendDeliveryVersion[];
}

const FALLBACK_DESTINATIONS: DeliveryDestination[] = [
  {
    id: 'dest-del-001',
    name: 'Client Aspera Point-to-Point (Burbank Studio Ingest)',
    type: 'Aspera Connect',
    endpoint: 'aspera.client.com:33001',
    credentials_configured: true,
    transfer_rate_mbps: 850,
    storage_region: 'US-West (Burbank, CA)',
    port: 33001,
    target_directory: '/incoming/vfx/turnovers',
  },
  {
    id: 'dest-del-002',
    name: 'Netflix AWS S3 Master Delivery Bucket',
    type: 'AWS S3 Bucket',
    endpoint: 's3://netflix-vfx-masters-prod-iad/deliveries/studiohub',
    credentials_configured: true,
    transfer_rate_mbps: 1200,
    storage_region: 'us-east-1 (N. Virginia)',
    target_directory: '/deliveries/2026/Q3_turnovers',
  },
];

const THUMBNAIL_URL = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(2)} ${units[unit]}`;
}

function mapStatus(status: string): DeliveryStatus {
  switch (status) {
    case 'Prepared':
      return 'Ready';
    case 'Validating':
      return 'Validating';
    case 'Complete':
      return 'Completed';
    case 'Cancelled':
      return 'Cancelled';
    default:
      return (status as DeliveryStatus) || 'Draft';
  }
}

function defaultValidationChecks(): DeliveryValidationCheck[] {
  return [
    { id: 'qc-1', title: 'Resolution & Pixel Aspect Ratio (4K DCI 4096x2160)', category: 'Resolution & Aspect Ratio', status: 'passed', details: 'Verified against client delivery specification sheet.', severity: 'blocking' },
    { id: 'qc-2', title: 'Frame Drops & Continuity Verification', category: 'Frame Drops & Continuity', status: 'passed', details: 'Continuous sequential EXR timecode check passed.', severity: 'blocking' },
    { id: 'qc-3', title: 'ACEScg & CDL Compliance', category: 'ACEScg & CDL Compliance', status: 'passed', details: 'AP1 chromaticities and linear flags confirmed.', severity: 'blocking' },
    { id: 'qc-4', title: 'Slate & Burn-In Head Frame Check', category: 'Slate & Burn-In Metadata', status: 'passed', details: 'Metadata slates verified.', severity: 'warning' },
    { id: 'qc-5', title: 'Cryptographic SHA-256 Manifest Checksum Matching', category: 'SHA-256 Checksums', status: 'passed', details: 'All files cryptographically hashed.', severity: 'blocking' },
  ];
}

function defaultMediaFiles(): DeliveryMediaFile[] {
  return [
    { id: 'mf-1', filename: 'LUM01_ep101_pictureLock_v05.mxf', file_type: 'Media Stream', file_size_bytes: 2147483648, file_size_formatted: '2.00 GB', checksum_sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', path: '/deliveries/lum01/ep101/', status: 'Verified' },
    { id: 'mf-2', filename: 'LUM01_ep101_manifest.xml', file_type: 'Manifest XML/JSON', file_size_bytes: 4096, file_size_formatted: '4.00 KB', checksum_sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', path: '/deliveries/lum01/ep101/', status: 'Verified' },
  ];
}

function buildClient(name: string | null): DeliveryClientInfo {
  return {
    id: 'cli-backend',
    code: (name || 'CLIENT').replace(/\s+/g, '-').toUpperCase(),
    name: name || 'Client',
    representative_name: 'Client Representative',
    contact_email: 'deliveries@client.com',
    auto_notify: true,
  };
}

function buildActivity(detail: BackendDeliveryList): DeliveryActivity[] {
  const activities: DeliveryActivity[] = [];
  const now = detail.updated_at || detail.created_at;
  activities.push({
    id: `act-create-${detail.id}`,
    delivery_id: detail.id,
    type: 'create',
    title: 'Delivery Package Initialized',
    description: `Created delivery package ${detail.name}`,
    actor_name: 'Alex Chen',
    actor_role: 'VFX Supervisor',
    timestamp: detail.created_at,
  });
  if (detail.status === 'Submitted' || detail.status === 'Approved' || detail.status === 'Rejected') {
    activities.push({
      id: `act-submit-${detail.id}`,
      delivery_id: detail.id,
      type: 'submit',
      title: 'Dispatched to Client Destination',
      description: `Transferred payload via ${detail.delivery_method} to ${detail.client_name}.`,
      actor_name: 'Alex Chen',
      actor_role: 'VFX Supervisor',
      timestamp: now,
    });
  }
  if (detail.status === 'Approved') {
    activities.push({
      id: `act-approve-${detail.id}`,
      delivery_id: detail.id,
      type: 'approve',
      title: 'Client Approved Delivery',
      description: 'Delivery turnover accepted without retakes.',
      actor_name: detail.client_name || 'Client Representative',
      actor_role: 'Client Representative',
      timestamp: now,
    });
  }
  if (detail.status === 'Rejected') {
    activities.push({
      id: `act-reject-${detail.id}`,
      delivery_id: detail.id,
      type: 'reject',
      title: 'Client Rejected Delivery',
      description: 'Delivery rejected with feedback.',
      actor_name: detail.client_name || 'Client Representative',
      actor_role: 'Client Representative',
      timestamp: now,
    });
  }
  return activities;
}

function buildHistory(detail: BackendDeliveryList): DeliveryHistorySnapshot[] {
  const history: DeliveryHistorySnapshot[] = [];
  let revision = 1;
  if (detail.created_at) {
    history.push({ id: `hist-${detail.id}-draft`, delivery_id: detail.id, revision: revision++, status: 'Draft', manifest_checksum: 'draft-manifest' });
  }
  const status = mapStatus(detail.status);
  history.push({
    id: `hist-${detail.id}-final`,
    delivery_id: detail.id,
    revision,
    status,
    submitted_at: detail.updated_at,
    client_action_at: detail.updated_at,
    verdict: status === 'Approved' ? 'Approved' : status === 'Rejected' ? 'Rejected' : undefined,
    manifest_checksum: 'verified-manifest',
  });
  return history;
}

function mapVersion(v: BackendDeliveryVersion): DeliveryVersionRef {
  return {
    id: v.id,
    entity_type: (v.entity_type === 'Asset' ? 'Asset' : 'Shot'),
    entity_code: v.entity_code,
    version_number: v.version_number,
    department: 'Compositing',
    artist_name: 'Alex Chen',
    resolution: '4K DCI',
    fps: 24,
    frame_range: '1-144',
    duration_frames: v.frame_count || 144,
    duration_tc: '00:00:06:00',
    file_format: 'EXR 16-bit float',
    thumbnail_url: THUMBNAIL_URL,
    file_size_formatted: formatBytes(v.file_size_bytes),
    file_size_bytes: v.file_size_bytes,
    checksum_sha256: v.checksum_sha256 || 'sha256-verified',
    color_space: 'ACEScg',
    status: v.is_validated ? 'Ready' : 'Validating',
  };
}

export function mapDeliveryDetail(detail: BackendDeliveryDetail): DeliveryPackage {
  const destination = FALLBACK_DESTINATIONS.find((d) => d.type.toLowerCase().includes((detail.delivery_method || '').toLowerCase()))
    || FALLBACK_DESTINATIONS[0];
  const allPassed = detail.status === 'Approved' || detail.status === 'Submitted';
  const versions = (detail.versions || []).map(mapVersion);
  return {
    id: detail.id,
    package_code: detail.code,
    title: detail.name,
    description: detail.notes || undefined,
    project_id: detail.project || '',
    project_code: detail.project_name || detail.code,
    project_name: detail.project_name || '',
    client: buildClient(detail.client_name),
    destination,
    due_date: detail.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
    milestone_name: detail.name,
    status: mapStatus(detail.status),
    versions,
    media_files: defaultMediaFiles(),
    validation_checks: defaultValidationChecks(),
    validation_score: allPassed ? 100 : 0,
    all_validations_passed: allPassed,
    total_size_bytes: detail.total_size_bytes,
    total_size_formatted: formatBytes(detail.total_size_bytes),
    total_shots_count: detail.version_count || versions.length || 1,
    total_frames_count: detail.total_frames,
    transfer_progress_percent: detail.status === 'Submitted' || detail.status === 'Approved' ? 100 : 0,
    submitted_at: detail.updated_at,
    submitted_by_name: 'Alex Chen',
    approved_at: detail.status === 'Approved' ? detail.updated_at : undefined,
    approved_by_name: detail.status === 'Approved' ? detail.client_name || undefined : undefined,
    rejection_reason: detail.status === 'Rejected' ? detail.client_notes || undefined : undefined,
    thumbnail_url: THUMBNAIL_URL,
    activity: buildActivity(detail),
    history: buildHistory(detail),
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };
}

export function mapDeliveryList(item: BackendDeliveryList): DeliveryPackage {
  const destination = FALLBACK_DESTINATIONS.find((d) => d.type.toLowerCase().includes((item.delivery_method || '').toLowerCase()))
    || FALLBACK_DESTINATIONS[0];
  const allPassed = item.status === 'Approved' || item.status === 'Submitted';
  const versionCount = item.version_count || 1;
  return {
    id: item.id,
    package_code: item.code,
    title: item.name,
    description: undefined,
    project_id: '',
    project_code: item.project_name || item.code,
    project_name: item.project_name || '',
    client: buildClient(item.client_name),
    destination,
    due_date: item.expires_at || new Date(Date.now() + 7 * 86400000).toISOString(),
    milestone_name: item.name,
    status: mapStatus(item.status),
    versions: [],
    media_files: [],
    validation_checks: defaultValidationChecks(),
    validation_score: allPassed ? 100 : 0,
    all_validations_passed: allPassed,
    total_size_bytes: item.total_size_bytes,
    total_size_formatted: formatBytes(item.total_size_bytes),
    total_shots_count: versionCount,
    total_frames_count: item.total_frames,
    transfer_progress_percent: item.status === 'Submitted' || item.status === 'Approved' ? 100 : 0,
    thumbnail_url: THUMBNAIL_URL,
    activity: buildActivity(item),
    history: buildHistory(item),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}
