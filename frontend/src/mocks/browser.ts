import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { logger } from '@/core/logging/logger';

export const worker = setupWorker(...handlers);

export async function enableMocking(): Promise<void> {
  try {
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    logger.info('MSW', 'Mock Service Worker initialized successfully for VFX Platform');
  } catch (error) {
    // If service worker registration fails in certain iframe sandboxes, fallback gracefully
    logger.warn('MSW', 'Service worker setup fallback', error);
  }
}
