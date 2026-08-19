import { http, HttpResponse } from 'msw';
import { mockShots, Shot } from '../db/production/shots';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryShots = [...mockShots];

export const shotHandlers = [
  // GET /api/v1/shots/
  http.get('*/api/v1/shots/', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryShots, url, ['code', 'name', 'description', 'sequence_code']);
    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/shots/:id/
  http.get('*/api/v1/shots/:id/', async ({ params }) => {
    await delay(150);
    const shot = inMemoryShots.find((s) => s.id === params.id);
    if (!shot) {
      return HttpResponse.json({ detail: 'Shot not found' }, { status: 404 });
    }
    return HttpResponse.json(shot);
  }),

  // POST /api/v1/shots/
  http.post('*/api/v1/shots/', async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Shot>;
    const newShot: Shot = {
      id: `shot-${Date.now()}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      sequence_code: body.sequence_code || 'NK_010',
      code: body.code || `NK_${Math.floor(Math.random() * 900 + 100)}`,
      name: body.name || 'Untitled Shot',
      description: body.description || '',
      status: body.status || 'Not Started',
      frame_in: body.frame_in || 1001,
      frame_out: body.frame_out || 1120,
      frame_count: (body.frame_out || 1120) - (body.frame_in || 1001),
      handle_frames: body.handle_frames || 8,
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
      video_url: body.video_url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      current_version: 'v001',
      assigned_artist_id: body.assigned_artist_id,
      assigned_artist_name: body.assigned_artist_name,
      supervisor_approved: false,
      client_approved: false,
      pipeline: {
        layout: 'Not Started',
        animation: 'Not Started',
        fx: 'Not Started',
        lighting: 'Not Started',
        comp: 'Not Started',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryShots = [newShot, ...inMemoryShots];
    return HttpResponse.json(newShot, { status: 201 });
  }),

  // PATCH /api/v1/shots/:id/
  http.patch('*/api/v1/shots/:id/', async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Shot>;
    const idx = inMemoryShots.findIndex((s) => s.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Shot not found' }, { status: 404 });
    }

    inMemoryShots[idx] = {
      ...inMemoryShots[idx],
      ...body,
      pipeline: {
        ...inMemoryShots[idx].pipeline,
        ...(body.pipeline || {}),
      },
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryShots[idx]);
  }),

  // POST /api/v1/shots/:id/approve/
  http.post('*/api/v1/shots/:id/approve/', async ({ params }) => {
    await delay(250);
    const idx = inMemoryShots.findIndex((s) => s.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Shot not found' }, { status: 404 });
    }

    inMemoryShots[idx] = {
      ...inMemoryShots[idx],
      status: 'Approved',
      supervisor_approved: true,
      pipeline: {
        layout: 'Approved',
        animation: 'Approved',
        fx: 'Approved',
        lighting: 'Approved',
        comp: 'Approved',
      },
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryShots[idx]);
  }),
];
