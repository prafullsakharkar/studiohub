import { http, HttpResponse } from 'msw';
import { mockReviews, ReviewSession, ReviewAnnotation } from '../db/reviews/reviews';
import { applyFiltersAndSearch, delay, paginateDRF } from '../utils/mockServerHelpers';

let inMemoryReviews = [...mockReviews];

export const reviewHandlers = [
  // GET /api/v1/reviews/
  http.get('*/api/v1/reviews/', async ({ request }) => {
    await delay(180);
    const url = new URL(request.url);
    const filtered = applyFiltersAndSearch(inMemoryReviews, url, ['title', 'code', 'entity_code', 'lead_reviewer_name']);
    const paginated = paginateDRF(filtered, url);
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/reviews/:id/
  http.get('*/api/v1/reviews/:id/', async ({ params }) => {
    await delay(150);
    const review = inMemoryReviews.find((r) => r.id === params.id);
    if (!review) {
      return HttpResponse.json({ detail: 'Review session not found' }, { status: 404 });
    }
    return HttpResponse.json(review);
  }),

  // POST /api/v1/reviews/:id/annotations/
  http.post('*/api/v1/reviews/:id/annotations/', async ({ params, request }) => {
    await delay(200);
    const body = (await request.json()) as Partial<ReviewAnnotation>;
    const idx = inMemoryReviews.findIndex((r) => r.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Review session not found' }, { status: 404 });
    }

    const newAnnotation: ReviewAnnotation = {
      id: `ann-${Date.now()}`,
      frame_number: body.frame_number || 1,
      timecode: body.timecode || '01:00:00:00',
      author_name: body.author_name || 'Alex Chen (Supervisor)',
      comment: body.comment || '',
      drawing_coordinates: body.drawing_coordinates,
      created_at: new Date().toISOString(),
    };

    inMemoryReviews[idx].annotations.push(newAnnotation);
    inMemoryReviews[idx].updated_at = new Date().toISOString();

    return HttpResponse.json(newAnnotation, { status: 201 });
  }),

  // POST /api/v1/reviews/:id/verdict/
  http.post('*/api/v1/reviews/:id/verdict/', async ({ params, request }) => {
    await delay(250);
    const body = (await request.json()) as { verdict: 'Approved' | 'Retake' | 'Pending Review'; notes?: string };
    const idx = inMemoryReviews.findIndex((r) => r.id === params.id);
    if (idx === -1) {
      return HttpResponse.json({ detail: 'Review session not found' }, { status: 404 });
    }

    inMemoryReviews[idx] = {
      ...inMemoryReviews[idx],
      status: body.verdict === 'Approved' ? 'Approved' : body.verdict === 'Retake' ? 'Retake' : 'Pending Review',
      supervisor_verdict: body.verdict,
      supervisor_notes: body.notes || inMemoryReviews[idx].supervisor_notes,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(inMemoryReviews[idx]);
  }),
];
