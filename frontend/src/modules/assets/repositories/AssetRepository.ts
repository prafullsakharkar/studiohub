import { BaseRepository } from '@/core/repository/BaseRepository';
import { IAssetRepository } from './IAssetRepository';
import { Asset } from '@/mocks/db/assets/assets';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class AssetRepository
  extends BaseRepository<Asset, Partial<Asset>, Partial<Asset>>
  implements IAssetRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/assets', client);
  }
}

export const assetRepository = new AssetRepository();
