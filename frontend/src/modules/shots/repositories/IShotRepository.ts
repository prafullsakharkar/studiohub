import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Shot } from '@/types/shots';

export interface IShotRepository extends IBaseRepository<Shot, Partial<Shot>, Partial<Shot>> {
  approveShot(id: string): Promise<Shot>;
}
