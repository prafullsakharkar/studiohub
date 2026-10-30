import type { DrfErrorResponse } from '@/types/common';
import { normalizeApiError } from './normalizeApiError';
import { AppError, type IAppError } from './AppError';
import type { ApiErrorType, NormalizedApiError } from '@/core/api/types';

export interface ApiErrorInitOptions {
  type?: ApiErrorType;
  code?: string;
  userMessage?: string;
  details?: unknown;
  fieldErrors?: Record<string, string[]>;
  nonFieldErrors?: string[];
  requestId?: string;
  retryable?: boolean;
  requiresAuthentication?: boolean;
  requiresReauthorization?: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

export class ApiError extends AppError implements IAppError, NormalizedApiError {
  public readonly type: ApiErrorType;
  public readonly code?: string;
  public readonly userMessage: string;
  public readonly details?: unknown;
  public readonly fieldErrors: Record<string, string[]>;
  public readonly nonFieldErrors: string[];
  public readonly requestId?: string;
  public readonly retryable: boolean;
  public readonly requiresAuthentication: boolean;
  public readonly requiresReauthorization: boolean;
  public readonly retryAfterMs?: number;
  public readonly timestamp: string;

  constructor(
    message: string,
    status = 500,
    errors: Record<string, string[]> = {},
    options?: ApiErrorInitOptions | unknown
  ) {
    super(message, status, errors, options && typeof options === 'object' && 'originalError' in options ? (options as any).originalError : options);
    this.name = 'ApiError';

    const opts: ApiErrorInitOptions = (options && typeof options === 'object' && !('stack' in (options as object)) && ('type' in (options as object) || 'code' in (options as object) || 'userMessage' in (options as object) || 'requestId' in (options as object)))
      ? (options as ApiErrorInitOptions)
      : {};

    this.fieldErrors = opts.fieldErrors || errors || {};
    this.nonFieldErrors = opts.nonFieldErrors || [];
    this.code = opts.code;
    this.details = opts.details !== undefined ? opts.details : options;
    this.requestId = opts.requestId;
    this.retryAfterMs = opts.retryAfterMs;
    this.timestamp = new Date().toISOString();

    // 1. Resolve Error Type
    if (opts.type) {
      this.type = opts.type;
    } else {
      this.type = ApiError.resolveErrorType(status, opts.code);
    }

    // 2. Resolve Flags
    this.requiresAuthentication = opts.requiresAuthentication !== undefined
      ? opts.requiresAuthentication
      : (this.type === 'AUTHENTICATION' || this.type === 'SESSION_EXPIRED');

    this.requiresReauthorization = opts.requiresReauthorization !== undefined
      ? opts.requiresReauthorization
      : (this.type === 'FORBIDDEN');

    this.retryable = opts.retryable !== undefined
      ? opts.retryable
      : ApiError.isTypeRetryable(this.type, status);

    // 3. Resolve User Message
    if (opts.userMessage) {
      this.userMessage = opts.userMessage;
    } else {
      this.userMessage = ApiError.generateUserMessage(this.type, message, status, this.fieldErrors);
    }

    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static resolveErrorType(status: number, code?: string): ApiErrorType {
    const upperCode = (code || '').toUpperCase();

    if (upperCode === 'ACCOUNT_DISABLED' || upperCode === 'USER_DISABLED' || upperCode === 'ACCOUNT_SUSPENDED') {
      return 'ACCOUNT_DISABLED';
    }
    if (upperCode === 'ACCOUNT_LOCKED' || upperCode === 'USER_LOCKED') {
      return 'ACCOUNT_LOCKED';
    }
    if (upperCode === 'SESSION_EXPIRED' || upperCode === 'TOKEN_EXPIRED') {
      return 'SESSION_EXPIRED';
    }
    if (upperCode === 'MFA_ENROLLMENT_REQUIRED' || upperCode === 'PASSWORD_CHANGE_REQUIRED') {
      return 'RESTRICTED_SESSION';
    }
    if (upperCode === 'INVALID_CREDENTIALS') {
      return 'INVALID_CREDENTIALS';
    }

    if (status === 0) return 'NETWORK';
    if (status === 400) return 'VALIDATION';
    if (status === 401) return 'AUTHENTICATION';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 409) return 'CONFLICT';
    if (status === 413) return 'PAYLOAD_TOO_LARGE';
    if (status === 422) return 'VALIDATION';
    if (status === 423) return 'ACCOUNT_LOCKED';
    if (status === 429) return 'RATE_LIMIT';
    if (status === 502) return 'BAD_GATEWAY';
    if (status === 503) return 'SERVICE_UNAVAILABLE';
    if (status === 504) return 'TIMEOUT';
    if (status >= 500) return 'SERVER';

    return 'UNKNOWN';
  }

