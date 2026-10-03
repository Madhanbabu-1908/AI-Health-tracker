/**
 * healthConnect.js — Health Connect integration service
 *
 * Architecture:
 *   HealthDataProvider (abstract interface)
 *     └── HealthConnectProvider  ← implemented here via Capacitor plugin bridge
 *
 * The Capacitor plugin "HealthConnectPlugin" is a local Kotlin plugin
 * registered in MainActivity. On web/desktop it gracefully degrades.
 *
 * NEVER call Health Connect directly from browser JS.
 * All HC calls go through window.HealthConnectPlugin (injected by Capacitor bridge).
 */

import { API_BASE_URL } from './api.js'

// ─── Platform detection ───────────────────────────────────────────────────────

export function isAndroidApp() {
  return typeof window !== 'undefined' &&
    (window.Capacitor?.isNativePlatform?.() ||
     window.location.protocol === 'capacitor:' ||
     navigator.userAgent.includes('wv'))
}

function getPlugin() {
  return window?.HealthConnectPlugin ?? null
}

// ─── Availability states ──────────────────────────────────────────────────────

export const HC_STATUS = {
  AVAILABLE:      'AVAILABLE',
  NOT_INSTALLED:  'NOT_INSTALLED',
  NOT_SUPPORTED:  'NOT_SUPPORTED',
  UNKNOWN:        'UNKNOWN',
}

// ─── HealthDataProvider interface (documents the contract) ───────────────────
// Future providers (GoogleHealth, Garmin, AppleHealth) must implement:
//   checkAvailability() → HC_STATUS
//   requestPermissions() → { granted: string[] }
//   getPermissionStatus() → { granted: string[] }
//   readMetrics(startTime, endTime) → HealthRecord[]
//   readSleepSessions(startTime, endTime) → SleepSession[]
//   readWorkouts(startTime, endTime) → Workout[]

// ─── HealthConnectProvider ────────────────────────────────────────────────────

export const HealthConnectProvider = {
  name: 'health_connect',

  async checkAvailability() {
    const plugin = getPlugin()
    if (!plugin) return HC_STATUS.NOT_SUPPORTED
    try {
      const res = await plugin.checkAvailability()
      return res.status ?? HC_STATUS.UNKNOWN
    } catch {
      return HC_STATUS.UNKNOWN
    }
  },

  async requestPermissions() {
    const plugin = getPlugin()
    if (!plugin) throw new Error('Health Connect not available on this platform')
    return plugin.requestPermissions({
      permissions: [
        'android.permission.health.READ_STEPS',
        'android.permission.health.READ_DISTANCE',
        'android.permission.health.READ_HEART_RATE',
        'android.permission.health.READ_RESTING_HEART_RATE',
        'android.permission.health.READ_HEART_RATE_VARIABILITY',
        'android.permission.health.READ_OXYGEN_SATURATION',
        'android.permission.health.READ_RESPIRATORY_RATE',
        'android.permission.health.READ_SLEEP',
        'android.permission.health.READ_EXERCISE',
        'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
        'android.permission.health.READ_TOTAL_CALORIES_BURNED',
        'android.permission.health.READ_FLOORS_CLIMBED',
        'android.permission.health.READ_VO2_MAX',
        'android.permission.health.READ_SKIN_TEMPERATURE',
      ],
    })
  },

  async getPermissionStatus() {
    const plugin = getPlugin()
    if (!plugin) return { granted: [] }
    try {
      return await plugin.getGrantedPermissions()
    } catch {
      return { granted: [] }
    }
  },

  async openSettings() {
    const plugin = getPlugin()
    if (!plugin) return
    try {
      await plugin.openHealthConnectSettings()
    } catch (e) {
      console.warn('[HC] openSettings error:', e.message)
    }
  },

  async readMetrics(startTime, endTime) {
    const plugin = getPlugin()
    if (!plugin) return []
    try {
      const res = await plugin.readHealthData({ startTime, endTime })
      return (res.records ?? []).map(normalizeMetric)
    } catch (e) {
      console.warn('[HC] readMetrics error:', e.message)
      return []
    }
  },

  async readSleepSessions(startTime, endTime) {
    const plugin = getPlugin()
    if (!plugin) return []
    try {
      const res = await plugin.readSleepSessions({ startTime, endTime })
      return (res.sessions ?? []).map(normalizeSleep)
    } catch (e) {
      console.warn('[HC] readSleepSessions error:', e.message)
      return []
    }
  },

  async readWorkouts(startTime, endTime) {
    const plugin = getPlugin()
    if (!plugin) return []
    try {
      const res = await plugin.readWorkouts({ startTime, endTime })
      return (res.workouts ?? []).map(normalizeWorkout)
    } catch (e) {
      console.warn('[HC] readWorkouts error:', e.message)
      return []
    }
  },
}

