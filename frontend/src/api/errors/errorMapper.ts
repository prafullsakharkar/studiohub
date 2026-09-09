import { ApiError } from './ApiError';
import { logger } from '@/core/logging/logger';

export function mapHttpError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  // Handle Ky HTTP response errors
  if (error && typeof error === 'object' && 'response' in error) {
    const kyError = error as { response?: Response; message?: string; name?: string };
    const status = kyError.response?.status || 500;
    
    let defaultMsg = `Request failed with status ${status}`;
    if (status === 400) defaultMsg = 'Invalid request parameters or payload validation failed (400).';
    else if (status === 401) defaultMsg = 'Authentication required or session expired (401).';
    else if (status === 403) defaultMsg = 'Access forbidden. You do not have permissions for this resource (403).';
    else if (status === 404) defaultMsg = 'The requested studio resource was not found (404).';
    else if (status === 409) defaultMsg = 'Conflict detected: Concurrent resource edit or duplicate key (409).';
    else if (status === 422) defaultMsg = 'Unprocessable Entity: Semantic schema failure (422).';
    else if (status === 429) defaultMsg = 'Rate limit exceeded: Too many requests sent to API (429).';
    else if (status === 500) defaultMsg = 'Django REST Framework Internal Server Error (500).';
    else if (status === 502) defaultMsg = 'Bad Gateway: Upstream VFX microservice failed to respond (502).';
    else if (status === 503) defaultMsg = 'Service Unavailable: Studio backend is temporarily offline (503).';

    logger.error('ApiClient', `HTTP Exception [${status}]`, error);
    return new ApiError(defaultMsg, status, {}, error);
  }

  // Handle AbortError / TimeoutError
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')) {
      logger.warn('ApiClient', `Request Timeout: ${error.message}`);
      return new ApiError('Request timed out while waiting for server response. Please retry.', 504, {}, error);
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || !navigator.onLine) {
      logger.error('ApiClient', `Network Disconnection: ${error.message}`);
      return new ApiError('Network connection failure. Please check your internet connection.', 0, {}, error);
    }

    logger.error('ApiClient', `Client Exception: ${error.message}`, error);
    return new ApiError(error.message, 0, {}, error);
  }

  logger.error('ApiClient', 'Unknown API Exception', error);
  return new ApiError('An unknown error occurred while communicating with the server.', 0, {}, error);
}

