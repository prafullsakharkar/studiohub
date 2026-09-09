import { http, HttpResponse } from 'msw';
import { mockAuditLogs, AuditLog } from '../db/audit/auditLogs';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryAuditLogs = [...mockAuditLogs];

export const auditHandlers = [
  // GET /api/v1/audit/
  http.get('*/api/v1/audit/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryAuditLogs, url, ['user_name', 'user_email', 'action', 'entity_type', 'entity_code', 'description']);
    const paginated = paginateDRF(filtered, url, 15);
    return HttpResponse.json(paginated);
  }),

  // POST /api/v1/audit/
  http.post('*/api/v1/audit/', async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as Partial<AuditLog>;
    const newLog: AuditLog = {
      id: `aud-${Date.now()}`,
      user_id: body.user_id || 'usr-001',
      user_name: body.user_name || 'Alex Chen',
      user_email: body.user_email || 'supervisor@studiohub.vfx',
      action: body.action || 'UPDATE',
      entity_type: body.entity_type || 'Shot',
      entity_id: body.entity_id || 'shot-001',
      entity_code: body.entity_code || 'NK_010_010',
      description: body.description || 'Action performed in StudioHub.',
      ip_address: '192.168.10.45',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    inMemoryAuditLogs = [newLog, ...inMemoryAuditLogs];
    return HttpResponse.json(newLog, { status: 201 });
  }),
];
