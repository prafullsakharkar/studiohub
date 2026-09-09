import { http, HttpResponse } from 'msw';
import { mockTimelogs, Timelog } from '../db/tasks/timelogs';
import { mockTasks } from '../db/tasks/tasks';
import { delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryTimelogs: Timelog[] = [...mockTimelogs];

export const timelogHandlers = [
  // GET /api/v1/timelogs/
  http.get('*/api/v1/timelogs/', async ({ request }) => {
    await delay(150);
    const url = new URL(request.url);
    const taskId = url.searchParams.get('task_id');
    const personId = url.searchParams.get('person_id');
    const projectId = url.searchParams.get('project_id');
    const status = url.searchParams.get('status');
    const billable = url.searchParams.get('billable');
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const search = url.searchParams.get('search')?.toLowerCase();

    let filtered = [...inMemoryTimelogs];

    if (taskId && taskId !== 'ALL') {
      filtered = filtered.filter((t) => t.task_id === taskId);
    }
    if (personId && personId !== 'ALL') {
      filtered = filtered.filter((t) => t.person_id === personId);
    }
    if (projectId && projectId !== 'ALL') {
      filtered = filtered.filter((t) => t.project_id === projectId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (billable !== null && billable !== undefined && billable !== 'ALL') {
      const isBillable = billable === 'true';
      filtered = filtered.filter((t) => t.billable === isBillable);
    }
    if (startDate) {
      filtered = filtered.filter((t) => t.date >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter((t) => t.date <= endDate);
    }
    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.task_title.toLowerCase().includes(search) ||
          t.task_code.toLowerCase().includes(search) ||
          t.person_name.toLowerCase().includes(search) ||
          t.project_code.toLowerCase().includes(search) ||
          t.notes.toLowerCase().includes(search)
      );
    }

    // Sort by date desc
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/timelogs/:id/
  http.get('*/api/v1/timelogs/:id/', async ({ params }) => {
    await delay(100);
    const log = inMemoryTimelogs.find((l) => l.id === params.id);
    if (!log) {
      return HttpResponse.json({ detail: 'Timelog not found' }, { status: 404 });
    }
    return HttpResponse.json(log);
  }),

  // POST /api/v1/timelogs/
  http.post('*/api/v1/timelogs/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Timelog>;
    const task = mockTasks.find((t) => t.id === body.task_id) || {
      code: body.task_code || 'TSK-GEN-001',
      title: body.task_title || 'General Production Task',
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      project_name: body.project_name || 'Cyberpunk 2099: Neo-Kyoto',
      department: body.department || 'FX & Simulation',
    };

    const newLog: Timelog = {
      id: `time-${Date.now()}`,
      task_id: body.task_id || 'task-001',
      task_code: body.task_code || task.code,
      task_title: body.task_title || task.title,
      project_id: body.project_id || task.project_id,
      project_code: body.project_code || task.project_code,
      project_name: body.project_name || (task as any).project_name || task.project_code,
      person_id: body.person_id || 'usr-001',
      person_name: body.person_name || 'Alex Chen',
      person_avatar: body.person_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      person_role: body.person_role || 'VFX Supervisor',
      department: body.department || task.department,
      duration_hours: Number(body.duration_hours) || 1.0,
      date: body.date || new Date().toISOString().split('T')[0],
      billable: body.billable !== undefined ? body.billable : true,
      notes: body.notes || '',
      status: body.status || 'Submitted',
      activity_category: body.activity_category || 'Direct Work',
      hourly_rate_usd: body.hourly_rate_usd || 110,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryTimelogs = [newLog, ...inMemoryTimelogs];
    return HttpResponse.json(newLog, { status: 201 });
  }),

  // PATCH /api/v1/timelogs/:id/
  http.patch('*/api/v1/timelogs/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Timelog>;
    const idx = inMemoryTimelogs.findIndex((l) => l.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Timelog not found' }, { status: 404 });
    }

    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryTimelogs[idx]);
  }),

  // DELETE /api/v1/timelogs/:id/
  http.delete('*/api/v1/timelogs/:id/', async ({ params }) => {
    await delay(150);
    inMemoryTimelogs = inMemoryTimelogs.filter((l) => l.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/v1/timelogs/:id/approve/
  http.post('*/api/v1/timelogs/:id/approve/', async ({ params, request }) => {
    await delay(150);
    const body = ((await request.json().catch(() => ({}))) as any) || {};
    const idx = inMemoryTimelogs.findIndex((l) => l.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Timelog not found' }, { status: 404 });
    }

    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      status: 'Approved',
      approved_by_id: body.approved_by_id || 'usr-001',
      approved_by_name: body.approved_by_name || 'Alex Chen',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryTimelogs[idx]);
  }),

  // POST /api/v1/timelogs/:id/reject/
  http.post('*/api/v1/timelogs/:id/reject/', async ({ params, request }) => {
    await delay(150);
    const body = ((await request.json().catch(() => ({}))) as any) || {};
    const idx = inMemoryTimelogs.findIndex((l) => l.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Timelog not found' }, { status: 404 });
    }

    inMemoryTimelogs[idx] = {
      ...inMemoryTimelogs[idx],
      status: 'Rejected',
      rejection_reason: body.rejection_reason || 'Needs clarification on logged tasks.',
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryTimelogs[idx]);
  }),
];
