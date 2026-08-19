import { http, HttpResponse } from 'msw';
import { mockTasks, Task } from '../db/tasks/tasks';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryTasks = [...mockTasks];

export const taskHandlers = [
  // GET /api/v1/tasks/
  http.get('*/api/v1/tasks/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryTasks, url, ['title', 'code', 'entity_code', 'assignee_name', 'department']);
    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/tasks/:id/
  http.get('*/api/v1/tasks/:id/', async ({ params }) => {
    await delay(150);
    const task = inMemoryTasks.find((t) => t.id === params.id);
    if (!task) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  // POST /api/v1/tasks/
  http.post('*/api/v1/tasks/', async ({ request }) => {
    await delay(250);
    const body = (await request.json()) as Partial<Task>;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: body.title || 'Untitled Task',
      code: `TSK-${Math.floor(Math.random() * 9000 + 1000)}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      department: body.department || 'FX & Simulation',
      status: body.status || 'Ready to Start' as any,
      priority: body.priority || 'Medium',
      assignee_id: body.assignee_id,
      assignee_name: body.assignee_name,
      assignee_avatar: body.assignee_avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      reviewer_id: 'usr-001',
      reviewer_name: 'Alex Chen',
      due_date: body.due_date || '2026-09-01',
      estimated_hours: body.estimated_hours || 24,
      logged_hours: 0,
      description: body.description || '',
      software: body.software || 'Houdini 20.5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryTasks = [newTask, ...inMemoryTasks];
    return HttpResponse.json(newTask, { status: 201 });
  }),

  // PATCH /api/v1/tasks/:id/
  http.patch('*/api/v1/tasks/:id/', async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Task>;
    const idx = inMemoryTasks.findIndex((t) => t.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 });
    }

    inMemoryTasks[idx] = {
      ...inMemoryTasks[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryTasks[idx]);
  }),
];
