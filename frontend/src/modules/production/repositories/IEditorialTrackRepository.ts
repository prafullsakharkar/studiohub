import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { EditorialTrack } from '@/types/production';

export type IEditorialTrackRepository = IBaseRepository<EditorialTrack, Partial<EditorialTrack>, Partial<EditorialTrack>>;