  static isTypeRetryable(type: ApiErrorType, status: number): boolean {
    if (type === 'NETWORK' || type === 'TIMEOUT' || type === 'BAD_GATEWAY' || type === 'SERVICE_UNAVAILABLE') {
      return true;
    }
    if (type === 'SERVER' && status >= 500) {
      return true;
    }
    if (type === 'RATE_LIMIT') {
      return true;
    }
    // Non-retryable types: 400, 401, 403, 404, 409, 422, ACCOUNT_DISABLED, ACCOUNT_LOCKED
    return false;
  }

  static generateUserMessage(
    type: ApiErrorType,
    rawMessage: string,
    status: number,
    fieldErrors: Record<string, string[]>
  ): string {
    switch (type) {
      case 'NETWORK':
        return 'Unable to connect to StudioHub. Please check your network connection and try again.';
      case 'TIMEOUT':
        return 'The server took too long to respond. Please try again.';
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please sign in again.';
      case 'AUTHENTICATION':
        return 'Authentication required. Please sign in to continue.';
      case 'ACCOUNT_DISABLED':
        return 'Your account has been disabled. Please contact your organization administrator.';
      case 'ACCOUNT_LOCKED':
        return 'Your account is temporarily locked. Please try again later or contact your administrator.';
      case 'FORBIDDEN':
        return "You don't have permission to perform this action.";
      case 'NOT_FOUND':
        return 'The requested resource was not found or may have been deleted.';
      case 'VALIDATION': {
        const fieldCount = Object.keys(fieldErrors).length;
        if (fieldCount > 0) {
          return 'Please correct the highlighted validation errors.';
        }
        return rawMessage && rawMessage !== 'Bad Request' ? rawMessage : 'Please review and correct the submitted information.';
      }
      case 'CONFLICT':
        return 'This record was modified by someone else or already exists. Please refresh and try again.';
      case 'INVALID_CREDENTIALS':
      case 'RESTRICTED_SESSION':
        // The server's own sentence is the right one ("Invalid email or password.",
        // "Set up two-factor authentication before continuing.").
        return rawMessage;
      case 'PAYLOAD_TOO_LARGE':
        return 'The file or request is too large. Please reduce its size and try again.';
      case 'RATE_LIMIT':
        return 'Too many requests sent to the server. Please wait a moment and try again.';
      case 'BAD_GATEWAY':
        return 'Upstream service unavailable. Please try again shortly.';
      case 'SERVICE_UNAVAILABLE':
        return 'The service is temporarily undergoing maintenance. Please try again shortly.';
      case 'SERVER':
        return 'Something went wrong on the server. Please try again.';
      case 'UNKNOWN':
      default:
        return rawMessage && rawMessage !== 'Internal Server Error' && rawMessage !== 'An unexpected server error occurred.'
          ? rawMessage
          : 'An unexpected error occurred. Please try again.';
    }
  }

  get isValidationError(): boolean {
    return this.type === 'VALIDATION' || this.status === 400 || this.status === 422;
  }

  get isAuthError(): boolean {
    return this.type === 'AUTHENTICATION' || this.type === 'SESSION_EXPIRED' || this.status === 401;
  }

