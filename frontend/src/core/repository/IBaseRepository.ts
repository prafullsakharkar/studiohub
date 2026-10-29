import type { IRepository } from '@/api/repositories/interfaces/IRepository';

/**
 * Canonical base repository interface lives in
 * `api/repositories/interfaces/IRepository.ts`.
 * This alias preserves the historical import path; do not extend it —
 * extend `IRepository` instead.
 */
export type IBaseRepository<T, TCreate = Partial<T>, TUpdate = Partial<T>> = IRepository<
  T,
  TCreate,
  TUpdate
>;
