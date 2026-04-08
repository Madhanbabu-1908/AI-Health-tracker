// API service — session-scoped, all calls go through here

const BASE_URL = import.meta.env.VITE_API_URL || 'https://ai-health-tracker-yycb.onrender.com'

// ─── Session management ──────────────────────────────────────────────────────

export function getSessionId() {
  let sid = localStorage.getItem('health_session_id')
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem('health_session_id', sid)
  }
  return sid
}

export function clearSession() {
  localStorage.removeItem('health_session_id')
  localStorage.removeItem('health_profile')
  localStorage.removeItem('health_goals')
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`)
  return data
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export const profileApi = {
  setup:  (body) => api('/profile/setup', { method: 'POST', body: JSON.stringify(body) }),
  get:    (sid)  => api(`/profile/${sid}`),
  goals:  (sid)  => api(`/goals/${sid}`),
  delete: (sid)  => api(`/session/${sid}`, { method: 'DELETE' }),
}

// ─── Foods ───────────────────────────────────────────────────────────────────

export const foodApi = {
  list:   (sid)        => api(`/foods/${sid}`),
  add:    (sid, item)  => api(`/foods/${sid}`, { method: 'POST', body: JSON.stringify(item) }),
  remove: (sid, id)    => api(`/foods/${sid}/${id}`, { method: 'DELETE' }),
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export const logApi = {
  log:        (sid, body)    => api(`/log/${sid}`, { method: 'POST', body: JSON.stringify(body) }),
  deleteEntry:(sid, entryId) => api(`/log/${sid}/${entryId}`, { method: 'DELETE' }),
  today:      (sid)          => api(`/log/${sid}/today`),
  history:    (sid, days=7)  => api(`/log/${sid}/history?days=${days}`),
}

// ─── Water ───────────────────────────────────────────────────────────────────

export const waterApi = {
  log:   (sid, amount_ml) => api(`/water/${sid}`, { method: 'POST', body: JSON.stringify({ amount_ml }) }),
  today: (sid)            => api(`/water/${sid}/today`),
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  // Pass unit so the backend resolves serving size correctly
  predict: (food_name, quantity = 100, unit = 'g') =>
    api(`/ai/nutrition?food_name=${encodeURIComponent(food_name)}&quantity=${quantity}&unit=${encodeURIComponent(unit)}`),
  predictServing: (food_name, quantity = 1, unit = 'serving') =>
    api(`/ai/nutrition/serving?food_name=${encodeURIComponent(food_name)}&quantity=${quantity}&unit=${encodeURIComponent(unit)}`),
  chat: (sid, query, context = {}) =>
    api('/ai/chat', { method: 'POST', body: JSON.stringify({ session_id: sid, query, context }) }),
}

export const API_BASE_URL = BASE_URL
