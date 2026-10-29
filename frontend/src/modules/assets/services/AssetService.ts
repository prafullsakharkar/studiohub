import { IAssetRepository, assetRepository } from '@/api/repositories';
import { PaginatedResponse, QueryParams } from '@/types/common';
import type { Asset, BulkArchiveRestoreRequest, BulkCreateRequest, BulkOperationResponse, BulkUpdateRequest, CheckExistencePayload, CheckExistenceResponse } from '@/types/production';

export class AssetService {
  private repository: IAssetRepository;

  constructor(repository: IAssetRepository = assetRepository) {
    this.repository = repository;
  }

  async getAssets(params?: QueryParams): Promise<PaginatedResponse<Asset>> {
    return this.repository.findAll(params);
  }

  async getAssetById(id: string): Promise<Asset> {
    return this.repository.findById(id);
  }

  async createAsset(data: Partial<Asset>): Promise<Asset> {
    return this.repository.create(data);
  }

  async updateAsset(id: string, data: Partial<Asset>): Promise<Asset> {
    return this.repository.patch(id, data);
  }

  async deleteAsset(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Asset>> {
    return this.repository.checkExistence(payload);
  }

  async bulkCreate(payload: BulkCreateRequest<Asset>): Promise<BulkOperationResponse<Asset>> {
    return this.repository.bulkCreate(payload);
  }

  async bulkUpdate(payload: BulkUpdateRequest<Asset>): Promise<BulkOperationResponse<Asset>> {
    return this.repository.bulkUpdate(payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkArchive(payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkRestore(payload);
  }

  async archiveAsset(id: string): Promise<Asset> {
    return this.repository.archiveAsset(id);
  }

  async restoreAsset(id: string): Promise<Asset> {
    return this.repository.restoreAsset(id);
  }
}

export const assetService = new AssetService();
