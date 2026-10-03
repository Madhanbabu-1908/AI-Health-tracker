import React, { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { healthApi } from '../services/healthConnect.js'

const HEALTH_METRICS = [
  { key: 'steps',                  label: '👟 Steps',      unit: '',    color: '#00e5a0', isSum: true },
  { key: 'active_calories',        label: '🔥 Active Cal', unit: 'kcal',color: '#ffb347', isSum: true },
  { key: 'average_heart_rate',     label: '❤️ Heart Rate', unit: 'bpm', color: '#ff4d6d' },
  { key: 'resting_heart_rate',     label: '💤 Resting HR', unit: 'bpm', color: '#e57373' },
  { key: 'hrv',                    label: '📊 HRV',        unit: 'ms',  color: '#b57bee' },
  { key: 'oxygen_saturation',      label: '🫁 SpO₂',       unit: '%',   color: '#4dc9ff' },
  { key: 'sleep_duration_minutes', label: '😴 Sleep',      unit: 'min', color: '#7c83fd' },
]

const RANGES = [
  { label: '7D',  days: 7  },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
]

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.value?.toFixed(unit === 'bpm' || unit === 'ms' || unit === '%' ? 1 : 0)}{unit}
        </div>
      ))}
    </div>
  )
}

export default function HealthHistoryChart({ sessionId }) {
  const [days,    setDays]    = useState(14)
  const [metric,  setMetric]  = useState('steps')
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await healthApi.history(sessionId, days)
      setData(res)
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [sessionId, days])

  useEffect(() => { load() }, [load])

  const sel = HEALTH_METRICS.find(m => m.key === metric) || HEALTH_METRICS[0]

  const chartData = data.map(d => ({
    ...d,
    dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }))

  const vals  = chartData.map(d => d[metric]).filter(v => v !== null && v !== undefined)
  const avg   = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const peak  = vals.length ? Math.max(...vals) : 0

  return (
    <div>
      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {RANGES.map(r => (
          <button key={r.days} onClick={() => setDays(r.days)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-md)',
              background: days === r.days ? 'var(--accent)' : 'var(--bg-elevated)',
              color: days === r.days ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border)', fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
            {r.label}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div className="scroll-x" style={{ marginBottom: 12 }}>
        {HEALTH_METRICS.map(m => (
          <button key={m.key} onClick={() => setMetric(m.key)}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap',
              background: metric === m.key ? m.color + '22' : 'var(--bg-elevated)',
              border: metric === m.key ? `1.5px solid ${m.color}` : '1px solid var(--border)',
              color: metric === m.key ? m.color : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 16 }} />
      ) : data.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <h3>No health data yet</h3>
          <p>Connect Health Connect and sync to see your trends here.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15,
              fontWeight: 800, marginBottom: 14 }}>{sel.label}</div>
            <ResponsiveContainer width="100%" height={190}>
              {sel.isSum ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit={sel.unit} />} />
                  {avg > 0 && (
                    <ReferenceLine y={avg} stroke={sel.color} strokeDasharray="4 3" strokeOpacity={0.5}
                      label={{ value: 'Avg', fill: sel.color, fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Bar dataKey={metric} fill={sel.color} radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit={sel.unit} />} />
                  {avg > 0 && (
                    <ReferenceLine y={avg} stroke={sel.color} strokeDasharray="4 3" strokeOpacity={0.5}
                      label={{ value: 'Avg', fill: sel.color, fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Line type="monotone" dataKey={metric} stroke={sel.color}
                    strokeWidth={2.5} dot={{ r: 3, fill: sel.color }}
                    connectNulls={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Summary */}
          <div className="card" style={{ marginTop: 10 }}>
            <div className="card-title">Summary · Last {days} Days</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Average', value: `${avg.toFixed(metric === 'steps' ? 0 : 1)}${sel.unit}` },
                { label: 'Peak',    value: `${peak.toFixed(metric === 'steps' ? 0 : 1)}${sel.unit}` },
                { label: 'Days tracked', value: `${vals.length}` },
                { label: 'Data points',  value: `${vals.length}` },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4,
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18,
                    fontWeight: 800, color: sel.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
