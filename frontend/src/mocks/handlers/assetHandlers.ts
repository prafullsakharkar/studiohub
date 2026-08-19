import { http, HttpResponse } from 'msw';
import { mockAssets, Asset } from '../db/assets/assets';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryAssets = [...mockAssets];

export const assetHandlers = [
  // GET /api/v1/assets/
  http.get('*/api/v1/assets/', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryAssets, url, ['name', 'code', 'category', 'description']);
    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/assets/:id/
  http.get('*/api/v1/assets/:id/', async ({ params }) => {
    await delay(150);
    const asset = inMemoryAssets.find((a) => a.id === params.id);
    if (!asset) {
      return HttpResponse.json({ detail: 'Asset not found' }, { status: 404 });
    }
    return HttpResponse.json(asset);
  }),

  // POST /api/v1/assets/
  http.post('*/api/v1/assets/', async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Asset>;
    const newAsset: Asset = {
      id: `ast-${Date.now()}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      name: body.name || 'New Asset',
      code: body.code || `AST_${Math.floor(Math.random() * 9000 + 1000)}`,
      category: body.category || 'Prop',
      description: body.description || '',
      status: body.status || 'Not Started',
      version: 'v001',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80',
      file_format: body.file_format || 'USD / Alembic (.abc)',
      poly_count: body.poly_count || 500000,
      lod_levels: body.lod_levels || 3,
      assigned_artist_id: body.assigned_artist_id,
      assigned_artist_name: body.assigned_artist_name,
      software: body.software || 'Maya',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryAssets = [newAsset, ...inMemoryAssets];
    return HttpResponse.json(newAsset, { status: 201 });
  }),

  // PATCH /api/v1/assets/:id/
  http.patch('*/api/v1/assets/:id/', async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Asset>;
    const idx = inMemoryAssets.findIndex((a) => a.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Asset not found' }, { status: 404 });
    }

    inMemoryAssets[idx] = {
      ...inMemoryAssets[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryAssets[idx]);
  }),
];
