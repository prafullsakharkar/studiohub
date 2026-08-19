import { IAssetRepository } from '../repositories/IAssetRepository';
import { assetRepository } from '../repositories/AssetRepository';
import { Asset } from '@/mocks/db/assets/assets';
import { PaginatedResponse, QueryParams } from '@/types/drf';

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
}

export const assetService = new AssetService();
