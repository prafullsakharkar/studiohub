import { http, HttpResponse } from 'msw';
import { mockProjects, Project } from '../db/production/projects';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryProjects = [...mockProjects];

export const projectHandlers = [
  // GET /api/v1/projects/
  http.get('*/api/v1/projects/', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryProjects, url, ['name', 'code', 'description', 'client_name']);
    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/projects/:id/
  http.get('*/api/v1/projects/:id/', async ({ params }) => {
    await delay(150);
    const project = inMemoryProjects.find((p) => p.id === params.id);
    if (!project) {
      return HttpResponse.json({ detail: 'Project not found' }, { status: 404 });
    }
    return HttpResponse.json(project);
  }),

  // POST /api/v1/projects/
  http.post('*/api/v1/projects/', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as Partial<Project>;

    if (!body.name || !body.code) {
      return HttpResponse.json(
        {
          name: !body.name ? ['This field is required.'] : undefined,
          code: !body.code ? ['This field is required.'] : undefined,
        },
        { status: 400 }
      );
    }

    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: body.name,
      code: body.code.toUpperCase(),
      type: body.type || 'Feature Film',
      description: body.description || '',
      status: body.status || 'In Progress',
      fps: body.fps || 24,
      resolution: body.resolution || '4096x2160 (4K DCI)',
      aspect_ratio: body.aspect_ratio || '2.39:1',
      color_space: body.color_space || 'ACEScg',
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      delivery_date: body.delivery_date || '2027-01-01',
      thumbnail_url: body.thumbnail_url || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
      total_shots: body.total_shots || 0,
      approved_shots: 0,
      in_progress_shots: 0,
      total_assets: 0,
      budget_usd: body.budget_usd || 1000000,
      supervisor_id: body.supervisor_id || 'usr-001',
      supervisor_name: body.supervisor_name || 'Alex Chen',
      coordinator_id: body.coordinator_id || 'usr-002',
      coordinator_name: body.coordinator_name || 'Marcus Vance',
      client_name: body.client_name || 'Warner Nexus Studios',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryProjects = [newProject, ...inMemoryProjects];
    return HttpResponse.json(newProject, { status: 201 });
  }),

  // PATCH /api/v1/projects/:id/
  http.patch('*/api/v1/projects/:id/', async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Project>;
    const idx = inMemoryProjects.findIndex((p) => p.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Project not found' }, { status: 404 });
    }

    inMemoryProjects[idx] = {
      ...inMemoryProjects[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryProjects[idx]);
  }),

  // DELETE /api/v1/projects/:id/
  http.delete('*/api/v1/projects/:id/', async ({ params }) => {
    await delay(200);
    inMemoryProjects = inMemoryProjects.filter((p) => p.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
