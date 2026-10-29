import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiRequestService,
  auditService,
  auditTrackService,
  backgroundJobService,
  changeLogService,
  errorLogService,
  loginHistoryService,
} from '../services/auditServices';
import { QueryParams } from '@/types/common';
import {
  APIRequest,
  AuditLog,
  AuditTrack,
  BackgroundJob,
  ChangeLog,
  ErrorLog,
  LoginHistoryItem,
} from '@/types/audit';

// ---- useApiRequests (moved verbatim) ----
export const API_REQUESTS_QUERY_KEYS = {
  all: ['api-requests'] as const,
  lists: () => [...API_REQUESTS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...API_REQUESTS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...API_REQUESTS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useApiRequests(params?: QueryParams) {
  return useQuery({
    queryKey: API_REQUESTS_QUERY_KEYS.list(params),
    queryFn: () => apiRequestService.getApiRequests(params),
  });
}

export function useApiRequestDetail(id: string) {
  return useQuery({
    queryKey: API_REQUESTS_QUERY_KEYS.detail(id),
    queryFn: () => apiRequestService.getApiRequestById(id),
    enabled: !!id,
  });
}

export function useCreateApiRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<APIRequest>) => apiRequestService.logApiRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_REQUESTS_QUERY_KEYS.all });
    },
  });
}

// ---- useAuditLogs (moved verbatim) ----
export const AUDIT_QUERY_KEYS = {
  all: ['audit'] as const,
  lists: () => [...AUDIT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...AUDIT_QUERY_KEYS.lists(), params] as const,
};

export function useAuditLogs(params?: QueryParams) {
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.list(params),
    queryFn: () => auditService.getAuditLogs(params),
  });
}

export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AuditLog>) => auditService.recordLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIT_QUERY_KEYS.all });
    },
  });
}

// ---- useAuditTracks (moved verbatim) ----
export const AUDIT_TRACKS_QUERY_KEYS = {
  all: ['audit-tracks'] as const,
  lists: () => [...AUDIT_TRACKS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...AUDIT_TRACKS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...AUDIT_TRACKS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useAuditTracks(params?: QueryParams) {
  return useQuery({
    queryKey: AUDIT_TRACKS_QUERY_KEYS.list(params),
    queryFn: () => auditTrackService.getTracks(params),
  });
}

export function useAuditTrackDetail(id: string) {
  return useQuery({
    queryKey: AUDIT_TRACKS_QUERY_KEYS.detail(id),
    queryFn: () => auditTrackService.getTrackById(id),
    enabled: !!id,
  });
}

export function useRecordAuditTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AuditTrack>) => auditTrackService.trackEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIT_TRACKS_QUERY_KEYS.all });
    },
  });
}

// ---- useBackgroundJobs (moved verbatim) ----
export const BACKGROUND_JOBS_QUERY_KEYS = {
  all: ['background-jobs'] as const,
  lists: () => [...BACKGROUND_JOBS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...BACKGROUND_JOBS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...BACKGROUND_JOBS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useBackgroundJobs(params?: QueryParams) {
  return useQuery({
    queryKey: BACKGROUND_JOBS_QUERY_KEYS.list(params),
    queryFn: () => backgroundJobService.getBackgroundJobs(params),
  });
}

export function useBackgroundJobDetail(id: string) {
  return useQuery({
    queryKey: BACKGROUND_JOBS_QUERY_KEYS.detail(id),
    queryFn: () => backgroundJobService.getJobById(id),
    enabled: !!id,
  });
}

export function useRetryBackgroundJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backgroundJobService.retryJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEYS.all });
    },
  });
}

export function useCancelBackgroundJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backgroundJobService.cancelJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEYS.all });
    },
  });
}

export function useCreateBackgroundJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BackgroundJob>) => backgroundJobService.createJob(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BACKGROUND_JOBS_QUERY_KEYS.all });
    },
  });
}

// ---- useChangeLogs (moved verbatim) ----
export const CHANGE_LOGS_QUERY_KEYS = {
  all: ['change-logs'] as const,
  lists: () => [...CHANGE_LOGS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...CHANGE_LOGS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...CHANGE_LOGS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useChangeLogs(params?: QueryParams) {
  return useQuery({
    queryKey: CHANGE_LOGS_QUERY_KEYS.list(params),
    queryFn: () => changeLogService.getChangeLogs(params),
  });
}

export function useChangeLogDetail(id: string) {
  return useQuery({
    queryKey: CHANGE_LOGS_QUERY_KEYS.detail(id),
    queryFn: () => changeLogService.getChangeLogById(id),
    enabled: !!id,
  });
}

export function useRecordChangeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ChangeLog>) => changeLogService.recordChange(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGE_LOGS_QUERY_KEYS.all });
    },
  });
}

// ---- useErrorLogs (moved verbatim) ----
export const ERROR_LOGS_QUERY_KEYS = {
  all: ['error-logs'] as const,
  lists: () => [...ERROR_LOGS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...ERROR_LOGS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...ERROR_LOGS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useErrorLogs(params?: QueryParams) {
  return useQuery({
    queryKey: ERROR_LOGS_QUERY_KEYS.list(params),
    queryFn: () => errorLogService.getErrorLogs(params),
  });
}

export function useErrorLogDetail(id: string) {
  return useQuery({
    queryKey: ERROR_LOGS_QUERY_KEYS.detail(id),
    queryFn: () => errorLogService.getErrorById(id),
    enabled: !!id,
  });
}

export function useResolveErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => errorLogService.resolveError(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ERROR_LOGS_QUERY_KEYS.all });
    },
  });
}

export function useRecordErrorLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ErrorLog>) => errorLogService.recordError(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ERROR_LOGS_QUERY_KEYS.all });
    },
  });
}

// ---- useLoginHistory (moved verbatim) ----
export const LOGIN_HISTORY_QUERY_KEYS = {
  all: ['login-history'] as const,
  lists: () => [...LOGIN_HISTORY_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...LOGIN_HISTORY_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...LOGIN_HISTORY_QUERY_KEYS.all, 'detail', id] as const,
};

export function useLoginHistory(params?: QueryParams) {
  return useQuery({
    queryKey: LOGIN_HISTORY_QUERY_KEYS.list(params),
    queryFn: () => loginHistoryService.getLoginHistory(params),
  });
}

export function useLoginHistoryDetail(id: string) {
  return useQuery({
    queryKey: LOGIN_HISTORY_QUERY_KEYS.detail(id),
    queryFn: () => loginHistoryService.getLoginRecordById(id),
    enabled: !!id,
  });
}

export function useRecordLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<LoginHistoryItem>) => loginHistoryService.recordLogin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOGIN_HISTORY_QUERY_KEYS.all });
    },
  });
}
