import { useNotificationStore, NotificationType, ToastAction } from '@/shared/stores/useNotificationStore';
import { ApiError } from '@/api/errors/ApiError';
import { normalizeError } from '@/api/errors/errorMapper';

export interface NotifyOptions {
  title?: string;
  duration?: number;
  showToast?: boolean;
  category?: string;
  link?: string;
  dedupKey?: string;
  action?: ToastAction;
}

/**
 * Enterprise Studio Notification Helper
 */
export const notify = {
  success(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'success',
      title: options?.title || 'Success',
      message,
      duration: options?.duration,
      showToast: options?.showToast,
      category: options?.category,
      link: options?.link,
      dedupKey: options?.dedupKey,
      action: options?.action,
    });
  },

  info(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'info',
      title: options?.title || 'Information',
      message,
      duration: options?.duration,
      showToast: options?.showToast,
      category: options?.category,
      link: options?.link,
      dedupKey: options?.dedupKey,
      action: options?.action,
    });
  },

  warning(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'warning',
      title: options?.title || 'Warning',
      message,
      duration: options?.duration,
      showToast: options?.showToast,
      category: options?.category,
      link: options?.link,
      dedupKey: options?.dedupKey,
      action: options?.action,
    });
  },

  error(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'error',
      title: options?.title || 'Error',
      message,
      duration: options?.duration,
      showToast: options?.showToast,
      category: options?.category,
      link: options?.link,
      dedupKey: options?.dedupKey,
      action: options?.action,
    });
  },

  auth(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'auth',
      title: options?.title || 'Authentication Required',
      message,
      duration: options?.duration || 6000,
      showToast: options?.showToast,
      category: options?.category || 'Security',
      link: options?.link,
      dedupKey: options?.dedupKey || 'auth-session-alert',
      action: options?.action,
    });
  },

  forbidden(message: string, options?: NotifyOptions): void {
    useNotificationStore.getState().addNotification({
      type: 'forbidden',
      title: options?.title || 'Access Denied',
      message,
      duration: options?.duration || 5000,
      showToast: options?.showToast,
      category: options?.category || 'Authorization',
      link: options?.link,
      dedupKey: options?.dedupKey,
      action: options?.action,
    });
  },

  /**
   * Safely normalize any thrown error and trigger appropriate user notification
   */
  fromError(error: unknown, options?: NotifyOptions): void {
    const apiError = error instanceof ApiError ? error : normalizeError(error);

    let type: NotificationType = 'error';
    let defaultTitle = 'Request Failed';

    if (apiError.isAuthError) {
      type = 'auth';
      defaultTitle = 'Session Expired';
    } else if (apiError.isAccountDisabled) {
      type = 'error';
      defaultTitle = 'Account Disabled';
    } else if (apiError.isAccountLocked) {
      type = 'warning';
      defaultTitle = 'Account Locked';
    } else if (apiError.isPermissionDenied) {
      type = 'forbidden';
      defaultTitle = 'Access Denied';
    } else if (apiError.isValidationError) {
      type = 'warning';
      defaultTitle = 'Validation Error';
    } else if (apiError.isConflict) {
      type = 'warning';
      defaultTitle = 'Conflict Detected';
    } else if (apiError.isRateLimited) {
      type = 'warning';
      defaultTitle = 'Rate Limit Exceeded';
    } else if (apiError.isNetworkError) {
      type = 'error';
      defaultTitle = 'Connection Error';
    } else if (apiError.isTimeout) {
      type = 'error';
      defaultTitle = 'Request Timeout';
    }

    const baseMessage = apiError.userMessage || apiError.message;
    // Failures the user cannot fix themselves carry the request id so support can find the log line.
    const needsReference = Boolean(apiError.requestId) && (apiError.status >= 500 || apiError.type === 'UNKNOWN');
    const message = needsReference ? `${baseMessage} (Ref: ${apiError.requestId})` : baseMessage;
    const title = options?.title || defaultTitle;
    const dedupKey = options?.dedupKey || `${type}:${apiError.status}:${apiError.type}:${message}`;

    useNotificationStore.getState().addNotification({
      type,
      title,
      message,
      duration: options?.duration,
      showToast: options?.showToast,
      category: options?.category,
      link: options?.link,
      dedupKey,
      action: options?.action,
    });
  },
};
