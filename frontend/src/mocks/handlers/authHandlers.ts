import { http, HttpResponse } from 'msw';
import { mockUsers } from '../db/identity/users';
import { delay } from '../utils/mockServerHelpers';

// In-memory token store for validation
const activeTokens = new Set<string>();

export const authHandlers = [
  // POST /api/v1/auth/login/
  http.post('*/api/v1/auth/login/', async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as { email?: string; password?: string };

    const user = mockUsers.find((u) => u.email.toLowerCase() === body.email?.toLowerCase());

    if (!user) {
      return HttpResponse.json(
        { detail: 'No active account found with the given credentials' },
        { status: 401 }
      );
    }

    if (!body.password || (body.password !== 'password123' && body.password !== 'admin' && body.password.length < 6)) {
      return HttpResponse.json(
        { detail: 'Invalid credentials. Hint: use password123' },
        { status: 400 }
      );
    }

    const accessToken = `jwt_acc_${user.id}_${Date.now()}`;
    const refreshToken = `jwt_ref_${user.id}_${Date.now()}`;
    activeTokens.add(accessToken);
    activeTokens.add(refreshToken);

    return HttpResponse.json({
      tokens: {
        access: accessToken,
        refresh: refreshToken,
      },
      user,
    });
  }),

  // POST /api/v1/auth/refresh/
  http.post('*/api/v1/auth/refresh/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as { refresh?: string };

    if (!body.refresh) {
      return HttpResponse.json({ detail: 'Refresh token is required' }, { status: 400 });
    }

    const newAccessToken = `jwt_acc_refreshed_${Date.now()}`;
    activeTokens.add(newAccessToken);

    return HttpResponse.json({
      access: newAccessToken,
    });
  }),

  // POST /api/v1/auth/logout/
  http.post('*/api/v1/auth/logout/', async () => {
    await delay(150);
    return HttpResponse.json({ detail: 'Successfully logged out' });
  }),

  // GET /api/v1/auth/me/
  http.get('*/api/v1/auth/me/', async ({ request }) => {
    await delay(150);
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { detail: 'Authentication credentials were not provided.' },
        { status: 401 }
      );
    }

    // Default to supervisor or user matching token
    const token = authHeader.replace('Bearer ', '');
    const user = mockUsers.find((u) => token.includes(u.id)) || mockUsers[0];

    return HttpResponse.json(user);
  }),
];
