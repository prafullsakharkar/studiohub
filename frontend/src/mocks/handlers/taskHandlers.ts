import { http, HttpResponse } from 'msw';
import { mockTasks, Task } from '../db/tasks/tasks';
import { delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryTasks = [...mockTasks];

export const taskHandlers = [
  // GET /api/v1/tasks/
  http.get('*/api/v1/tasks/', async ({ request }) => {
    await delay(160);
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const projectId = url.searchParams.get('project_id');
    const entityType = url.searchParams.get('entity_type');
    const entityId = url.searchParams.get('entity_id');
    const department = url.searchParams.get('department');
    const teamId = url.searchParams.get('team_id');
    const assigneeId = url.searchParams.get('assignee_id');
    const vendorId = url.searchParams.get('vendor_id');
    const status = url.searchParams.get('status');
    const priority = url.searchParams.get('priority');
    const isArchived = url.searchParams.get('is_archived');

    let filtered = [...inMemoryTasks];

    if (isArchived === 'true') {
      filtered = filtered.filter((t) => t.is_archived === true);
    } else if (isArchived === 'false' || isArchived === null) {
      filtered = filtered.filter((t) => !t.is_archived);
    }

    if (projectId && projectId !== 'ALL') {
      filtered = filtered.filter((t) => t.project_id === projectId);
    }
    if (entityType && entityType !== 'ALL') {
      filtered = filtered.filter((t) => t.entity_type === entityType);
    }
    if (entityId && entityId !== 'ALL') {
      filtered = filtered.filter((t) => t.entity_id === entityId);
    }
    if (department && department !== 'ALL') {
      filtered = filtered.filter(
        (t) => t.department === department || t.department_id === department || t.department_code === department
      );
    }
    if (teamId && teamId !== 'ALL') {
      filtered = filtered.filter((t) => t.team_id === teamId);
    }
    if (assigneeId && assigneeId !== 'ALL') {
      filtered = filtered.filter((t) => t.assignee_id === assigneeId);
    }
    if (vendorId && vendorId !== 'ALL') {
      filtered = filtered.filter((t) => t.vendor_id === vendorId);
    }
    if (status && status !== 'ALL') {
      filtered = filtered.filter((t) => t.status === status);
    }
    if (priority && priority !== 'ALL') {
      filtered = filtered.filter((t) => t.priority === priority);
    }

    if (search) {
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(search) ||
          t.code.toLowerCase().includes(search) ||
          t.entity_code.toLowerCase().includes(search) ||
          (t.entity_name && t.entity_name.toLowerCase().includes(search)) ||
          (t.assignee_name && t.assignee_name.toLowerCase().includes(search)) ||
          t.department.toLowerCase().includes(search) ||
          t.software.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search)
      );
    }

    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/tasks/:id/
  http.get('*/api/v1/tasks/:id/', async ({ params }) => {
    await delay(120);
    const task = inMemoryTasks.find((t) => t.id === params.id);
    if (!task) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 });
    }
    return HttpResponse.json(task);
  }),

  // POST /api/v1/tasks/
  http.post('*/api/v1/tasks/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<Task>;
    const newTask: Task = {
      id: `task-${Date.now()}`,
      title: body.title || 'Untitled Production Task',
      code: body.code || `TSK-${body.department_code || 'GEN'}-${Math.floor(Math.random() * 9000 + 1000)}`,
      project_id: body.project_id || 'proj-001',
      project_code: body.project_code || 'NK99',
      project_name: body.project_name || 'Cyberpunk 2099: Neo-Kyoto',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      entity_name: body.entity_name || 'Hero Spinner Dive Through Neon Canyon',
      department: body.department || 'FX & Simulation',
      department_id: body.department_id || 'dept-05',
      department_code: body.department_code || 'FX',
      team_id: body.team_id || 'team-01',
      team_name: body.team_name || 'Alpha FX Squad',
      assignee_id: body.assignee_id || 'usr-003',
      assignee_name: body.assignee_name || 'Elena Rostova',
      assignee_avatar: body.assignee_avatar || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
      assignee_role: body.assignee_role || 'Lead Artist',
      reviewer_id: body.reviewer_id || 'usr-001',
      reviewer_name: body.reviewer_name || 'Alex Chen',
      reviewer_avatar: body.reviewer_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      vendor_id: body.vendor_id,
      vendor_name: body.vendor_name,
      vendor_code: body.vendor_code,
      workflow: body.workflow || {
        stage_name: 'Production Execution',
        step_name: 'Initial Working Pass',
        step_number: 1,
        total_steps: 4,
        pipeline_template: 'Standard Production Flow v1',
      },
      status: body.status || 'Not Started',
      priority: body.priority || 'Medium',
      schedule: body.schedule || {
        start_date: new Date().toISOString().split('T')[0],
        due_date: body.due_date || '2026-09-15',
        estimated_hours: body.estimated_hours || 32,
        logged_hours: 0,
        progress_percent: 0,
        milestone: 'First Version Delivery',
        overrun_risk: false,
      },
      dependencies: body.dependencies || {
        upstream_task_ids: [],
        downstream_task_ids: [],
      },
      description: body.description || '',
      software: body.software || 'Houdini 20.5',
      tags: body.tags || ['Task', 'VFX'],
      is_archived: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      due_date: body.due_date || '2026-09-15',
      estimated_hours: body.estimated_hours || 32,
      logged_hours: 0,
    };

    inMemoryTasks = [newTask, ...inMemoryTasks];
    return HttpResponse.json(newTask, { status: 201 });
  }),

  // PATCH /api/v1/tasks/:id/
  http.patch('*/api/v1/tasks/:id/', async ({ params, request }) => {
    await delay(180);
    const body = (await request.json()) as Partial<Task>;
    const idx = inMemoryTasks.findIndex((t) => t.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Task not found' }, { status: 404 });
    }

    const current = inMemoryTasks[idx];
    const updatedSchedule = body.schedule
      ? { ...current.schedule, ...body.schedule }
      : {
          ...current.schedule,
          due_date: body.due_date || current.schedule.due_date,
          estimated_hours: body.estimated_hours !== undefined ? body.estimated_hours : current.schedule.estimated_hours,
          logged_hours: body.logged_hours !== undefined ? body.logged_hours : current.schedule.logged_hours,
        };

    inMemoryTasks[idx] = {
      ...current,
      ...body,
      schedule: updatedSchedule,
      due_date: updatedSchedule.due_date,
      estimated_hours: updatedSchedule.estimated_hours,
      logged_hours: updatedSchedule.logged_hours,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryTasks[idx]);
  }),

  // DELETE /api/v1/tasks/:id/
  http.delete('*/api/v1/tasks/:id/', async ({ params }) => {
    await delay(150);
    inMemoryTasks = inMemoryTasks.filter((t) => t.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/v1/tasks/bulk-assign/
  http.post('*/api/v1/tasks/bulk-assign/', async ({ request }) => {
    await delay(220);
    const { task_ids, assignee_id, assignee_name, assignee_avatar, assignee_role, team_id, team_name } = (await request.json()) as any;
    
    inMemoryTasks = inMemoryTasks.map((task) => {
      if (task_ids.includes(task.id)) {
        return {
          ...task,
          assignee_id: assignee_id !== undefined ? assignee_id : task.assignee_id,
          assignee_name: assignee_name !== undefined ? assignee_name : task.assignee_name,
          assignee_avatar: assignee_avatar !== undefined ? assignee_avatar : task.assignee_avatar,
          assignee_role: assignee_role !== undefined ? assignee_role : task.assignee_role,
          team_id: team_id !== undefined ? team_id : task.team_id,
          team_name: team_name !== undefined ? team_name : task.team_name,
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });

    return HttpResponse.json({ success: true, updated_count: task_ids.length });
  }),

  // POST /api/v1/tasks/bulk-status/
  http.post('*/api/v1/tasks/bulk-status/', async ({ request }) => {
    await delay(200);
    const { task_ids, status } = (await request.json()) as any;

    inMemoryTasks = inMemoryTasks.map((task) => {
      if (task_ids.includes(task.id)) {
        return {
          ...task,
          status,
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });

    return HttpResponse.json({ success: true, updated_count: task_ids.length });
  }),

  // POST /api/v1/tasks/bulk-archive/
  http.post('*/api/v1/tasks/bulk-archive/', async ({ request }) => {
    await delay(200);
    const { task_ids, is_archived } = (await request.json()) as any;

    inMemoryTasks = inMemoryTasks.map((task) => {
      if (task_ids.includes(task.id)) {
        return {
          ...task,
          is_archived: is_archived !== undefined ? is_archived : true,
          updated_at: new Date().toISOString(),
        };
      }
      return task;
    });

    return HttpResponse.json({ success: true, updated_count: task_ids.length });
  }),

  // POST /api/v1/tasks/bulk-delete/
  http.post('*/api/v1/tasks/bulk-delete/', async ({ request }) => {
    await delay(200);
    const { task_ids } = (await request.json()) as any;

    inMemoryTasks = inMemoryTasks.filter((t) => !task_ids.includes(t.id));
    return HttpResponse.json({ success: true, deleted_count: task_ids.length });
  }),
];
