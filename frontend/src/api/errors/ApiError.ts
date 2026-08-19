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

    if (status === 401) {
      message = message || 'Session expired or unauthenticated. Please log in.';
    } else if (status === 403) {
      message = message || 'You do not have permission to perform this action.';
    } else if (status === 404) {
      message = message || 'The requested resource was not found.';
    } else if (status === 429) {
      message = message || 'Too many requests. Please try again later.';
    } else if (status >= 500) {
      message = message || 'Internal server error occurred.';
    }

    return new ApiError(message, status, errors, data);
  }
}
