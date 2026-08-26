import { http, HttpResponse } from 'msw';
import { mockPublishedVersions } from '../db/organization/organization';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';
import { PublishedVersion } from '@/types/organization';

let inMemoryVersions = [...mockPublishedVersions];

export const versionHandlers = [
  // GET /api/v1/versions/
  http.get('*/api/v1/versions/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryVersions, url, [
      'entity_code',
      'version_number',
      'published_by_name',
      'notes',
      'department',
    ]);
    return HttpResponse.json(paginateDRF(filtered, url, 12));
  }),

  // GET /api/v1/versions/:id/
  http.get('*/api/v1/versions/:id/', async ({ params }) => {
    await delay(120);
    const version = inMemoryVersions.find((v) => v.id === params.id);
    if (!version) return HttpResponse.json({ detail: 'Version not found' }, { status: 404 });
    return HttpResponse.json(version);
  }),

  // POST /api/v1/versions/
  http.post('*/api/v1/versions/', async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<PublishedVersion>;

    if (!body.entity_code || !body.version_number) {
      return HttpResponse.json(
        {
          entity_code: !body.entity_code ? ['Entity code is required.'] : undefined,
          version_number: !body.version_number ? ['Version number is required (e.g. v004).'] : undefined,
        },
        { status: 400 }
      );
    }

    const newVersion: PublishedVersion = {
      id: `ver-${Date.now()}`,
      organization_id: body.organization_id || 'org-apex-01',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code,
      version_number: body.version_number,
      department: body.department || 'Lighting & Lookdev',
      published_by_name: body.published_by_name || 'Alex Chen',
      published_by_avatar: body.published_by_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      status: body.status || 'Pending Review',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      file_path: body.file_path || `/shows/NK99/shots/${body.entity_code}/publish/${body.version_number}/comp.mov`,
      usd_stage_path: body.usd_stage_path || `@./layers/${body.version_number}/payload.usda@`,
      frame_range: body.frame_range || '1001-1120',
      file_size_mb: body.file_size_mb || 480,
      notes: body.notes || 'Published via OpenUSD StudioHub submitter.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryVersions = [newVersion, ...inMemoryVersions];
    return HttpResponse.json(newVersion, { status: 201 });
  }),

  // PATCH /api/v1/versions/:id/
  http.patch('*/api/v1/versions/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<PublishedVersion>;
    const idx = inMemoryVersions.findIndex((v) => v.id === params.id);
    if (idx === -1) return HttpResponse.json({ detail: 'Version not found' }, { status: 404 });
    inMemoryVersions[idx] = { ...inMemoryVersions[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(inMemoryVersions[idx]);
  }),

  // POST /api/v1/versions/:id/promote/
  http.post('*/api/v1/versions/:id/promote/', async ({ params }) => {
    await delay(200);
    const idx = inMemoryVersions.findIndex((v) => v.id === params.id);
    if (idx === -1) return HttpResponse.json({ detail: 'Version not found' }, { status: 404 });
    inMemoryVersions[idx] = {
      ...inMemoryVersions[idx],
      status: 'Approved',
      notes: `${inMemoryVersions[idx].notes} • [Promoted to Hero Master]`,
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json(inMemoryVersions[idx]);
  }),

  // DELETE /api/v1/versions/:id/
  http.delete('*/api/v1/versions/:id/', async ({ params }) => {
    await delay(180);
    inMemoryVersions = inMemoryVersions.filter((v) => v.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
