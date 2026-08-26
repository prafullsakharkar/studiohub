import { mockPublishItems, mockPublishDestinations } from '@/mocks/db/production/publishing';
import { PublishItem, PublishStatus, PublishDestination, PublishActivity } from '@/types/publishing';

class PublishingService {
  private items: PublishItem[] = [...mockPublishItems];

  async getPublishes(): Promise<PublishItem[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.items]), 100);
    });
  }

  async getPublishById(id: string): Promise<PublishItem | null> {
    const item = this.items.find((p) => p.id === id);
    return item ? { ...item } : null;
  }

  async getDestinations(): Promise<PublishDestination[]> {
    return [...mockPublishDestinations];
  }

  async createPublish(data: Partial<PublishItem>): Promise<PublishItem> {
    const now = new Date().toISOString();
    const newItem: PublishItem = {
      id: `pub-${Date.now()}`,
      publish_code: data.publish_code || `PUB-${data.project_code || 'NK99'}-${Date.now().toString().slice(-4)}`,
      project_id: data.project_id || 'proj-001',
      project_code: data.project_code || 'NK99',
      project_name: data.project_name || 'Neo Kyoto 2099',
      entity_type: data.entity_type || 'Shot',
      entity_id: data.entity_id || 'shot-101',
      entity_code: data.entity_code || 'SH010',
      entity_name: data.entity_name || 'Shot 010',
      task_id: data.task_id,
      task_name: data.task_name,
      version_id: data.version_id || 'ver-new',
      version_number: data.version_number || 'v001',
      artist_id: data.artist_id || 'usr-001',
      artist_name: data.artist_name || 'Alex Chen',
      artist_avatar: data.artist_avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      department: data.department || 'Compositing',
      destination: data.destination || mockPublishDestinations[0],
      status: 'Queued',
      dcc_software: data.dcc_software || 'Nuke',
      dcc_version: data.dcc_version || '15.0v2',
      dcc_file_path: data.dcc_file_path || '',
      output_path: data.output_path || '/mnt/storage/vfx_prod/publishes',
      frame_range: data.frame_range || '1001-1100',
      total_frames: data.total_frames || 100,
      fps: data.fps || 24,
      resolution: data.resolution || '4096x2160',
      file_count: data.file_count || 100,
      total_size_bytes: data.total_size_bytes || 2147483648,
      total_size_formatted: data.total_size_formatted || '2.00 GB',
      checksum_sha256: 'a9f83a48e89fbc71c35b443328e9321c81ef4081c72019b88231c5fe8b417c802',
      color_space: data.color_space || 'ACEScg (AP1 / Linear)',
      validation_passed: true,
      republish_count: 0,
      thumbnail_url: data.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
      comment: data.comment || 'Published via StudioHub pipeline manager',
      created_at: now,
      updated_at: now,
      published_at: now,
      validation_rules: [
        {
          id: `val-${Date.now()}-1`,
          name: 'Frame Sequence Continuity',
          category: 'Frame Range',
          status: 'passed',
          message: 'All rendered frames verified without missing frame gaps.',
        },
        {
          id: `val-${Date.now()}-2`,
          name: 'ACEScg Chromaticities Check',
          category: 'Color & ACES',
          status: 'passed',
          message: 'Color space AP1 linear primaries confirmed.',
        },
        {
          id: `val-${Date.now()}-3`,
          name: 'Studio Naming Specification',
          category: 'Naming',
          status: 'passed',
          message: 'Asset code and version pattern validated.',
        },
      ],
      activity: [
        {
          id: `act-${Date.now()}`,
          publish_id: `pub-${Date.now()}`,
          type: 'publish',
          title: 'Published Item',
          description: `Published ${data.version_number || 'v001'} to ${data.destination?.name || 'Primary Storage'}.`,
          user_name: data.artist_name || 'Alex Chen',
          user_avatar: data.artist_avatar,
          user_role: 'Artist',
          timestamp: now,
        },
      ],
      history: [
        {
          id: `hist-${Date.now()}`,
          publish_id: `pub-${Date.now()}`,
          revision_number: 1,
          version_number: data.version_number || 'v001',
          status: 'Published',
          dcc_software: data.dcc_software || 'Nuke',
          output_path: data.output_path || '/mnt/storage/vfx_prod/publishes',
          artist_name: data.artist_name || 'Alex Chen',
          published_at: now,
          change_reason: data.comment || 'Initial publish',
          checksum_sha256: 'a9f83a48e89fbc71c35b443328e9321c81ef4081c72019b88231c5fe8b417c802',
        },
      ],
    };

    this.items = [newItem, ...this.items];
    return newItem;
  }

  async validatePublish(id: string): Promise<PublishItem> {
    const item = await this.getPublishById(id);
    if (!item) throw new Error('Publish item not found');

    const updated: PublishItem = {
      ...item,
      status: 'Published',
      validation_passed: true,
      error_message: undefined,
      validation_rules: item.validation_rules.map((r) => ({
        ...r,
        status: 'passed',
        message: 'Verified successfully during pre-flight re-inspection.',
      })),
      activity: [
        {
          id: `act-${Date.now()}`,
          publish_id: id,
          type: 'validate',
          title: 'Pre-flight QC Validated',
          description: 'All pre-flight rules successfully re-evaluated with 0 errors.',
          user_name: 'StudioHub Pipeline Engine',
          user_role: 'Automated QC',
          timestamp: new Date().toISOString(),
        },
        ...item.activity,
      ],
      updated_at: new Date().toISOString(),
    };

    this.items = this.items.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  async republish(id: string, comment: string, artistName: string): Promise<PublishItem> {
    const item = await this.getPublishById(id);
    if (!item) throw new Error('Publish item not found');

    const now = new Date().toISOString();
    const newVersionNum = `v${(parseInt(item.version_number.replace(/\D/g, '') || '1') + 1)
      .toString()
      .padStart(3, '0')}`;

    const newSnapshot = {
      id: `hist-${Date.now()}`,
      publish_id: id,
      revision_number: item.history.length + 1,
      version_number: newVersionNum,
      status: 'Published' as PublishStatus,
      dcc_software: item.dcc_software,
      output_path: item.output_path.replace(item.version_number, newVersionNum),
      artist_name: artistName,
      published_at: now,
      change_reason: comment || 'Republish iteration update',
      checksum_sha256: `sha256-${Date.now().toString(16)}`,
    };

    const updated: PublishItem = {
      ...item,
      version_number: newVersionNum,
      status: 'Published',
      republish_count: item.republish_count + 1,
      comment,
      published_at: now,
      error_message: undefined,
      validation_passed: true,
      history: [newSnapshot, ...item.history],
      activity: [
        {
          id: `act-${Date.now()}`,
          publish_id: id,
          type: 'republish',
          title: `Republished to ${newVersionNum}`,
          description: comment || 'Iterated version publish.',
          user_name: artistName,
          timestamp: now,
        },
        ...item.activity,
      ],
      updated_at: now,
    };

    this.items = this.items.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  async unpublish(id: string, reason: string, userName: string): Promise<PublishItem> {
    const item = await this.getPublishById(id);
    if (!item) throw new Error('Publish item not found');

    const now = new Date().toISOString();
    const updated: PublishItem = {
      ...item,
      status: 'Unpublished',
      activity: [
        {
          id: `act-${Date.now()}`,
          publish_id: id,
          type: 'unpublish',
          title: 'Unpublished & Deprecated',
          description: reason || 'Version marked unpublished and removed from active pipeline links.',
          user_name: userName,
          timestamp: now,
        },
        ...item.activity,
      ],
      updated_at: now,
    };

    this.items = this.items.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  async retryPublish(id: string): Promise<PublishItem> {
    const item = await this.getPublishById(id);
    if (!item) throw new Error('Publish item not found');

    const now = new Date().toISOString();
    const updated: PublishItem = {
      ...item,
      status: 'Published',
      validation_passed: true,
      error_message: undefined,
      validation_rules: item.validation_rules.map((r) => ({
        ...r,
        status: 'passed',
        message: 'Fixed and verified on retry.',
      })),
      activity: [
        {
          id: `act-${Date.now()}`,
          publish_id: id,
          type: 'retry',
          title: 'Retry Successful',
          description: 'Re-triggered export and cache verification completed successfully.',
          user_name: 'StudioHub Pipeline Engine',
          timestamp: now,
        },
        ...item.activity,
      ],
      updated_at: now,
    };

    this.items = this.items.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  async deletePublish(id: string): Promise<void> {
    this.items = this.items.filter((p) => p.id !== id);
  }
}

export const publishingService = new PublishingService();
