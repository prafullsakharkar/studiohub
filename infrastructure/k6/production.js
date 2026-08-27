import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';
const TOKEN = __ENV.API_TOKEN || '';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
    'X-Organization-Id': __ENV.ORG_ID || '',
  };

  // Projects list (paginated, search)
  let res = http.get(`${BASE_URL}/api/v1/projects/?page=1&page_size=50&search=`, { headers });
  check(res, { 'projects 200': (r) => r.status === 200, 'projects paginated': (r) => r.json('count') !== undefined });

  // Shots list
  res = http.get(`${BASE_URL}/api/v1/shots/?page=1&page_size=50`, { headers });
  check(res, { 'shots 200': (r) => r.status === 200 });

  // Tasks list with filters
  res = http.get(`${BASE_URL}/api/v1/tasks/?status=In%20Progress&page_size=50`, { headers });
  check(res, { 'tasks 200': (r) => r.status === 200 });

  // Assets
  res = http.get(`${BASE_URL}/api/v1/assets/?page=1&page_size=50`, { headers });
  check(res, { 'assets 200': (r) => r.status === 200 });

  sleep(1);
}
