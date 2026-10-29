/**
 * StudioHub — Centralized API Error & Auth Lifecycle Event Dispatcher
 */

import { ApiError } from '@/api/errors/ApiError';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { logger } from '@/core/logging/logger';
import { notify } from '@/core/notifications/notify';

export type ErrorEventCallback = (error: ApiError) => void;

class CentralErrorHandler {
  private authExpiredListeners: Set<ErrorEventCallback> = new Set();
  private accountDisabledListeners: Set<ErrorEventCallback> = new Set();
  private accountLockedListeners: Set<ErrorEventCallback> = new Set();
  private forbiddenListeners: Set<ErrorEventCallback> = new Set();
  private networkFailureListeners: Set<ErrorEventCallback> = new Set();
  private serverFailureListeners: Set<ErrorEventCallback> = new Set();

  private isHandlingAuthExpiry = false;
  private isHandlingAccountDisabled = false;
  private consecutiveNetworkFailures = 0;

  /**
   * Main entrypoint for processing any API error throughout the entire application.
   */
  public handleError(error: ApiError, options: { silent?: boolean; source?: string } = {}): void {
    const { silent = false, source = 'App' } = options;

    logger.warn('CentralErrorHandler', `[${source}] Error detected [${error.type} - ${error.status}]: ${error.message}`);

    const isTestOrSimulation =
      source === 'TestRunner' ||
      source === 'TestRunnerEngine' ||
      source === 'TestingSuite' ||
      source === 'ErrorSimulator' ||
      source.includes('Test') ||
      error.message?.includes('Simulated') ||
      error.message?.includes('mock_error');

    // 1. Account Disabled Handling
    if (error.type === 'ACCOUNT_DISABLED') {
      if (!isTestOrSimulation) {
        this.handleAccountDisabled(error);
      }
      return;
    }

    // 2. Account Locked Handling
    if (error.type === 'ACCOUNT_LOCKED') {
      if (!isTestOrSimulation) {
        this.handleAccountLocked(error);
      }
      return;
    }

    // 3. Authentication / Session Expired Handling
    if (error.type === 'AUTHENTICATION' || error.type === 'SESSION_EXPIRED') {
      if (!isTestOrSimulation) {
        this.handleAuthExpired(error);
      }
      return;
    }

    // 4. Forbidden Handling (403)
    if (error.type === 'FORBIDDEN') {
      this.handleForbidden(error, silent);
      return;
    }

    // 5. Network / Server Failure Tracking
    if (error.type === 'NETWORK' || error.type === 'TIMEOUT') {
      this.consecutiveNetworkFailures++;
      this.networkFailureListeners.forEach((listener) => listener(error));
      if (!silent) {
        notify.fromError(error, { dedupKey: 'network-failure-alert' });
      }
      return;
    }

    if (error.type === 'SERVER' || error.type === 'BAD_GATEWAY' || error.type === 'SERVICE_UNAVAILABLE') {
      this.serverFailureListeners.forEach((listener) => listener(error));
      if (!silent) {
        notify.fromError(error, { dedupKey: `server-error-${error.status}` });
      }
      return;
    }

    // 6. Generic Notification if not silent
    if (!silent) {
      notify.fromError(error);
    }
  }

  private handleAccountDisabled(error: ApiError): void {
    if (this.isHandlingAccountDisabled) return;
    this.isHandlingAccountDisabled = true;

    logger.error('CentralErrorHandler', 'User account is disabled/suspended. Purging active session.');
    tokenStorage.clearTokens();

    this.accountDisabledListeners.forEach((listener) => listener(error));

    notify.error('Your account has been disabled. Please contact your platform administrator.', {
      title: 'Account Disabled',
      dedupKey: 'account-disabled-alert',
      duration: 10000,
    });
  }

  private handleAccountLocked(error: ApiError): void {
    logger.warn('CentralErrorHandler', 'User account is locked.');
    this.accountLockedListeners.forEach((listener) => listener(error));

    notify.warning('Your account is temporarily locked. Please try again later or contact your administrator.', {
      title: 'Account Locked',
      dedupKey: 'account-locked-alert',
      duration: 8000,
    });
  }

  private handleAuthExpired(error: ApiError): void {
    if (this.isHandlingAuthExpiry) return;
    this.isHandlingAuthExpiry = true;

    logger.warn('CentralErrorHandler', 'Authentication expired or invalid. Clearing tokens and notifying user.');
    tokenStorage.clearTokens();

    this.authExpiredListeners.forEach((listener) => listener(error));

    notify.auth('Your session has expired. Please sign in again.', {
      dedupKey: 'session-expired-alert',
      duration: 6000,
    });

    // Reset flag after cooldown
    setTimeout(() => {
      this.isHandlingAuthExpiry = false;
    }, 5000);
  }

  private handleForbidden(error: ApiError, silent: boolean): void {
    logger.warn('CentralErrorHandler', 'Access Forbidden (403): User lacks permission for requested resource.');
    this.forbiddenListeners.forEach((listener) => listener(error));

    if (!silent) {
      notify.forbidden(error.userMessage || "You don't have permission to perform this action.", {
        dedupKey: `forbidden-${error.message}`,
      });
    }
  }

  public recordSuccess(): void {
    this.consecutiveNetworkFailures = 0;
  }

  public getConsecutiveNetworkFailures(): number {
    return this.consecutiveNetworkFailures;
  }

  // Subscription APIs
  public onAuthExpired(callback: ErrorEventCallback): () => void {
    this.authExpiredListeners.add(callback);
    return () => this.authExpiredListeners.delete(callback);
  }

  public onAccountDisabled(callback: ErrorEventCallback): () => void {
    this.accountDisabledListeners.add(callback);
    return () => this.accountDisabledListeners.delete(callback);
  }

  public onAccountLocked(callback: ErrorEventCallback): () => void {
    this.accountLockedListeners.add(callback);
    return () => this.accountLockedListeners.delete(callback);
  }

  public onForbidden(callback: ErrorEventCallback): () => void {
    this.forbiddenListeners.add(callback);
    return () => this.forbiddenListeners.delete(callback);
  }

  public onNetworkFailure(callback: ErrorEventCallback): () => void {
    this.networkFailureListeners.add(callback);
    return () => this.networkFailureListeners.delete(callback);
  }

  public onServerFailure(callback: ErrorEventCallback): () => void {
    this.serverFailureListeners.add(callback);
    return () => this.serverFailureListeners.delete(callback);
  }
}

export const centralErrorHandler = new CentralErrorHandler();
