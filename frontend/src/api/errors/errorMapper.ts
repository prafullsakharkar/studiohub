import { ApiError } from './ApiError';
import { logger } from '@/core/logging/logger';

export function mapHttpError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  // Handle Ky / fetch HTTP response errors
  if (error && typeof error === 'object' && 'response' in error) {
    const kyError = error as { response?: Response; message?: string };
    const status = kyError.response?.status || 500;
    const message = kyError.message || `Request failed with status ${status}`;
    logger.error('ApiClient', `HTTP Exception [${status}]`, error);
    return new ApiError(message, status, {}, error);
  }

  if (error instanceof Error) {
    logger.error('ApiClient', `Network/Client Exception: ${error.message}`, error);
    return new ApiError(error.message, 0, {}, error);
  }

  logger.error('ApiClient', 'Unknown API Exception', error);
  return new ApiError('An unknown error occurred while communicating with the server.', 0, {}, error);
}
