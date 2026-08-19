import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Asset } from '@/mocks/db/assets/assets';

export type IAssetRepository = IBaseRepository<Asset, Partial<Asset>, Partial<Asset>>;
