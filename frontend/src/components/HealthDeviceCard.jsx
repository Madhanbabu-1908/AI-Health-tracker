import React, { useState, useEffect, useCallback } from 'react'
import {
  isAndroidApp, HC_STATUS,
  HealthConnectProvider, syncHealthData, clearSyncState,
  healthApi, generateTestHealthData,
} from '../services/healthConnect.js'
import { getSessionId } from '../services/api.js'

function fmtSyncTime(iso) {
  if (!iso) return 'Never'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)  return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString()
}

const PERMISSION_LABELS = {
  'android.permission.health.READ_STEPS':                  '👟 Steps',
  'android.permission.health.READ_HEART_RATE':             '❤️ Heart rate',
  'android.permission.health.READ_RESTING_HEART_RATE':     '❤️ Resting HR',
  'android.permission.health.READ_HEART_RATE_VARIABILITY': '📊 HRV',
  'android.permission.health.READ_OXYGEN_SATURATION':      '🫁 SpO₂',
  'android.permission.health.READ_SLEEP':                  '😴 Sleep',
  'android.permission.health.READ_EXERCISE':               '🏃 Exercise',
  'android.permission.health.READ_ACTIVE_CALORIES_BURNED': '🔥 Active calories',
  'android.permission.health.READ_DISTANCE':               '📏 Distance',
  'android.permission.health.READ_VO2_MAX':                '💨 VO₂ max',
}

