import { BaseRESTAdapter } from './BaseRESTAdapter';
import { IPublishingRepository } from '../../interfaces/IPublishingRepository';
import { PublishItem, PublishDestination } from '@/types/production';

/**
 * Map a backend publish payload (flat read shape, status words already mapped
 * server-side) onto the PublishItem contract the UI consumes. Raw fields are
 * preserved; contract aliases are added so mock and rest modes render alike.
 */
function normalizePublish(raw: Record<string, any>): PublishItem {
  return {
    ...raw,
    id: String(raw.id),
    publish_code: String(raw.code || raw.publish_code || ''),
    project_id: raw.project ? String(raw.project) : raw.project_id,
    project_name: raw.project_name,
    entity_type: raw.entity_type,
    entity_code: raw.entity_code,
    entity_name: raw.entity_name,
    dcc_software: raw.dcc_tool || raw.dcc_software,
    dcc_version: raw.dcc_version,
    output_path: raw.export_path || raw.output_path,
    republish_count: Number(raw.retry_count ?? raw.republish_count ?? 0),
    validation_rules: Array.isArray(raw.validation_rules) ? raw.validation_rules : [],
    activity: Array.isArray(raw.activity) ? raw.activity : [],
  } as unknown as PublishItem;
}

export class RESTPublishingAdapter
  extends BaseRESTAdapter<PublishItem, Partial<PublishItem>, Partial<PublishItem>>
  implements IPublishingRepository
{
  constructor() {
    super('/api/v1/publishing');
  }

  override async findAll(params?: import('@/types/common').QueryParams): Promise<import('@/types/common').PaginatedResponse<PublishItem>> {
    const res = await super.findAll(params);
    const results = (Array.isArray(res) ? res : res?.results ?? []).map(normalizePublish);
    return Array.isArray(res) ? (results as any) : { ...res, results };
  }

  override async findById(id: string): Promise<PublishItem> {
    const raw = (await super.findById(id)) as unknown as Record<string, any>;
    return normalizePublish(raw);
  }

  override async create(data: Partial<PublishItem>): Promise<PublishItem> {
    // The create form speaks the mock-flavored contract (publish_code,
    // project_code, nested destination, mock ids); the backend create
    // serializer wants flat backend fields. Map here so both modes share
    // one caller. NOTE: backend dcc_tool choices lack Unreal/USD — those
    // pass through and 400 honestly (backend gap, not masked here).
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const asUuidOrUndefined = (v: unknown) =>
      typeof v === 'string' && UUID_RE.test(v) ? v : undefined;
    const now = new Date();
    const generatedCode =
      `PUB-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
    const payload: Record<string, any> = {
      name: data.entity_name || data.comment || 'Untitled Publish',
      code: data.publish_code || generatedCode,
      project_id: asUuidOrUndefined(data.project_id),
      entity_type: data.entity_type === 'Asset' ? 'Asset' : 'Shot',
      entity_id: data.entity_id || data.entity_code || 'unknown',
      entity_code: data.entity_code || 'unknown',
      entity_name: data.entity_name || 'Untitled',
      dcc_tool: data.dcc_software || 'Nuke',
      dcc_version: (data as any).dcc_version || undefined,
      export_path: data.output_path || undefined,
    };
    const raw = await this.request<Record<string, any>>(this.basePath, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalizePublish(raw);
  }

  private async postAction(id: string, action: string, body?: unknown): Promise<PublishItem> {
    const cleanId = encodeURIComponent(id.trim());
    const raw = await this.request<Record<string, any>>(`${this.basePath}${cleanId}/${action}/`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return normalizePublish(raw);
  }

  async validatePublish(id: string): Promise<PublishItem> {
    return this.postAction(id, 'validate');
  }

  async republish(id: string, comment?: string, artistName?: string): Promise<PublishItem> {
    return this.postAction(id, 'republish', { comment, artist_name: artistName });
  }

  async unpublish(id: string, reason?: string, userName?: string): Promise<PublishItem> {
    return this.postAction(id, 'unpublish', { reason, user_name: userName });
  }

  async retryPublish(id: string): Promise<PublishItem> {
    return this.postAction(id, 'retry');
  }

  async getDestinations(): Promise<PublishDestination[]> {
    // The backend paginates destinations; unwrap the DRF envelope so both
    // modes resolve to a plain array (mock adapter already returns one).
    const res = await this.request<PublishDestination[] | { results?: PublishDestination[] }>(
      `${this.basePath}destinations/`,
      { method: 'GET' }
    );
    return Array.isArray(res) ? res : (res?.results ?? []);
  }

  async createDestination(data: Partial<PublishDestination>): Promise<PublishDestination> {
    return this.request<PublishDestination>(`${this.basePath}destinations/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDestinationById(id: string): Promise<PublishDestination | null> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<PublishDestination>(`${this.basePath}destinations/${cleanId}/`, {
      method: 'GET',
    });
  }

  async updateDestination(id: string, data: Partial<PublishDestination>): Promise<PublishDestination> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<PublishDestination>(`${this.basePath}destinations/${cleanId}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteDestination(id: string): Promise<void> {
    const cleanId = encodeURIComponent(id.trim());
    await this.request<void>(`${this.basePath}destinations/${cleanId}/`, {
      method: 'DELETE',
    });
  }
}
