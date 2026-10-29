import { BaseRESTAdapter } from './BaseRESTAdapter';
import { IDeliveryRepository } from '../../interfaces/IDeliveryRepository';
import {
  DeliveryPackage,
  DeliveryDestination,
  DeliveryDestinationType,
  DeliveryStatus,
} from '@/types/production';

/**
 * Map a backend delivery list payload (flat read shape) onto the rich
 * DeliveryPackage contract the UI consumes. The backend list serializer
 * returns flattened scalar fields (name/code/client_name/project_name), while
 * the frontend contract nests client/destination and adds display fields.
 */
function normalizeDelivery(raw: Record<string, any>): DeliveryPackage {
  const code = String(raw.code || '');
  const name = String(raw.name || '');
  const clientName = String(raw.client_name || '—');
  const projectName = String(raw.project_name || '');
  const deliveryMethod = String(raw.delivery_method || '');

  const destinationType: DeliveryDestinationType =
    deliveryMethod === 'Aspera'
      ? 'Aspera Connect'
      : deliveryMethod === 'S3'
        ? 'AWS S3 Bucket'
        : deliveryMethod === 'FTP'
          ? 'Client SFTP'
          : 'Frame.io Enterprise';

  const totalSizeBytes = Number(raw.total_size_bytes || 0);
  const versions = Array.isArray(raw.versions)
    ? raw.versions.map((v: Record<string, any>) => ({
        id: String(v.id ?? v.version_id ?? ''),
        version_id: v.version_id ? String(v.version_id) : undefined,
        version_number: v.version_number,
        entity_type: v.entity_type,
        entity_code: v.entity_code,
        entity_name: v.entity_name,
        file_size_bytes: Number(v.file_size_bytes || 0),
        duration_frames: Number(v.frame_count || 0),
        file_path: v.file_path,
        checksum_sha256: v.checksum_sha256,
        status: v.is_validated ? 'passed' : 'pending',
      }))
    : [];

  return {
    id: String(raw.id),
    package_code: code,
    title: name,
    description: projectName,
    project_id: raw.project ? String(raw.project) : '',
    project_code: '',
    project_name: projectName,
    client: {
      id: '',
      code: '',
      name: clientName,
      representative_name: '',
      contact_email: '',
    },
    destination: {
      id: '',
      name: deliveryMethod,
      type: destinationType,
      endpoint: '',
      credentials_configured: false,
    },
    due_date: raw.expires_at || raw.created_at || new Date().toISOString(),
    milestone_name: '',
    status: (raw.status || 'Draft') as DeliveryStatus,
    versions,
    media_files: [],
    validation_checks: [],
    validation_score: 0,
    all_validations_passed: false,
    total_size_bytes: totalSizeBytes,
    total_size_formatted: formatBytes(totalSizeBytes),
    total_shots_count: Number(raw.version_count || 0),
    total_frames_count: Number(raw.total_frames || 0),
    is_deleted: Boolean(raw.is_archived),
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    activity: [],
    history: [],
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

export class RESTDeliveryAdapter
  extends BaseRESTAdapter<DeliveryPackage, Partial<DeliveryPackage>, Partial<DeliveryPackage>>
  implements IDeliveryRepository
{
  constructor() {
    super('/api/v1/deliveries');
  }

  override async findAll(params?: import('@/types/common').QueryParams): Promise<import('@/types/common').PaginatedResponse<DeliveryPackage>> {
    const res = await super.findAll(params);
    const results = (Array.isArray(res) ? res : res?.results ?? []).map(normalizeDelivery);
    return Array.isArray(res) ? (results as any) : { ...res, results };
  }

  override async findById(id: string): Promise<DeliveryPackage> {
    const raw = (await super.findById(id)) as unknown as Record<string, any>;
    return normalizeDelivery(raw);
  }

  override async create(data: Partial<DeliveryPackage>): Promise<DeliveryPackage> {
    // The create form speaks the mock-flavored contract (title, nested
    // client/destination objects, mock ids); the backend create serializer
    // wants flat backend fields. Map here so both modes share one caller.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const asUuidOrUndefined = (v: unknown) =>
      typeof v === 'string' && UUID_RE.test(v) ? v : undefined;
    const destType = String((data.destination as any)?.type || '');
    const deliveryMethod =
      destType.includes('Aspera') ? 'Aspera'
      : destType.includes('S3') ? 'S3'
      : destType.includes('SFTP') || destType.includes('FTP') ? 'FTP'
      : 'S3';
    const now = new Date();
    const generatedCode =
      `DEL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const payload: Record<string, any> = {
      name: data.title || 'Untitled Delivery',
      code: data.package_code || generatedCode,
      project_id: asUuidOrUndefined(data.project_id),
      client_id: asUuidOrUndefined((data.client as any)?.id),
      delivery_method: deliveryMethod,
      delivery_destination:
        (data.destination as any)?.target_directory || (data.destination as any)?.endpoint || undefined,
      expires_at: data.due_date || undefined,
      notes: data.description || undefined,
    };
    const raw = await this.request<Record<string, any>>(this.basePath, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizeDelivery(raw);
  }

  override async update(id: string, data: Partial<DeliveryPackage>): Promise<DeliveryPackage> {
    const raw = (await super.update(id, data)) as unknown as Record<string, any>;
    return normalizeDelivery(raw);
  }

  private async postAction(id: string, action: string, body?: unknown): Promise<DeliveryPackage> {
    const cleanId = encodeURIComponent(id.trim());
    const raw = await this.request<Record<string, any>>(`${this.basePath}${cleanId}/${action}/`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return normalizeDelivery(raw);
  }

  async submitDelivery(id: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'submit');
  }

  async prepareDelivery(id: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'prepare');
  }

  async approveDelivery(id: string, notes?: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'approve', { notes });
  }

  async rejectDelivery(id: string, reason?: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'reject', { reason });
  }

  async completeDelivery(id: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'complete');
  }

  async cancelDelivery(id: string, reason?: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'cancel', { reason });
  }

  async retryDelivery(id: string): Promise<DeliveryPackage> {
    return this.postAction(id, 'retry');
  }

  async validateDelivery(id: string): Promise<{ checks: any[]; passed: boolean; message: string }> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<{ checks: any[]; passed: boolean; message: string }>(`${this.basePath}${cleanId}/validate/`, {
      method: 'POST',
    });
  }

  async addVersion(id: string, versionData: any): Promise<DeliveryPackage> {
    const cleanId = encodeURIComponent(id.trim());
    const raw = await this.request<Record<string, any>>(`${this.basePath}${cleanId}/add-version/`, {
      method: 'POST',
      body: JSON.stringify(versionData),
    });
    return normalizeDelivery(raw);
  }

  async removeVersion(id: string, versionRefId: string): Promise<DeliveryPackage> {
    const cleanId = encodeURIComponent(id.trim());
    const raw = await this.request<Record<string, any>>(`${this.basePath}${cleanId}/remove-version/`, {
      method: 'POST',
      body: JSON.stringify({ version_ref_id: versionRefId }),
    });
    return normalizeDelivery(raw);
  }

  async getDestinations(): Promise<DeliveryDestination[]> {
    // The backend paginates destinations; unwrap the DRF envelope so both
    // modes resolve to a plain array (mock adapter already returns one).
    const res = await this.request<DeliveryDestination[] | { results?: DeliveryDestination[] }>(
      `${this.basePath}destinations/`,
      { method: 'GET' }
    );
    return Array.isArray(res) ? res : (res?.results ?? []);
  }

  async createDestination(data: Partial<DeliveryDestination>): Promise<DeliveryDestination> {
    return this.request<DeliveryDestination>(`${this.basePath}destinations/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}
