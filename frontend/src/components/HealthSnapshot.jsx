import React, { useState, useEffect, useCallback } from 'react'
import { healthApi, isAndroidApp } from '../services/healthConnect.js'

function MetricTile({ icon, label, value, unit, delta }) {
  const hasData = value !== null && value !== undefined
  return (
    <div style={{
      background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
      padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 18 }}>{icon}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      {hasData ? (
        <>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18,
            fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {typeof value === 'number' ? value.toLocaleString() : value}
            {unit && <span style={{ fontSize: 11, fontWeight: 400,
              color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span>}
          </div>
          {delta !== null && delta !== undefined && (
            <div style={{ fontSize: 10, color: delta >= 0 ? 'var(--accent)' : 'var(--danger)',
              fontWeight: 600 }}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs 14d
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Not available
        </div>
      )}
    </div>
  )
}

function fmtSleep(minutes) {
  if (minutes === null || minutes === undefined) return null
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return `${h}h ${m}m`
}

export default function HealthSnapshot({ sessionId, onConnect }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hasData, setHasData] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await healthApi.summary(sessionId)
      const today = data.today ?? {}
      setHasData(Object.values(today).some(v => v !== null && v !== undefined))
      setSummary(data)
    } catch {
      setHasData(false)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="skeleton" style={{ height: 110, borderRadius: 'var(--radius-lg)', marginTop: 12 }} />
  )

  if (!hasData) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Today's Health</div>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            Connect your health device to track sleep, activity and heart health automatically.
          </div>
          {isAndroidApp()
            ? <button className="btn btn-ghost" onClick={onConnect}
                style={{ fontSize: 13, padding: '10px 20px' }}>Connect</button>
            : <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Available in the Android app.</div>
          }
        </div>
      </div>
    )
  }

  const t = summary.today ?? {}
  const d = summary.deltas ?? {}

  const metrics = [
    { icon: '👟', label: 'Steps',     value: t.steps,               unit: '',    delta: d.steps },
    { icon: '❤️', label: 'Heart Rate',value: t.average_heart_rate,  unit: 'bpm', delta: d.average_heart_rate },
    { icon: '😴', label: 'Sleep',     value: fmtSleep(t.sleep_duration_minutes), unit: '', delta: d.sleep_duration_minutes },
    { icon: '🫁', label: 'SpO₂',      value: t.oxygen_saturation,   unit: '%',   delta: null },
    { icon: '🔥', label: 'Active',    value: t.active_minutes,      unit: 'min', delta: d.active_minutes },
    { icon: '📊', label: 'HRV',       value: t.hrv,                 unit: 'ms',  delta: d.hrv },
  ]

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Today's Health</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Source: Health Connect</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {metrics.map(m => <MetricTile key={m.label} {...m} />)}
      </div>
    </div>
  )
}
