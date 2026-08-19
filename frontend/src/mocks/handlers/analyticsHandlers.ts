import { http, HttpResponse } from 'msw';
import { mockProductionKpis, mockDepartmentProgress } from '../db/analytics/metrics';
import { mockOrganization } from '../db/organization/organization';
import { delay } from '../utils/mockServerHelpers';

export const analyticsHandlers = [
  // GET /api/v1/analytics/kpis/
  http.get('*/api/v1/analytics/kpis/', async () => {
    await delay(150);
    return HttpResponse.json(mockProductionKpis);
  }),

  // GET /api/v1/analytics/departments/
  http.get('*/api/v1/analytics/departments/', async () => {
    await delay(150);
    return HttpResponse.json(mockDepartmentProgress);
  }),

  // GET /api/v1/organization/
  http.get('*/api/v1/organization/', async () => {
    await delay(150);
    return HttpResponse.json(mockOrganization);
  }),
];
