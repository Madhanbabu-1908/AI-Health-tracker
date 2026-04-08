import React, { useState, useEffect, useCallback } from 'react'
import { logApi, waterApi } from '../services/api'

// ─── Ring SVG ────────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 52, stroke = 5, label, value }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct / 100, 1) * circ
  return (
    <div className="ring-item">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--bg-elevated)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
          fill="var(--text-primary)"
          style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
          {Math.min(pct, 100).toFixed(0)}%
        </text>
      </svg>
      <span className="ring-label">{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
        {value}
      </span>
    </div>
  )
}

// ─── Stat row ────────────────────────────────────────────────────────────────

function StatRow({ icon, label, current, goal, unit, color, bg }) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0
  const rem = Math.max(0, goal - current)
  return (
    <div className="stat-row">
      <div className="stat-icon" style={{ background: bg }}>{icon}</div>
      <div className="stat-meta">
        <div className="stat-name">
          <span>{label}</span>
          <span className="stat-numbers">
            {current % 1 === 0 ? current : current.toFixed(1)}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
              {' '}/ {goal}{unit}
            </span>
          </span>
        </div>
        <div className="bar-track">
          <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        {rem > 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {rem % 1 === 0 ? rem : rem.toFixed(1)}{unit} remaining
          </div>
        )}
        {rem === 0 && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 3 }}>✓ Goal reached!</div>
        )}
      </div>
    </div>
  )
}

// ─── Water card ───────────────────────────────────────────────────────────────

