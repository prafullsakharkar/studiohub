import type { DrfErrorResponse } from '@/types/common';

export interface IAppError {
  readonly name: string;
  readonly message: string;
  readonly status: number;
  readonly errors: Record<string, string[]>;
  readonly originalError?: unknown;
  readonly isValidationError: boolean;
  readonly isAuthError: boolean;
  readonly isPermissionDenied: boolean;
  readonly isNotFound: boolean;
  readonly isConflict: boolean;
  readonly isRateLimited: boolean;
  readonly isServerError: boolean;
  readonly isNetworkError: boolean;
  getFieldErrors(field: string): string[];
  getFirstFieldError(field: string): string | undefined;
  hasFieldErrors(): boolean;
}

export class AppError extends Error implements IAppError {
  public readonly status: number;
  public readonly errors: Record<string, string[]>;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    status = 500,
    errors: Record<string, string[]> = {},
    originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.errors = errors;
    this.originalError = originalError;

    // Maintain prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
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

  static fromDrfResponse(status: number, data: DrfErrorResponse | string | null | undefined): AppError {
    let message = '';
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

      // If no explicit detail/non_field_errors, build message from field errors
      if (!message && Object.keys(errors).length > 0) {
        const errorList = Object.entries(errors).map(([field, msgs]) => `${field}: ${msgs.join(', ')}`);
        message = errorList.join(' | ');
      }
    }

    if (!message) {
      if (status === 400) {
        message = 'Invalid credentials or request data. Please check your inputs.';
      } else if (status === 401) {
        message = 'Authentication failed. Please verify your email and password.';
      } else if (status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (status === 404) {
        message = 'The requested resource was not found.';
      } else if (status === 409) {
        message = 'A data conflict occurred. The resource was modified or already exists.';
      } else if (status === 422) {
        message = 'The submitted payload could not be processed by the server.';
      } else if (status === 429) {
        message = 'Too many requests. API rate limit exceeded. Please try again later.';
      } else if (status >= 500) {
        message = 'Internal server error occurred. Please try again later.';
      } else {
        message = 'An unexpected server error occurred.';
      }
    }

    return new AppError(message, status, errors, data);
  }

  static fromUnknown(error: unknown, fallbackMessage = 'An unexpected application error occurred'): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const err = error as { status: number; message: string; errors?: Record<string, string[]> };
      return new AppError(err.message, err.status, err.errors || {}, error);
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.toLowerCase().includes('timeout')) {
        return new AppError('Request timed out while waiting for server response.', 504, {}, error);
      }
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        return new AppError('Network connection failure. Unable to reach server.', 0, {}, error);
      }
      return new AppError(error.message, 500, {}, error);
    }

    return new AppError(fallbackMessage, 500, {}, error);
  }
}

export function toAppError(error: unknown): AppError {
  return AppError.fromUnknown(error);
}
