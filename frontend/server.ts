import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createServer as createViteServer } from 'vite';

// console.log('[ENV] VITE_API_URL:', process.env.VITE_API_URL);
// console.log('[ENV] DJANGO_HEALTH_PATH:', process.env.DJANGO_HEALTH_PATH);

const PORT = Number(process.env.PORT || 3000);
const DJANGO_URL = (process.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
// The backend's liveness route is /health/ (config/urls.py), not under /api.
const DJANGO_HEALTH_PATH = process.env.DJANGO_HEALTH_PATH || '/health/';
const DJANGO_HEALTH_URL = `${DJANGO_URL}${DJANGO_HEALTH_PATH}`;

let isDjangoRunning = false;

async function checkDjangoServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(DJANGO_HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();

  app.get('/api/health', async (_req, res) => {
    isDjangoRunning = await checkDjangoServer();

    res.json({
      status: 'ok',
      service: 'StudioHub Platform',
      backend: {
        url: DJANGO_URL,
        healthUrl: DJANGO_HEALTH_URL,
        running: isDjangoRunning,
        mode: isDjangoRunning ? 'django' : 'backend-unavailable',
      },
      time: new Date().toISOString(),
    });
  });

  const djangoProxy = createProxyMiddleware({
    target: DJANGO_URL,
    changeOrigin: true,
    ws: false,
    on: {
      error: (error, _req, res) => {
        isDjangoRunning = false;

        console.error(
          `[Django Proxy] Backend unavailable at ${DJANGO_URL}:`,
          error.message
        );

        if ('headersSent' in res && !res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
          });

          res.end(
            JSON.stringify({
              detail: 'Django backend is unavailable.',
              backend: DJANGO_URL,
            })
          );
        }
      },
      proxyRes: () => {
        isDjangoRunning = true;
      },
    },
  });

  app.use((req, res, next) => {
    const p = req.path;
    const isHtmlNavigation = req.method === 'GET' && (req.headers.accept?.includes('text/html') || !p.includes('.'));

    // HTML page reloads and client routes must always be served by Vite/SPA
    if (isHtmlNavigation && !p.startsWith('/api/')) {
      return next();
    }

    // Only proxy backend routes (/api/, /staticfiles/, /media/, /admin/)
    if (
      p.startsWith('/api/') ||
      p.startsWith('/staticfiles') ||
      p.startsWith('/media') ||
      (p.startsWith('/admin') && isDjangoRunning)
    ) {
      return djangoProxy(req, res, next);
    }

    next();
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));

    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', async () => {
    isDjangoRunning = await checkDjangoServer();

    console.log(
      `[StudioHub] Server active at http://0.0.0.0:${PORT}`
    );

    console.log(
      `[StudioHub] Django backend: ${DJANGO_URL}`
    );

    console.log(
      `[StudioHub] Django status: ${isDjangoRunning ? 'running' : 'unavailable'}`
    );
  });
}

startServer().catch((err) => {
  console.error('[StudioHub] Fatal startup error:', err);
  process.exit(1);
});