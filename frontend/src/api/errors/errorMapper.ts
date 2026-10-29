import { ApiError } from './ApiError';
import { logger } from '@/core/logging/logger';
import { DrfErrorResponse } from '@/types/common';

/**
 * Enterprise HTTP & System Error Normalizer
 */
export function mapHttpError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  // Preserve HTTP status from status-carrying errors (e.g., AppError thrown by
  // REST adapters after parsing the DRF error body). Without this, 4xx errors
  // degrade to `500 SERVER`, which also defeats the non-retryable logic in
  // QueryProvider (404s would be retried instead of failing fast).
  if (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const err = error as { status: number; message?: unknown };
    const message = typeof err.message === 'string' && err.message ? err.message : null;
    return ApiError.fromDrfResponse(err.status, message);
  }

  // Handle Ky HTTP Response errors
  if (error && typeof error === 'object' && 'response' in error) {
    const kyError = error as { response?: Response; message?: string; name?: string };
    const response = kyError.response;
    const status = response?.status || 500;
    const headers = response?.headers;
    const requestId = headers?.get('x-request-id') || headers?.get('x-correlation-id') || undefined;

    logger.error('ApiClient', `HTTP Exception [${status}]`, error);
    return ApiError.fromDrfResponse(status, kyError.message, headers);
  }

  // Handle Fetch Response objects directly
  if (error instanceof Response) {
    const status = error.status;
    const requestId = error.headers.get('x-request-id') || error.headers.get('x-correlation-id') || undefined;
    return ApiError.fromDrfResponse(status, `HTTP error ${status}`, error.headers);
  }

  // Handle Standard JavaScript Errors, AbortController & Network errors
  if (error instanceof Error) {
    const msg = error.message || '';
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Timeout
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      msg.toLowerCase().includes('timeout') ||
      msg.toLowerCase().includes('timed out')
    ) {
      logger.warn('ApiClient', `Request Timeout: ${msg}`);
      return new ApiError('Request timed out while waiting for server response. Please retry.', 504, {}, {
        type: 'TIMEOUT',
        userMessage: 'The server took too long to respond. Please try again.',
        originalError: error,
      });
    }

    // Network / Connection Disconnect / CORS
    if (
      !isOnline ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('network') ||
      msg.includes('connection refused') ||
      msg.includes('connection reset') ||
      msg.includes('DNS')
    ) {
      logger.error('ApiClient', `Network Disconnection: ${msg}`);
      return new ApiError('Network connection failure. Unable to reach StudioHub server.', 0, {}, {
        type: 'NETWORK',
        userMessage: 'Unable to connect to StudioHub. Please check your connection and try again.',
        originalError: error,
      });
    }

    logger.error('ApiClient', `Client Exception: ${msg}`, error);
    return new ApiError(msg, 500, {}, {
      type: 'SERVER',
      userMessage: 'An error occurred while processing your request. Please try again.',
      originalError: error,
    });
  }

  logger.error('ApiClient', 'Unknown API Exception', error);
  return new ApiError('An unknown error occurred while communicating with the server.', 500, {}, {
    type: 'UNKNOWN',
    userMessage: 'An unexpected error occurred. Please try again.',
    originalError: error,
  });
}

export function normalizeError(error: unknown): ApiError {
  return mapHttpError(error);
}
