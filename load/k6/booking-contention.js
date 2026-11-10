// 100 virtual customers try to hold the same 10 slots at the same instant.
// Seed: business 'chaos-barbers' has exactly 10 NON-overlapping open slots (pnpm db:seed --chaos).
// Pass = exactly 10 holds succeed, everyone else gets SLOT_TAKEN (409), no 5xx.

import { check } from 'k6';
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const API = __ENV.API_URL || 'http://localhost:4000';
const SLUG = __ENV.SLUG || 'chaos-barbers';

const holdsOk = new Counter('holds_ok');
const slotTaken = new Counter('slot_taken');

export const options = {
  scenarios: {
    stampede: { executor: 'per-vu-iterations', vus: 100, iterations: 1, maxDuration: '60s' },
  },
  thresholds: {
    holds_ok: ['count==10'],
    http_req_failed: ['rate<0.001'], // 409 is marked as expected below, so only 5xx/timeouts count
    'http_req_duration{name:hold}': ['p(95)<400'],
  },
};

export function setup() {
  http.post(`${API}/internal/chaos/reset`, null, {
    headers: { 'x-chaos-token': __ENV.CHAOS_TOKEN || 'local-chaos' },
  });
  const res = http.get(`${API}/public/${SLUG}/slots?service=low-cut&limit=10`);
  const slots = res.json('slots');
  if (slots?.length !== 10) throw new Error(`expected 10 seeded slots, got ${slots?.length}`);
  return { slots };
}

export default function ({ slots }) {
  const slot = slots[(__VU - 1) % 10]; // 10 customers per slot
  const res = http.post(
    `${API}/public/${SLUG}/holds`,
    JSON.stringify({
      serviceId: slot.serviceId,
      staffId: slot.staffId,
      startsAt: slot.startsAt,
      customer: { name: `Bot ${__VU}`, phone: `+23480000${String(__VU).padStart(5, '0')}` },
      idempotencyKey: `k6-${__VU}`,
    }),
    {
      headers: { 'content-type': 'application/json' },
      tags: { name: 'hold' },
      responseCallback: http.expectedStatuses(201, 409),
    },
  );
  if (res.status === 201) holdsOk.add(1);
  if (res.status === 409) slotTaken.add(1);
  check(res, { 'ok or slot taken': (r) => r.status === 201 || r.status === 409 });
}
