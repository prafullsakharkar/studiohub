import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Asset } from '@/types/assets';

export type IAssetRepository = IBaseRepository<Asset, Partial<Asset>, Partial<Asset>>;