  /** What a restricted session must do before anything else works, from the stable 403 code. */
  get requiredAction(): 'mfa_enrollment' | 'password_change' | null {
    if (this.code === 'mfa_enrollment_required') return 'mfa_enrollment';
    if (this.code === 'password_change_required') return 'password_change';
    return null;
  }

  /** A 401 that means "the session is gone" (as opposed to a wrong password/code). */
  get isSessionLoss(): boolean {
    return (this.type === 'AUTHENTICATION' || this.type === 'SESSION_EXPIRED') && this.status === 401;
  }

  get isAccountDisabled(): boolean {
    return this.type === 'ACCOUNT_DISABLED';
  }

  get isAccountLocked(): boolean {
    return this.type === 'ACCOUNT_LOCKED';
  }

  get isPermissionDenied(): boolean {
    return this.type === 'FORBIDDEN' || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.type === 'NOT_FOUND' || this.status === 404;
  }

  get isConflict(): boolean {
    return this.type === 'CONFLICT' || this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.type === 'RATE_LIMIT' || this.status === 429;
  }

  get isServerError(): boolean {
    return this.type === 'SERVER' || this.type === 'BAD_GATEWAY' || this.type === 'SERVICE_UNAVAILABLE' || this.status >= 500;
  }

  get isBadGateway(): boolean {
    return this.type === 'BAD_GATEWAY' || this.status === 502;
  }

  get isServiceUnavailable(): boolean {
    return this.type === 'SERVICE_UNAVAILABLE' || this.status === 503;
  }

  get isNetworkError(): boolean {
    return this.type === 'NETWORK' || this.status === 0;
  }

  get isTimeout(): boolean {
    return this.type === 'TIMEOUT' || this.status === 504;
  }

  getFieldErrors(field: string): string[] {
    return this.fieldErrors[field] || this.errors[field] || [];
  }

  getFirstFieldError(field: string): string | undefined {
    return (this.fieldErrors[field] || this.errors[field])?.[0];
  }

  hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0 || Object.keys(this.errors).length > 0;
  }

  static fromDrfResponse(
    status: number,
    data: DrfErrorResponse | string | null | undefined,
    headers?: Headers | Record<string, string | null | undefined>
  ): ApiError {
    const normalized = normalizeApiError(status, data, headers);
    const type = ApiError.resolveErrorType(status, normalized.code);
    // A delete blocked by references: the server names what still points at the record, which
    // is the only useful part (the generic conflict text would be misleading here).
    const userMessage =
      normalized.code === 'has_dependants'
        ? `This record is still in use and cannot be deleted. ${normalized.message}`
        : ApiError.generateUserMessage(type, normalized.message, status, normalized.fieldErrors);

    return new ApiError(normalized.message, status, normalized.fieldErrors, {
      type,
      code: normalized.code,
      userMessage,
      details: data,
      fieldErrors: normalized.fieldErrors,
      nonFieldErrors: normalized.nonFieldErrors,
      requestId: normalized.requestId,
      retryAfterMs: normalized.retryAfter !== undefined ? normalized.retryAfter * 1000 : undefined,
    });
  }

  static fromUnknown(error: unknown, fallbackMessage = 'An unexpected application error occurred'): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error && typeof error === 'object') {
      const err = error as any;
      if ('status' in err && 'message' in err) {
        return new ApiError(err.message, err.status, err.fieldErrors || err.errors || {}, {
          type: err.type,
          code: err.code,
          userMessage: err.userMessage,
          requestId: err.requestId,
          originalError: error,
        });
      }
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')) {
        return new ApiError('Request timed out while waiting for server response.', 504, {}, {
          type: 'TIMEOUT',
          originalError: error,
        });
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        return new ApiError('Network connection failure. Unable to reach server.', 0, {}, {
          type: 'NETWORK',
          originalError: error,
        });
      }
      return new ApiError(error.message, 500, {}, {
        type: 'SERVER',
        originalError: error,
      });
    }

    return new ApiError(fallbackMessage, 500, {}, {
      type: 'UNKNOWN',
      originalError: error,
    });
  }
}
