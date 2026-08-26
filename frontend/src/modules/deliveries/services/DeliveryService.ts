import { mockDeliveries, mockDeliveryDestinations } from '@/mocks/db/production/deliveries';
import {
  DeliveryPackage,
  DeliveryStatus,
  DeliveryDestination,
  DeliveryVersionRef,
  DeliveryMediaFile,
} from '@/types/deliveries';

class DeliveryService {
  private deliveries: DeliveryPackage[] = [...mockDeliveries];

  async getDeliveries(): Promise<DeliveryPackage[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve([...this.deliveries]), 100);
    });
  }

  async getDeliveryById(id: string): Promise<DeliveryPackage | null> {
    const delivery = this.deliveries.find((d) => d.id === id);
    return delivery ? { ...delivery } : null;
  }

  async getDestinations(): Promise<DeliveryDestination[]> {
    return [...mockDeliveryDestinations];
  }

  async createDelivery(data: Partial<DeliveryPackage>): Promise<DeliveryPackage> {
    const now = new Date().toISOString();
    const newDelivery: DeliveryPackage = {
      id: `del-${Date.now()}`,
      package_code: data.package_code || `DEL-${data.project_code || 'NK99'}-${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7)}`,
      title: data.title || 'Untitled Studio Turnover Delivery',
      description: data.description || 'Turnover package prepared for client review and archival.',
      project_id: data.project_id || 'proj-001',
      project_code: data.project_code || 'NK99',
      project_name: data.project_name || 'Neo Kyoto 2099',
      client: data.client || {
        id: 'cli-001',
        code: 'WARNER-MEDIA',
        name: 'Warner Bros. Discovery & Media',
        representative_name: 'Michael Sterling',
        contact_email: 'm.sterling@warnerbros.com',
        auto_notify: true,
      },
      vendor: data.vendor,
      destination: data.destination || mockDeliveryDestinations[0],
      due_date: data.due_date || new Date(Date.now() + 7 * 86400000).toISOString(),
      milestone_name: data.milestone_name || 'Scheduled Picture Lock Turnover',
      status: 'Draft',
      versions: data.versions || [],
      media_files: data.media_files || [],
      validation_checks: [
        {
          id: `qc-${Date.now()}-1`,
          title: 'Resolution & Pixel Aspect Ratio (4K DCI 4096x2160)',
          category: 'Resolution & Aspect Ratio',
          status: 'passed',
          details: 'Verified against client delivery specification sheet.',
          severity: 'blocking',
        },
        {
          id: `qc-${Date.now()}-2`,
          title: 'Frame Drops & Continuity Verification',
          category: 'Frame Drops & Continuity',
          status: 'passed',
          details: 'Continuous sequential EXR timecode check passed.',
          severity: 'blocking',
        },
        {
          id: `qc-${Date.now()}-3`,
          title: 'ACEScg & CDL Compliance',
          category: 'ACEScg & CDL Compliance',
          status: 'passed',
          details: 'AP1 chromaticities and linear flags confirmed.',
          severity: 'blocking',
        },
        {
          id: `qc-${Date.now()}-4`,
          title: 'Slate & Burn-In Head Frame Check',
          category: 'Slate & Burn-In Metadata',
          status: 'passed',
          details: 'Metadata slates verified.',
          severity: 'warning',
        },
        {
          id: `qc-${Date.now()}-5`,
          title: 'Cryptographic SHA-256 Manifest Checksum Matching',
          category: 'SHA-256 Checksums',
          status: 'passed',
          details: 'All files cryptographically hashed.',
          severity: 'blocking',
        },
      ],
      validation_score: 100,
      all_validations_passed: true,
      total_size_bytes: data.total_size_bytes || 4294967296,
      total_size_formatted: data.total_size_formatted || '4.00 GB',
      total_shots_count: data.versions?.length || 1,
      total_frames_count: 144,
      thumbnail_url: data.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
      created_at: now,
      updated_at: now,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: `del-${Date.now()}`,
          type: 'create',
          title: 'Delivery Package Initialized',
          description: `Created delivery package ${data.title}`,
          actor_name: 'Alex Chen',
          actor_role: 'VFX Supervisor',
          timestamp: now,
        },
      ],
      history: [
        {
          id: `hist-${Date.now()}`,
          delivery_id: `del-${Date.now()}`,
          revision: 1,
          status: 'Draft',
          manifest_checksum: 'init-manifest-checksum',
        },
      ],
    };

    this.deliveries = [newDelivery, ...this.deliveries];
    return newDelivery;
  }

  async prepareDelivery(id: string, actorName: string = 'Alex Chen'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Ready',
      transfer_progress_percent: 0,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'prepare',
          title: 'Package Prepared & Staged',
          description: 'Generated XML delivery manifest and generated SHA-256 payload checksums.',
          actor_name: actorName,
          actor_role: 'VFX Supervisor',
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async validateDelivery(id: string, actorName: string = 'Pipeline QC Engine'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Ready',
      validation_score: 100,
      all_validations_passed: true,
      validation_checks: delivery.validation_checks.map((qc) => ({
        ...qc,
        status: 'passed',
        checked_at: now,
      })),
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'validate',
          title: 'Automated QC Validation Passed (100%)',
          description: 'All pre-flight rules and file checksums verified successfully.',
          actor_name: actorName,
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async submitDelivery(id: string, actorName: string = 'Alex Chen'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Submitted',
      submitted_at: now,
      submitted_by_name: actorName,
      transfer_progress_percent: 100,
      estimated_completion_time: 'Completed',
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'submit',
          title: 'Dispatched to Client Destination',
          description: `Transferred payload via ${delivery.destination.type} to ${delivery.client.name}.`,
          actor_name: actorName,
          timestamp: now,
        },
        ...delivery.activity,
      ],
      history: [
        {
          id: `hist-${Date.now()}`,
          delivery_id: id,
          revision: delivery.history.length + 1,
          status: 'Submitted',
          submitted_at: now,
          manifest_checksum: 'sha256-sub-verified',
        },
        ...delivery.history,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async approveDelivery(id: string, actorName: string = 'Michael Sterling', notes?: string): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Approved',
      approved_at: now,
      approved_by_name: actorName,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'approve',
          title: 'Client Approved Delivery',
          description: notes || 'Delivery turnover accepted without retakes.',
          actor_name: actorName,
          actor_role: 'Client Representative',
          timestamp: now,
        },
        ...delivery.activity,
      ],
      history: [
        {
          id: `hist-${Date.now()}`,
          delivery_id: id,
          revision: delivery.history.length + 1,
          status: 'Approved',
          client_action_at: now,
          verdict: 'Approved',
          notes,
          manifest_checksum: 'approved-manifest',
        },
        ...delivery.history,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async rejectDelivery(id: string, reason: string, notes: string, actorName: string = 'Michael Sterling'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Rejected',
      rejection_reason: reason,
      rejection_notes: notes,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'reject',
          title: 'Client Rejected Delivery',
          description: `Reason: ${reason}. Notes: ${notes}`,
          actor_name: actorName,
          actor_role: 'Client Representative',
          timestamp: now,
        },
        ...delivery.activity,
      ],
      history: [
        {
          id: `hist-${Date.now()}`,
          delivery_id: id,
          revision: delivery.history.length + 1,
          status: 'Rejected',
          client_action_at: now,
          verdict: 'Rejected',
          notes: `${reason} - ${notes}`,
          manifest_checksum: 'rejected-manifest',
        },
        ...delivery.history,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async retryDelivery(id: string, actorName: string = 'Alex Chen'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Preparing',
      rejection_reason: undefined,
      rejection_notes: undefined,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'retry',
          title: 'Delivery Repackaging Initiated',
          description: 'Re-preparing package with updated versions and refreshed QC.',
          actor_name: actorName,
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async completeDelivery(id: string, actorName: string = 'Alex Chen'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Completed',
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'complete',
          title: 'Delivery Completed & Archived',
          description: 'Turnover cycle marked officially complete and archived to long-term storage.',
          actor_name: actorName,
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async cancelDelivery(id: string, reason: string, actorName: string = 'Alex Chen'): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const updated: DeliveryPackage = {
      ...delivery,
      status: 'Cancelled',
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'cancel',
          title: 'Delivery Cancelled',
          description: reason || 'Turnover package cancelled by production supervisor.',
          actor_name: actorName,
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async addVersionToDelivery(id: string, version: DeliveryVersionRef): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const newVersions = [...delivery.versions, version];
    const totalBytes = newVersions.reduce((acc, v) => acc + (v.file_size_bytes || 0), 0);
    const totalFrames = newVersions.reduce((acc, v) => acc + (v.duration_frames || 0), 0);

    const updated: DeliveryPackage = {
      ...delivery,
      versions: newVersions,
      total_shots_count: newVersions.length,
      total_size_bytes: totalBytes,
      total_size_formatted: `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      total_frames_count: totalFrames,
      activity: [
        {
          id: `act-${Date.now()}`,
          delivery_id: id,
          type: 'media_added',
          title: `Added Version ${version.entity_code} ${version.version_number}`,
          description: `Added ${version.file_format} (${version.file_size_formatted}) to payload.`,
          actor_name: 'Alex Chen',
          timestamp: now,
        },
        ...delivery.activity,
      ],
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }

  async removeVersionFromDelivery(id: string, versionId: string): Promise<DeliveryPackage> {
    const delivery = await this.getDeliveryById(id);
    if (!delivery) throw new Error('Delivery not found');

    const now = new Date().toISOString();
    const newVersions = delivery.versions.filter((v) => v.id !== versionId);
    const totalBytes = newVersions.reduce((acc, v) => acc + (v.file_size_bytes || 0), 0);
    const totalFrames = newVersions.reduce((acc, v) => acc + (v.duration_frames || 0), 0);

    const updated: DeliveryPackage = {
      ...delivery,
      versions: newVersions,
      total_shots_count: newVersions.length,
      total_size_bytes: totalBytes,
      total_size_formatted: `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      total_frames_count: totalFrames,
      updated_at: now,
    };

    this.deliveries = this.deliveries.map((d) => (d.id === id ? updated : d));
    return updated;
  }
}

export const deliveryService = new DeliveryService();
