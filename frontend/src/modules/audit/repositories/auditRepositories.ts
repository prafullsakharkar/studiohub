import { BaseRepository } from '@/core/repository/BaseRepository';
import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import {
  APIRequest,
  AuditLog,
  AuditTrack,
  BackgroundJob,
  ChangeLog,
  ErrorLog,
  LoginHistoryItem,
} from '@/types/audit';

// ---- ApiRequestRepository (interface + impl moved verbatim) ----
export type IApiRequestRepository = IBaseRepository<APIRequest, Partial<APIRequest>, Partial<APIRequest>>;

export class ApiRequestRepository
  extends BaseRepository<APIRequest, Partial<APIRequest>, Partial<APIRequest>>
  implements IApiRequestRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/api-requests', client);
  }
}

export const apiRequestRepository = new ApiRequestRepository();

// ---- AuditRepository (interface + impl moved verbatim) ----
export type IAuditRepository = IBaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>>;

export class AuditRepository
  extends BaseRepository<AuditLog, Partial<AuditLog>, Partial<AuditLog>>
  implements IAuditRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit', client);
  }
}

export const auditRepository = new AuditRepository();

// ---- AuditTrackRepository (interface + impl moved verbatim) ----
export type IAuditTrackRepository = IBaseRepository<AuditTrack, Partial<AuditTrack>, Partial<AuditTrack>>;

export class AuditTrackRepository
  extends BaseRepository<AuditTrack, Partial<AuditTrack>, Partial<AuditTrack>>
  implements IAuditTrackRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/tracks', client);
  }
}

export const auditTrackRepository = new AuditTrackRepository();

// ---- BackgroundJobRepository (interface + impl moved verbatim) ----
export interface IBackgroundJobRepository extends IBaseRepository<BackgroundJob, Partial<BackgroundJob>, Partial<BackgroundJob>> {
  retryJob(id: string): Promise<BackgroundJob>;
  cancelJob(id: string): Promise<BackgroundJob>;
}

export class BackgroundJobRepository
  extends BaseRepository<BackgroundJob, Partial<BackgroundJob>, Partial<BackgroundJob>>
  implements IBackgroundJobRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/background-jobs', client);
  }

  async retryJob(id: string): Promise<BackgroundJob> {
    return this.client.post<BackgroundJob>(`${this.basePath}${id}/retry/`);
  }

  async cancelJob(id: string): Promise<BackgroundJob> {
    return this.client.post<BackgroundJob>(`${this.basePath}${id}/cancel/`);
  }
}

export const backgroundJobRepository = new BackgroundJobRepository();

// ---- ChangeLogRepository (interface + impl moved verbatim) ----
export type IChangeLogRepository = IBaseRepository<ChangeLog, Partial<ChangeLog>, Partial<ChangeLog>>;

export class ChangeLogRepository
  extends BaseRepository<ChangeLog, Partial<ChangeLog>, Partial<ChangeLog>>
  implements IChangeLogRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/change-logs', client);
  }
}

export const changeLogRepository = new ChangeLogRepository();

// ---- ErrorLogRepository (interface + impl moved verbatim) ----
export interface IErrorLogRepository extends IBaseRepository<ErrorLog, Partial<ErrorLog>, Partial<ErrorLog>> {
  resolveError(id: string): Promise<ErrorLog>;
}

export class ErrorLogRepository
  extends BaseRepository<ErrorLog, Partial<ErrorLog>, Partial<ErrorLog>>
  implements IErrorLogRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/error-logs', client);
  }

  async resolveError(id: string): Promise<ErrorLog> {
    return this.client.post<ErrorLog>(`${this.basePath}${id}/resolve/`);
  }
}

export const errorLogRepository = new ErrorLogRepository();

// ---- LoginHistoryRepository (interface + impl moved verbatim) ----
export type ILoginHistoryRepository = IBaseRepository<LoginHistoryItem, Partial<LoginHistoryItem>, Partial<LoginHistoryItem>>;

export class LoginHistoryRepository
  extends BaseRepository<LoginHistoryItem, Partial<LoginHistoryItem>, Partial<LoginHistoryItem>>
  implements ILoginHistoryRepository
{
  constructor(client: IApiClient = apiClient) {
    super('/api/v1/audit/login-history', client);
  }
}

export const loginHistoryRepository = new LoginHistoryRepository();
