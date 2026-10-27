import { getRange } from './date-filter.js';
import { redirectToLogin } from './auth.js';

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  if (res.status === 401) return redirectToLogin(); // session expired or revoked
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(payload.error || `เกิดข้อผิดพลาด (HTTP ${res.status})`);
    err.details = payload.details;
    throw err;
  }
  return payload;
}

const rangeQuery = () => {
  const { from, to } = getRange();
  const params = new URLSearchParams(Object.entries({ from, to }).filter(([, v]) => v));
  return params.toString() ? `?${params}` : '';
};

let optionsPromise = null;

export const api = {
  options: () => (optionsPromise ||= request('GET', '/api/options')),
  dashboard: () => request('GET', `/api/dashboard${rangeQuery()}`),
  /** Lists a resource, filtered by the global date range unless `ranged: false`. */
  list: (resource, { ranged = true } = {}) => request('GET', `/api/${resource}${ranged ? rangeQuery() : ''}`),
  get: (resource, id) => request('GET', `/api/${resource}/${encodeURIComponent(id)}`),
  create: (resource, data) => request('POST', `/api/${resource}`, data),
  update: (resource, id, data) => request('PUT', `/api/${resource}/${encodeURIComponent(id)}`, data),
  remove: (resource, id) => request('DELETE', `/api/${resource}/${encodeURIComponent(id)}`),
};