// ─── Normalization ────────────────────────────────────────────────────────────
// Maps raw HC plugin records → Nalamudan internal format.
// Never stores HC-specific field names in the app.

function normalizeMetric(raw) {
  return {
    provider:    'health_connect',
    source:      raw.dataOrigin ?? null,
    device:      raw.device ?? null,
    metric_type: raw.type,           // already mapped by Kotlin plugin
    value:       raw.value ?? null,
    unit:        raw.unit ?? null,
    start_time:  raw.startTime,
    end_time:    raw.endTime ?? null,
    source_id:   raw.uid ?? null,
    metadata:    raw.metadata ?? null,
  }
}

function normalizeSleep(raw) {
  return {
    provider:             'health_connect',
    source:               raw.dataOrigin ?? null,
    device:               raw.device ?? null,
    start_time:           raw.startTime,
    end_time:             raw.endTime,
    duration_minutes:     raw.durationMinutes ?? null,
    awake_minutes:        raw.awakeMinutes ?? null,
    light_sleep_minutes:  raw.lightSleepMinutes ?? null,
    deep_sleep_minutes:   raw.deepSleepMinutes ?? null,
    rem_sleep_minutes:    raw.remSleepMinutes ?? null,
    source_id:            raw.uid ?? null,
  }
}

function normalizeWorkout(raw) {
  return {
    provider:         'health_connect',
    source:           raw.dataOrigin ?? null,
    device:           raw.device ?? null,
    exercise_type:    raw.exerciseType ?? null,
    start_time:       raw.startTime,
    end_time:         raw.endTime,
    duration_minutes: raw.durationMinutes ?? null,
    active_calories:  raw.activeCalories ?? null,
    distance_km:      raw.distanceKm ?? null,
    avg_heart_rate:   raw.avgHeartRate ?? null,
    source_id:        raw.uid ?? null,
  }
}

// ─── Sync engine ──────────────────────────────────────────────────────────────

const SYNC_STATE_KEY = 'hc_last_sync_at'
const INITIAL_DAYS   = 30
const OVERLAP_HOURS  = 2   // re-query 2h before last sync to catch late records

function getSyncWindow() {
  const stored = localStorage.getItem(SYNC_STATE_KEY)
  if (stored) {
    // Incremental: from (lastSync - overlap) to now
    const from = new Date(new Date(stored).getTime() - OVERLAP_HOURS * 3600 * 1000)
    return { startTime: from.toISOString(), endTime: new Date().toISOString(), incremental: true }
  }
  // Initial: last 30 days
  const from = new Date(Date.now() - INITIAL_DAYS * 86400 * 1000)
  return { startTime: from.toISOString(), endTime: new Date().toISOString(), incremental: false }
}

function saveSyncTimestamp(ts) {
  localStorage.setItem(SYNC_STATE_KEY, ts)
}

export function clearSyncState() {
  localStorage.removeItem(SYNC_STATE_KEY)
}