function WaterCard({ waterMl, goalL, sessionId, onLogWater }) {
  const goalMl = goalL * 1000
  const pct    = goalMl > 0 ? Math.min((waterMl / goalMl) * 100, 100) : 0
  const remL   = Math.max(0, goalL - waterMl / 1000)

  const PRESETS = [150, 200, 250, 350, 500]

  return (
    <div className="card water-card">
      <div className="water-row">
        <div className="water-visual">
          <div className="water-fill" style={{ height: `${pct}%` }} />
          <div className="water-pct-text">{pct.toFixed(0)}%</div>
        </div>
        <div className="water-info">
          <div className="water-title">HYDRATION</div>
          <div className="water-amounts">
            {(waterMl / 1000).toFixed(2)}L / {goalL}L
            {remL > 0.01 && (
              <span style={{ color: 'var(--text-muted)' }}> · {remL.toFixed(1)}L left</span>
            )}
            {remL <= 0.01 && (
              <span style={{ color: '#4dc9ff' }}> · Fully hydrated! 🎉</span>
            )}
          </div>
          <div className="water-btns">
            {PRESETS.map(ml => (
              <button key={ml} className="water-btn" onClick={() => onLogWater(ml)}>
                +{ml}ml
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Wealth card ──────────────────────────────────────────────────────────────

function WealthCard({ today, weekHistory, currency }) {
  const weekSpend = weekHistory.reduce((s, d) => s + (d.cost || 0), 0)
  return (
    <div className="card wealth-card">
      <div className="card-title">Today's Spend</div>
      <div className="wealth-row">
        <div>
          <div className="wealth-amount">{currency}{today.toFixed(0)}</div>
          <div className="wealth-label">Food Budget</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--warn)' }}>
            {currency}{weekSpend.toFixed(0)}
          </div>
          <div className="wealth-label">7-day total</div>
        </div>
      </div>
      {weekHistory.length > 0 && (
        <div className="wealth-week">
          Avg {currency}{(weekSpend / Math.max(weekHistory.length, 1)).toFixed(0)}/day this week
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ profile, goals, sessionId, refreshKey }) {
  const [data, setData]         = useState(null)
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    try {
      const [tod, hist] = await Promise.all([
        logApi.today(sessionId),
        logApi.history(sessionId, 7),
      ])
      setData(tod)
      setHistory(hist)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const handleWater = async (ml) => {
    try {
      await waterApi.log(sessionId, ml)
      load()
    } catch (e) { console.error(e) }
  }

  if (loading) return (
    <div className="page">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12 }} />
      ))}
    </div>
  )

  const t  = data?.totals || {}
  const g  = goals || {}
  const pct = data?.percentages || {}
  const waterMl = data?.water_ml || 0
  const currency = profile?.currency || '₹'

  // Protein status for hero
  const proteinPct  = pct.protein || 0
  const proteinRem  = Math.max(0, (g.protein_goal || 100) - (t.protein || 0))

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero-card">
        <div className="hero-label">Daily Protein</div>
        <div className="hero-value">
          {(t.protein || 0).toFixed(0)}
          <span>/{g.protein_goal || 100}g</span>
        </div>
        <div className="hero-sub">
          {proteinRem > 0
            ? `${proteinRem.toFixed(0)}g more to hit your goal`
            : '🏆 Protein goal achieved!'}
        </div>
        <div className="ring-wrap">
          <Ring pct={pct.calories || 0}    color="#ffb347" label="Calories" value={`${(t.calories||0).toFixed(0)}kcal`} />
          <Ring pct={pct.protein || 0}     color="#00e5a0" label="Protein"  value={`${(t.protein||0).toFixed(0)}g`} />
          <Ring pct={pct.carbs || 0}       color="#4dc9ff" label="Carbs"    value={`${(t.carbs||0).toFixed(0)}g`} />
          <Ring pct={pct.cholesterol || 0} color="#ff4d6d" label="Chol."    value={`${(t.cholesterol||0).toFixed(0)}mg`} />
        </div>
      </div>

      {/* Detailed stats */}
      <div className="card">
        <div className="card-title">Macros & Micros</div>
        <div className="stat-rows">
          <StatRow icon="🔥" label="Calories"    current={t.calories||0}    goal={g.calorie_goal||2000}    unit="kcal" color="#ffb347" bg="rgba(255,179,71,0.12)" />
          <StatRow icon="🥩" label="Protein"     current={t.protein||0}     goal={g.protein_goal||100}     unit="g"    color="#00e5a0" bg="rgba(0,229,160,0.1)" />
          <StatRow icon="🍞" label="Carbs"       current={t.carbs||0}       goal={g.carb_goal||250}        unit="g"    color="#4dc9ff" bg="rgba(77,201,255,0.1)" />
          <StatRow icon="🫐" label="Fat"         current={t.fat||0}         goal={g.fat_goal||65}          unit="g"    color="#b57bee" bg="rgba(181,123,238,0.1)" />
          <StatRow icon="🌿" label="Fiber"       current={t.fiber||0}       goal={g.fiber_goal||25}        unit="g"    color="#82ca9d" bg="rgba(130,202,157,0.1)" />
          <StatRow icon="🍳" label="Cholesterol" current={t.cholesterol||0} goal={g.cholesterol_limit||300} unit="mg" color="#ff4d6d" bg="rgba(255,77,109,0.1)" />
          <StatRow icon="🩸" label="Iron"        current={t.iron||0}        goal={g.iron_goal||8}          unit="mg"   color="#e57373" bg="rgba(229,115,115,0.1)" />
        </div>
      </div>

      {/* Water */}
      <WaterCard
        waterMl={waterMl}
        goalL={g.water_goal || 2.5}
        sessionId={sessionId}
        onLogWater={handleWater}
      />

      {/* Wealth */}
      <WealthCard
        today={t.cost || 0}
        weekHistory={history}
        currency={currency}
      />

      {/* Today's food entries */}
      {data?.entries?.length > 0 && (
        <div className="card">
          <div className="card-title">Today's Meals</div>
          {data.entries.map((e, i) => (
            <div key={i} className="food-item">
              <div className="food-item-icon">🍽️</div>
              <div className="food-item-info">
                <div className="food-item-name">{e.name}</div>
                <div className="food-item-meta">
                  {e.protein?.toFixed(0)}g protein · {e.calories?.toFixed(0)} kcal · {currency}{e.cost?.toFixed(0)}
                  <span style={{ color: 'var(--text-muted)' }}> · {e.quantity} {e.unit}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {new Date(e.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
