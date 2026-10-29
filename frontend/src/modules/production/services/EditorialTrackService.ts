import { IEditorialTrackRepository } from '../repositories/IEditorialTrackRepository';
import { editorialTrackRepository } from '../repositories/EditorialTrackRepository';
import { EditorialTrack } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';

export class EditorialTrackService {
  private repository: IEditorialTrackRepository;

  constructor(repository: IEditorialTrackRepository = editorialTrackRepository) {
    this.repository = repository;
  }

  async getTracks(params?: QueryParams): Promise<PaginatedResponse<EditorialTrack>> {
    return this.repository.findAll(params);
  }

  async getTrackById(id: string): Promise<EditorialTrack> {
    return this.repository.findById(id);
  }

  async createTrack(data: Partial<EditorialTrack>): Promise<EditorialTrack> {
    return this.repository.create(data);
  }

  async updateTrack(id: string, data: Partial<EditorialTrack>): Promise<EditorialTrack> {
    return this.repository.patch(id, data);
  }

  async deleteTrack(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}

export const editorialTrackService = new EditorialTrackService();