/**
 * Full sync pipeline:
 * 1. Read from Health Connect (on-device)
 * 2. Normalize
 * 3. POST to backend (backend deduplicates by source_id)
 * 4. Save last sync timestamp locally
 *
 * onProgress(step, done) — called for each phase
 */
export async function syncHealthData(sessionId, { onProgress } = {}) {
  const progress = onProgress ?? (() => {})
  const { startTime, endTime } = getSyncWindow()

  progress('reading', false)
  const [metrics, sleep, workouts] = await Promise.all([
    HealthConnectProvider.readMetrics(startTime, endTime),
    HealthConnectProvider.readSleepSessions(startTime, endTime),
    HealthConnectProvider.readWorkouts(startTime, endTime),
  ])
  progress('reading', true)

  if (metrics.length === 0 && sleep.length === 0 && workouts.length === 0) {
    return { success: true, inserted: 0, skipped: 0, message: 'No new data' }
  }

  progress('uploading', false)
  const res = await fetch(`${API_BASE_URL}/health/${sessionId}/sync`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      provider:   'health_connect',
      metrics,
      sleep,
      workouts,
      sync_time:  endTime,
    }),
  })
  progress('uploading', true)

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Sync failed: HTTP ${res.status}`)
  }

  const data = await res.json()
  saveSyncTimestamp(endTime)
  return data
}

// ─── Backend health API helpers ───────────────────────────────────────────────

async function hcFetch(path) {
  const res = await fetch(`${API_BASE_URL}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const healthApi = {
  summary:   (sid)           => hcFetch(`/health/${sid}/summary`),
  history:   (sid, days = 14) => hcFetch(`/health/${sid}/history?days=${days}`),
  syncState: (sid)           => hcFetch(`/health/${sid}/sync-state`),
  deleteData: (sid)          => fetch(`${API_BASE_URL}/health/${sid}/data`, { method: 'DELETE' }).then(r => r.json()),
}

// ─── Dev test mode (never runs in production) ─────────────────────────────────

export function generateTestHealthData() {
  if (import.meta.env.PROD) return []
  const now   = new Date()
  const today = now.toISOString().split('T')[0]
  return {
    metrics: [
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'steps', value: 7500, unit: 'steps',
        start_time: `${today}T00:00:00Z`, end_time: `${today}T23:59:59Z`,
        source_id: `test-steps-${today}` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'heart_rate', value: 72, unit: 'bpm',
        start_time: `${today}T08:00:00Z`, end_time: `${today}T08:01:00Z`,
        source_id: `test-hr-${today}-1` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'resting_heart_rate', value: 62, unit: 'bpm',
        start_time: `${today}T06:00:00Z`, source_id: `test-rhr-${today}` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'heart_rate_variability', value: 45, unit: 'ms',
        start_time: `${today}T06:00:00Z`, source_id: `test-hrv-${today}` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'oxygen_saturation', value: 97, unit: '%',
        start_time: `${today}T07:00:00Z`, source_id: `test-spo2-${today}` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'active_calories', value: 420, unit: 'kcal',
        start_time: `${today}T00:00:00Z`, end_time: `${today}T23:59:59Z`,
        source_id: `test-cal-${today}` },
      { provider: 'health_connect', source: 'test', device: 'test_device',
        metric_type: 'active_minutes', value: 45, unit: 'min',
        start_time: `${today}T00:00:00Z`, end_time: `${today}T23:59:59Z`,
        source_id: `test-actmin-${today}` },
    ],
    sleep: [
      { provider: 'health_connect', source: 'test', device: 'test_device',
        start_time: `${today}T22:30:00Z`,
        end_time:   new Date(now.getTime() - 2 * 3600000).toISOString(),
        duration_minutes: 462, light_sleep_minutes: 180,
        deep_sleep_minutes: 120, rem_sleep_minutes: 90, awake_minutes: 72,
        source_id: `test-sleep-${today}` },
    ],
    workouts: [],
  }
}
