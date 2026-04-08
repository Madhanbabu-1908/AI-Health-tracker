import React, { useState } from 'react'
import { profileApi } from '../services/api'

const GOALS = [
  { val: 'maintain_weight',   icon: '⚖️', label: 'Maintain',    desc: 'Keep current weight' },
  { val: 'lose_weight',       icon: '🏃', label: 'Lose Weight',  desc: 'Gradual fat loss' },
  { val: 'gain_muscle',       icon: '💪', label: 'Gain Muscle',  desc: 'Build lean mass' },
  { val: 'improve_endurance', icon: '🏊', label: 'Endurance',    desc: 'Boost stamina' },
  { val: 'lower_cholesterol', icon: '❤️', label: 'Heart Health', desc: 'Lower LDL' },
  { val: 'increase_iron',     icon: '🩸', label: 'Iron',         desc: 'Replenish iron levels' },
]

const ACTIVITY = [
  { val: 'sedentary',   icon: '🛋️', label: 'Sedentary',    desc: 'Desk job, little exercise' },
  { val: 'light',       icon: '🚶', label: 'Light',         desc: '1–3 workouts/week' },
  { val: 'moderate',    icon: '🏃', label: 'Moderate',      desc: '3–5 workouts/week' },
  { val: 'active',      icon: '🏋️', label: 'Active',        desc: '6–7 workouts/week' },
  { val: 'very_active', icon: '⚡', label: 'Very Active',   desc: 'Physical job + daily training' },
]

const CURRENCIES = ['₹', '$', '€', '£', '¥', '₦', '฿']

const STEP_LABELS = ['Basics', 'Goals', 'Activity', 'Finish']

export default function Onboarding({ sessionId, onComplete }) {
  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    nickname: '', age: '', gender: 'male',
    height: '', weight: '', currency: '₹',
    primary_goal: 'maintain_weight',
    activity_level: 'moderate',
    secondary_goals: [],
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleSecondary = (val) => {
    setForm(f => ({
      ...f,
      secondary_goals: f.secondary_goals.includes(val)
        ? f.secondary_goals.filter(g => g !== val)
        : [...f.secondary_goals, val],
    }))
  }

  const next = () => {
    setError('')
    if (step === 0) {
      if (!form.nickname.trim()) { setError('Please enter your nickname'); return }
      if (!form.age || form.age < 10 || form.age > 120) { setError('Enter a valid age (10–120)'); return }
      if (!form.height || form.height < 50 || form.height > 250) { setError('Enter height in cm (50–250)'); return }
      if (!form.weight || form.weight < 20 || form.weight > 300) { setError('Enter weight in kg (20–300)'); return }
    }
    setStep(s => s + 1)
  }

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await profileApi.setup({
        session_id:      sessionId,
        nickname:        form.nickname.trim(),
        age:             parseInt(form.age),
        gender:          form.gender,
        height:          parseFloat(form.height),
        weight:          parseFloat(form.weight),
        currency:        form.currency,
        primary_goal:    form.primary_goal,
        activity_level:  form.activity_level,
        secondary_goals: form.secondary_goals,
      })
      if (res.success) {
        onComplete(res.profile, res.goals)
      } else {
        setError(res.message || 'Setup failed')
        setSaving(false)
      }
    } catch (e) {
      setError(e.message || 'Connection error')
      setSaving(false)
    }
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        {/* Logo */}
        <div className="onboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <div className="logo-icon" style={{ width: 44, height: 44, fontSize: 22 }}>🏋️</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '0.02em' }}>
              HEALTH<span style={{ color: 'var(--accent)' }}>+</span>WEALTH
            </div>
          </div>
          <div className="onboard-sub">
            Your personal AI nutrition tracker
          </div>
        </div>

        {/* Step dots */}
        <div className="step-dots">
          {STEP_LABELS.map((_, i) => (
            <div key={i} className={`step-dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        {error && <div className="error-banner" style={{ marginBottom: 16 }}>{error}</div>}

        {/* Step 0 — Basics */}
        {step === 0 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
              Tell us about you
            </div>

            <div className="field">
              <label className="label">Nickname *</label>
              <input className="input" placeholder="What should I call you?"
                value={form.nickname} onChange={e => set('nickname', e.target.value)} />
            </div>

            <div className="field-row">
              <div className="field">
                <label className="label">Age *</label>
                <input className="input" type="number" placeholder="25"
                  value={form.age} onChange={e => set('age', e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="label">Height (cm) *</label>
                <input className="input" type="number" placeholder="170"
                  value={form.height} onChange={e => set('height', e.target.value)} />
              </div>
              <div className="field">
                <label className="label">Weight (kg) *</label>
                <input className="input" type="number" placeholder="70"
                  value={form.weight} onChange={e => set('weight', e.target.value)} />
              </div>
            </div>

            <div className="field">
              <label className="label">Currency</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CURRENCIES.map(c => (
                  <button key={c}
                    onClick={() => set('currency', c)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-md)',
                      background: form.currency === c ? 'rgba(0,229,160,0.12)' : 'var(--bg-elevated)',
                      border: form.currency === c ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                      color: form.currency === c ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >{c}</button>
                ))}
              </div>
            </div>

            <button className="btn btn-primary" onClick={next}>Continue →</button>
          </div>
        )}

        {/* Step 1 — Primary goal */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
              Primary Goal
            </div>
            <div className="select-grid">
              {GOALS.map(g => (
                <div key={g.val}
                  className={`select-card ${form.primary_goal === g.val ? 'sel' : ''}`}
                  onClick={() => set('primary_goal', g.val)}
                >
                  <div className="select-card-icon">{g.icon}</div>
                  <div className="select-card-label">{g.label}</div>
                  <div className="select-card-desc">{g.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(0)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary" onClick={next} style={{ flex: 2 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 2 — Activity */}
        {step === 2 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
              Activity Level
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {ACTIVITY.map(a => (
                <div key={a.val}
                  className={`select-card ${form.activity_level === a.val ? 'sel' : ''}`}
                  onClick={() => set('activity_level', a.val)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <div>
                    <div className="select-card-label">{a.label}</div>
                    <div className="select-card-desc">{a.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary" onClick={next} style={{ flex: 2 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — Secondary goals + submit */}
        {step === 3 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              Secondary Goals
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Optional — helps fine-tune your plan
            </div>
            <div className="tag-row" style={{ marginBottom: 24 }}>
              {GOALS.filter(g => g.val !== form.primary_goal).map(g => (
                <div key={g.val}
                  className={`tag ${form.secondary_goals.includes(g.val) ? 'sel' : ''}`}
                  onClick={() => toggleSecondary(g.val)}
                >
                  {g.icon} {g.label}
                </div>
              ))}
            </div>

            {/* Summary preview */}
            <div style={{
              background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
              padding: '14px', marginBottom: 20, fontSize: 13,
              color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Your Plan Preview</div>
              <div>👤 {form.nickname}, {form.age}y · {form.height}cm · {form.weight}kg</div>
              <div>🎯 {GOALS.find(g => g.val === form.primary_goal)?.label}</div>
              <div>⚡ {ACTIVITY.find(a => a.val === form.activity_level)?.label}</div>
              <div style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 600 }}>
                AI will calculate your exact goals →
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)} style={{ flex: 1 }}>← Back</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ flex: 2 }}>
                {saving ? '⟳ Setting up...' : '🚀 Start My Journey'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
