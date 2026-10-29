import {
  APIRequest,
  AuditLog,
  AuditTrack,
  BackgroundJob,
  ChangeLog,
  ErrorLog,
  LoginHistoryItem,
} from '@/types/audit';
import { PaginatedResponse, QueryParams } from '@/types/common';
import {
  IApiRequestRepository,
  apiRequestRepository,
  IAuditRepository,
  auditRepository,
  IAuditTrackRepository,
  auditTrackRepository,
  IBackgroundJobRepository,
  backgroundJobRepository,
  IChangeLogRepository,
  changeLogRepository,
  IErrorLogRepository,
  errorLogRepository,
  ILoginHistoryRepository,
  loginHistoryRepository,
} from '../repositories/auditRepositories';

// ---- ApiRequestService (moved verbatim) ----
export class ApiRequestService {
  private repository: IApiRequestRepository;

  constructor(repository: IApiRequestRepository = apiRequestRepository) {
    this.repository = repository;
  }

  async getApiRequests(params?: QueryParams): Promise<PaginatedResponse<APIRequest>> {
    return this.repository.findAll(params);
  }

  async getApiRequestById(id: string): Promise<APIRequest> {
    return this.repository.findById(id);
  }

  async logApiRequest(data: Partial<APIRequest>): Promise<APIRequest> {
    return this.repository.create(data);
  }
}

export const apiRequestService = new ApiRequestService();

// ---- AuditService (moved verbatim) ----
export class AuditService {
  private repository: IAuditRepository;

  constructor(repository: IAuditRepository = auditRepository) {
    this.repository = repository;
  }

  async getAuditLogs(params?: QueryParams): Promise<PaginatedResponse<AuditLog>> {
    return this.repository.findAll(params);
  }

  async recordLog(data: Partial<AuditLog>): Promise<AuditLog> {
    return this.repository.create(data);
  }
}

export const auditService = new AuditService();

// ---- AuditTrackService (moved verbatim) ----
export class AuditTrackService {
  private repository: IAuditTrackRepository;

  constructor(repository: IAuditTrackRepository = auditTrackRepository) {
    this.repository = repository;
  }

  async getTracks(params?: QueryParams): Promise<PaginatedResponse<AuditTrack>> {
    return this.repository.findAll(params);
  }

  async getTrackById(id: string): Promise<AuditTrack> {
    return this.repository.findById(id);
  }

  async trackEvent(data: Partial<AuditTrack>): Promise<AuditTrack> {
    return this.repository.create(data);
  }
}

export const auditTrackService = new AuditTrackService();

// ---- BackgroundJobService (moved verbatim) ----
export class BackgroundJobService {
  private repository: IBackgroundJobRepository;

  constructor(repository: IBackgroundJobRepository = backgroundJobRepository) {
    this.repository = repository;
  }

  async getBackgroundJobs(params?: QueryParams): Promise<PaginatedResponse<BackgroundJob>> {
    return this.repository.findAll(params);
  }

  async getJobById(id: string): Promise<BackgroundJob> {
    return this.repository.findById(id);
  }

  async retryJob(id: string): Promise<BackgroundJob> {
    return this.repository.retryJob(id);
  }

  async cancelJob(id: string): Promise<BackgroundJob> {
    return this.repository.cancelJob(id);
  }

  async createJob(data: Partial<BackgroundJob>): Promise<BackgroundJob> {
    return this.repository.create(data);
  }
}

export const backgroundJobService = new BackgroundJobService();

// ---- ChangeLogService (moved verbatim) ----
export class ChangeLogService {
  private repository: IChangeLogRepository;

  constructor(repository: IChangeLogRepository = changeLogRepository) {
    this.repository = repository;
  }

  async getChangeLogs(params?: QueryParams): Promise<PaginatedResponse<ChangeLog>> {
    return this.repository.findAll(params);
  }

  async getChangeLogById(id: string): Promise<ChangeLog> {
    return this.repository.findById(id);
  }

  async recordChange(data: Partial<ChangeLog>): Promise<ChangeLog> {
    return this.repository.create(data);
  }
}

export const changeLogService = new ChangeLogService();

// ---- ErrorLogService (moved verbatim) ----
export class ErrorLogService {
  private repository: IErrorLogRepository;

  constructor(repository: IErrorLogRepository = errorLogRepository) {
    this.repository = repository;
  }

  async getErrorLogs(params?: QueryParams): Promise<PaginatedResponse<ErrorLog>> {
    return this.repository.findAll(params);
  }

  async getErrorById(id: string): Promise<ErrorLog> {
    return this.repository.findById(id);
  }

  async resolveError(id: string): Promise<ErrorLog> {
    return this.repository.resolveError(id);
  }

  async recordError(data: Partial<ErrorLog>): Promise<ErrorLog> {
    return this.repository.create(data);
  }
}

export const errorLogService = new ErrorLogService();

// ---- LoginHistoryService (moved verbatim) ----
export class LoginHistoryService {
  private repository: ILoginHistoryRepository;

  constructor(repository: ILoginHistoryRepository = loginHistoryRepository) {
    this.repository = repository;
  }

  async getLoginHistory(params?: QueryParams): Promise<PaginatedResponse<LoginHistoryItem>> {
    return this.repository.findAll(params);
  }

  async getLoginRecordById(id: string): Promise<LoginHistoryItem> {
    return this.repository.findById(id);
  }

  async recordLogin(data: Partial<LoginHistoryItem>): Promise<LoginHistoryItem> {
    return this.repository.create(data);
  }
}

export const loginHistoryService = new LoginHistoryService();
