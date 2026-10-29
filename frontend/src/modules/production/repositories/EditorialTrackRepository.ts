import { BaseRepository } from '@/core/repository/BaseRepository';
import { IEditorialTrackRepository } from './IEditorialTrackRepository';
import { EditorialTrack } from '@/types/production';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';

export class EditorialTrackRepository
  extends BaseRepository<EditorialTrack, Partial<EditorialTrack>, Partial<EditorialTrack>>
  implements IEditorialTrackRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/editorial/tracks', client);
  }
}

export const editorialTrackRepository = new EditorialTrackRepository();
