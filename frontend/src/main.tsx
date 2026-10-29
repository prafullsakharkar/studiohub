import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { getApiConfig } from './api/repositories/config';
import { logger } from './core/logging/logger';

async function bootstrap() {
  try {
    const config = getApiConfig();
    logger.info(
      'Bootstrap',
      `StudioHub initialized (Base URL: "${config.baseUrl || '/'}")`
    );
  } catch (err) {
    logger.error('Bootstrap', 'Error during bootstrap initialization', err);
  }

  const rootElement = document.getElementById('root');
  if (rootElement) {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
}

bootstrap();
