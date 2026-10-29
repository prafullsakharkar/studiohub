/**
 * StudioHub — Centralized API Error & Client Types
 */

export type ApiErrorType =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'AUTHENTICATION'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_LOCKED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMIT'
  | 'SERVER'
  | 'BAD_GATEWAY'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN';

export interface NormalizedApiError {
  type: ApiErrorType;
  code?: string;
  status: number;
  message: string;
  userMessage: string;
  details?: unknown;
  fieldErrors: Record<string, string[]>;
  nonFieldErrors: string[];
  requestId?: string;
  retryable: boolean;
  requiresAuthentication: boolean;
  requiresReauthorization: boolean;
  retryAfterMs?: number;
  timestamp: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}
