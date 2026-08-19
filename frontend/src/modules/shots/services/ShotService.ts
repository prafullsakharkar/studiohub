import { IShotRepository } from '../repositories/IShotRepository';
import { shotRepository } from '../repositories/ShotRepository';
import { Shot } from '@/mocks/db/production/shots';
import { PaginatedResponse, QueryParams } from '@/types/drf';

export class ShotService {
  private repository: IShotRepository;

  constructor(repository: IShotRepository = shotRepository) {
    this.repository = repository;
  }

  async getShots(params?: QueryParams): Promise<PaginatedResponse<Shot>> {
    return this.repository.findAll(params);
  }

  async getShotById(id: string): Promise<Shot> {
    return this.repository.findById(id);
  }

  async createShot(data: Partial<Shot>): Promise<Shot> {
    return this.repository.create(data);
  }

  async updateShot(id: string, data: Partial<Shot>): Promise<Shot> {
    return this.repository.patch(id, data);
  }

  async approveShot(id: string): Promise<Shot> {
    return this.repository.approveShot(id);
  }
}

export const shotService = new ShotService();