export default function HealthDeviceCard() {
  const sessionId = getSessionId()
  const isAndroid = isAndroidApp()

  const [availability, setAvailability] = useState(HC_STATUS.UNKNOWN)
  const [connected,    setConnected]    = useState(false)
  const [syncState,    setSyncState]    = useState(null)
  const [permissions,  setPermissions]  = useState([])
  const [syncing,      setSyncing]      = useState(false)
  const [syncProgress, setSyncProgress] = useState({})
  const [error,        setError]        = useState('')
  const [showDisconnect, setShowDisconnect] = useState(false)
  const [isDev]        = useState(!import.meta.env.PROD)

  const loadState = useCallback(async () => {
    if (!isAndroid) return
    const avail = await HealthConnectProvider.checkAvailability()
    setAvailability(avail)
    if (avail !== HC_STATUS.AVAILABLE) return

    const [permsRes, state] = await Promise.all([
      HealthConnectProvider.getPermissionStatus(),
      healthApi.syncState(sessionId).catch(() => null),
    ])
    const granted = permsRes.granted ?? []
    setPermissions(granted)
    setConnected(granted.length > 0)
    setSyncState(state)
  }, [sessionId, isAndroid])

  useEffect(() => { loadState() }, [loadState])

  const handleConnect = async () => {
    setError('')
    try {
      const res = await HealthConnectProvider.requestPermissions()
      const granted = res.granted ?? []
      setPermissions(granted)
      setConnected(granted.length > 0)
      if (granted.length > 0) await doSync()
    } catch (e) {
      setError(e.message || 'Could not open Health Connect permissions.')
    }
  }

  const doSync = async () => {
    if (syncing) return
    setSyncing(true)
    setError('')
    setSyncProgress({})
    try {
      await syncHealthData(sessionId, {
        onProgress: (step, done) =>
          setSyncProgress(p => ({ ...p, [step]: done })),
      })
      const state = await healthApi.syncState(sessionId).catch(() => null)
      setSyncState(state)
    } catch (e) {
      setError('Sync failed. Your existing data is safe. ' + e.message)
    } finally {
      setSyncing(false)
      setSyncProgress({})
    }
  }

  const handleTestSync = async () => {
    if (!isDev || syncing) return
    setSyncing(true)
    setError('')
    try {
      const testData = generateTestHealthData()
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://ai-health-tracker-yycb.onrender.com'}/health/${sessionId}/sync`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, provider: 'health_connect', ...testData }) }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const state = await healthApi.syncState(sessionId).catch(() => null)
      setSyncState(state)
      setConnected(true)
    } catch (e) {
      setError('Test sync failed: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    if (!showDisconnect) { setShowDisconnect(true); return }
    clearSyncState()
    await healthApi.deleteData(sessionId).catch(() => {})
    setConnected(false)
    setPermissions([])
    setSyncState(null)
    setShowDisconnect(false)
  }

  // ── Web / desktop fallback ────────────────────────────────────────────────
  if (!isAndroid) {
    return (
      <div className="card">
        <div className="card-title">Health &amp; Devices</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 28 }}>❤️</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Health Connect</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Available in the Android app only.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Not installed ─────────────────────────────────────────────────────────
  if (availability === HC_STATUS.NOT_INSTALLED) {
    return (
      <div className="card">
        <div className="card-title">Health &amp; Devices</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
          Health Connect is required to sync your health data.
        </div>
        <a href="market://details?id=com.google.android.apps.healthdata"
          style={{ display: 'block', textDecoration: 'none' }}>
          <button className="btn btn-primary">Install Health Connect</button>
        </a>
      </div>
    )
  }

  // ── Not supported ─────────────────────────────────────────────────────────
  if (availability === HC_STATUS.NOT_SUPPORTED) {
    return (
      <div className="card">
        <div className="card-title">Health &amp; Devices</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Health Connect isn't available on this device.
        </div>
        {isDev && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--warn)', marginBottom: 8, fontWeight: 600 }}>
              DEV MODE — Test without a real device
            </div>
            <button className="btn btn-secondary" onClick={handleTestSync} disabled={syncing}
              style={{ fontSize: 13 }}>
              {syncing ? '⟳ Syncing...' : '🧪 Inject Test Data'}
            </button>
            {error && <div className="error-banner" style={{ marginTop: 8 }}>{error}</div>}
          </div>
        )}
      </div>
    )
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  if (connected) {
    return (
      <div className="card">
        <div className="card-title">Health &amp; Devices</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 28 }}>❤️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Health Connect</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Android health data</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>Connected</span>
          </div>
        </div>

        <div className="settings-row" style={{ padding: '8px 0' }}>
          <div className="settings-row-label">Last synced</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {fmtSyncTime(syncState?.last_sync_at)}
          </div>
        </div>

        {/* Sync progress */}
        {syncing && (
          <div style={{ padding: '10px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>Syncing your health data...</div>
            {[['reading', 'Reading from Health Connect'],
              ['uploading', 'Uploading to Nalamudan']].map(([k, label]) => (
              <div key={k} style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{syncProgress[k] ? '✓' : '⟳'}</span>
                <span style={{ color: syncProgress[k] ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {error && <div className="error-banner" style={{ marginBottom: 10 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={doSync} disabled={syncing}
            style={{ flex: 1, fontSize: 13 }}>
            {syncing ? '⟳ Syncing...' : '🔄 Sync Now'}
          </button>
          <button className="btn btn-secondary" onClick={() => HealthConnectProvider.openSettings()}
            style={{ flex: 1, fontSize: 13 }}>
            ⚙️ Manage Access
          </button>
        </div>

        {/* Granted permissions */}
        {permissions.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Data available
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {permissions.map(p => (
                <span key={p} style={{
                  fontSize: 11, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)',
                  color: 'var(--accent)',
                }}>
                  {PERMISSION_LABELS[p] ?? p.split('.').pop()}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Disconnect */}
        <div style={{ marginTop: 14 }}>
          {showDisconnect ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                This will delete all imported health data from Nalamudan. Nutrition data is unaffected.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger" onClick={handleDisconnect}
                  style={{ flex: 1, fontSize: 13 }}>Confirm Disconnect</button>
                <button className="btn btn-secondary" onClick={() => setShowDisconnect(false)}
                  style={{ flex: 1, fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={handleDisconnect}
              style={{ fontSize: 12, color: 'var(--text-muted)', width: '100%' }}>
              Disconnect Health Connect
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Not connected ─────────────────────────────────────────────────────────
  return (
    <div className="card">
      <div className="card-title">Health &amp; Devices</div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div style={{ fontSize: 32 }}>❤️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            Connect Health Data
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Import steps, sleep, heart rate and activity from Android Health Connect.
            Works with Fitbit, Samsung Health, and other sources.
          </div>
        </div>
      </div>

      {error && <div className="error-banner" style={{ marginBottom: 10 }}>{error}</div>}

      <button className="btn btn-primary" onClick={handleConnect}>
        Connect
      </button>

      {isDev && (
        <button className="btn btn-secondary" onClick={handleTestSync} disabled={syncing}
          style={{ marginTop: 8, fontSize: 12 }}>
          {syncing ? '⟳ Syncing...' : '🧪 Dev: Inject Test Data'}
        </button>
      )}
    </div>
  )
}
