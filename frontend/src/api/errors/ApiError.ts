import { DrfErrorResponse } from '@/types/drf';

export class ApiError extends Error {
  public readonly status: number;
  public readonly errors: Record<string, string[]>;
  public readonly originalError?: unknown;

  constructor(message: string, status = 500, errors: Record<string, string[]> = {}, originalError?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.originalError = originalError;
  }

  get isValidationError(): boolean {
    return this.status === 400 || this.status === 422;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isPermissionDenied(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isServerError(): boolean {
    return this.status >= 500;
  }

  get isBadGateway(): boolean {
    return this.status === 502;
  }

  get isServiceUnavailable(): boolean {
    return this.status === 503;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }

  getFieldErrors(field: string): string[] {
    return this.errors[field] || [];
  }

  getFirstFieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }

  hasFieldErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  static fromDrfResponse(status: number, data: DrfErrorResponse | string | null | undefined): ApiError {
    let message = 'An unexpected server error occurred.';
    const errors: Record<string, string[]> = {};

    if (typeof data === 'string') {
      message = data;
    } else if (data && typeof data === 'object') {
      if (data.detail) {
        message = data.detail;
      } else if (data.non_field_errors && data.non_field_errors.length > 0) {
        message = data.non_field_errors.join(' ');
      }

      for (const [key, val] of Object.entries(data)) {
        if (key === 'detail' || key === 'non_field_errors') continue;
        if (Array.isArray(val)) {
          errors[key] = val.map(String);
        } else if (typeof val === 'string') {
          errors[key] = [val];
        }
      }
    }

    if (status === 400 && !message) {
      message = 'Please correct the highlighted validation errors.';
    } else if (status === 401) {
      message = message || 'Session expired or unauthenticated. Please log in.';
    } else if (status === 403) {
      message = message || 'You do not have permission to perform this action.';
    } else if (status === 404) {
      message = message || 'The requested resource was not found.';
    } else if (status === 409) {
      message = message || 'A data conflict occurred. The resource was modified or already exists.';
    } else if (status === 422) {
      message = message || 'The submitted payload could not be processed by the server.';
    } else if (status === 429) {
      message = message || 'Too many requests. API rate limit exceeded. Please try again later.';
    } else if (status === 502) {
      message = message || 'Bad Gateway: Upstream VFX pipeline server error.';
    } else if (status === 503) {
      message = message || 'Service Unavailable: Studio backend is undergoing maintenance.';
    } else if (status >= 500) {
      message = message || 'Internal server error occurred.';
    }

    return new ApiError(message, status, errors, data);
  }
}

