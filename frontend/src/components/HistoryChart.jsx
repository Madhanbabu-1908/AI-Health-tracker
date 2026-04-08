import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { logApi } from '../services/api'

const METRICS = [
  { key: 'calories',    label: '🔥 Calories',    unit: 'kcal', color: '#ffb347', goalKey: 'calorie_goal' },
  { key: 'protein',     label: '🥩 Protein',     unit: 'g',    color: '#00e5a0', goalKey: 'protein_goal' },
  { key: 'carbs',       label: '🍞 Carbs',       unit: 'g',    color: '#4dc9ff', goalKey: 'carb_goal' },
  { key: 'fat',         label: '🫐 Fat',         unit: 'g',    color: '#b57bee', goalKey: 'fat_goal' },
  { key: 'fiber',       label: '🌿 Fiber',       unit: 'g',    color: '#82ca9d', goalKey: 'fiber_goal' },
  { key: 'cholesterol', label: '🍳 Cholesterol', unit: 'mg',   color: '#ff4d6d', goalKey: 'cholesterol_limit' },
  { key: 'iron',        label: '🩸 Iron',        unit: 'mg',   color: '#e57373', goalKey: 'iron_goal' },
  { key: 'water_l',     label: '💧 Water',       unit: 'L',    color: '#4dc9ff', goalKey: 'water_goal' },
  { key: 'cost',        label: '💰 Spend',       unit: '₹',    color: '#ffb347', goalKey: null },
]

const RANGES = [
  { label: '7D',  days: 7  },
  { label: '14D', days: 14 },
  { label: '21D', days: 21 },
  { label: '30D', days: 30 },
]

function CustomTooltip({ active, payload, label, unit, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>
          {unit === '₹' ? currency : ''}{p.value?.toFixed(unit === 'mg' || unit === 'kcal' ? 0 : 1)}{unit !== '₹' ? unit : ''}
        </div>
      ))}
    </div>
  )
}

export default function HistoryChart({ sessionId, goals, profile }) {
  const [days, setDays]         = useState(7)
  const [metric, setMetric]     = useState('protein')
  const [chartType, setChartType] = useState('bar')
  const [data, setData]         = useState([])
  const [loading, setLoading]   = useState(true)

  const currency = profile?.currency || '₹'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await logApi.history(sessionId, days)
      setData(res)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sessionId, days])

  useEffect(() => { load() }, [load])

  const sel  = METRICS.find(m => m.key === metric) || METRICS[0]
  const goal = sel.goalKey ? goals?.[sel.goalKey] : null

  // Formatted chart data — short date labels
  const chartData = data.map(d => ({
    ...d,
    dateLabel: new Date(d.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }))

  // Summary stats
  const vals    = chartData.map(d => d[metric] || 0)
  const avg     = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const max     = vals.length ? Math.max(...vals) : 0
  const min     = vals.length ? Math.min(...vals) : 0
  const total   = vals.reduce((a, b) => a + b, 0)
  const goalHit = goal ? vals.filter(v => metric === 'cholesterol' ? v <= goal : v >= goal).length : 0

  return (
    <div className="page">
      <div className="section-head">
        <span className="section-title">Progress</span>
      </div>

      {/* Range selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {RANGES.map(r => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className="btn btn-sm"
            style={{
              flex: 1,
              background: days === r.days ? 'var(--accent)' : 'var(--bg-elevated)',
              color: days === r.days ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              padding: '8px 0',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Metric selector — horizontal scroll */}
      <div className="scroll-x" style={{ marginBottom: 12 }}>
        {METRICS.map(m => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 20,
              background: metric === m.key ? m.color + '22' : 'var(--bg-elevated)',
              border: metric === m.key ? `1.5px solid ${m.color}` : '1px solid var(--border)',
              color: metric === m.key ? m.color : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 220, borderRadius: 16 }} />
      ) : data.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <h3>No data yet</h3>
          <p>Start logging meals to see your progress here.</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800 }}>
                {sel.label}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {['bar', 'line'].map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: chartType === t ? 'var(--accent)' : 'var(--bg-elevated)',
                      color: chartType === t ? '#000' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    {t === 'bar' ? '▐▌' : '〜'}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit={sel.unit} currency={currency} />} />
                  {goal && (
                    <ReferenceLine y={goal} stroke={sel.color} strokeDasharray="4 3" strokeOpacity={0.6}
                      label={{ value: 'Goal', fill: sel.color, fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Bar dataKey={metric} fill={sel.color} radius={[5, 5, 0, 0]} maxBarSize={28} />
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip unit={sel.unit} currency={currency} />} />
                  {goal && (
                    <ReferenceLine y={goal} stroke={sel.color} strokeDasharray="4 3" strokeOpacity={0.6}
                      label={{ value: 'Goal', fill: sel.color, fontSize: 10, position: 'insideTopRight' }} />
                  )}
                  <Line
                    type="monotone" dataKey={metric} stroke={sel.color}
                    strokeWidth={2.5} dot={{ r: 3, fill: sel.color }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Summary stats */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">Summary · Last {days} Days</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Average', value: `${metric === '₹' ? currency : ''}${avg.toFixed(metric === 'mg' || metric === 'kcal' ? 0 : 1)}${sel.unit !== '₹' ? sel.unit : ''}` },
                { label: 'Highest',  value: `${metric === '₹' ? currency : ''}${max.toFixed(metric === 'mg' || metric === 'kcal' ? 0 : 1)}${sel.unit !== '₹' ? sel.unit : ''}` },
                { label: 'Total',    value: `${metric === '₹' ? currency : ''}${total.toFixed(0)}${sel.unit !== '₹' ? sel.unit : ''}` },
                goal
                  ? { label: metric === 'cholesterol' ? 'Under limit' : 'Goal hit', value: `${goalHit}/${vals.length} days` }
                  : { label: 'Lowest', value: `${min.toFixed(1)}${sel.unit}` },
              ].map((s, i) => (
                <div key={i} style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                    {s.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: sel.color }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
