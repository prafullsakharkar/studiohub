import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Shot } from '@/mocks/db/production/shots';

export interface IShotRepository extends IBaseRepository<Shot, Partial<Shot>, Partial<Shot>> {
  approveShot(id: string): Promise<Shot>;
}
