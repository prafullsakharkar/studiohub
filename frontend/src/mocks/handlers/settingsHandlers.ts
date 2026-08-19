import { http, HttpResponse } from 'msw';
import { mockPipelineSettings, PipelineSettings } from '../db/settings/settings';
import { delay } from '../utils/mockServerHelpers';

let inMemorySettings = { ...mockPipelineSettings };

export const settingsHandlers = [
  // GET /api/v1/settings/pipeline/
  http.get('*/api/v1/settings/pipeline/', async () => {
    await delay(120);
    return HttpResponse.json(inMemorySettings);
  }),

  // PATCH /api/v1/settings/pipeline/
  http.patch('*/api/v1/settings/pipeline/', async ({ request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<PipelineSettings>;
    inMemorySettings = {
      ...inMemorySettings,
      ...body,
    };
    return HttpResponse.json(inMemorySettings);
  }),
];
