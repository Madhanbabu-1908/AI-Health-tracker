import React, { useState } from 'react'
import { profileApi, clearSession } from '../services/api'
import { useApp } from '../context/AppContext'
import { useToast } from '../hooks/useToast'

export default function Settings({ profile, goals, sessionId, onReset }) {
  const { theme, toggleTheme } = useApp()
  const [deleting, setDeleting] = useState(false)
  const { showToast, ToastEl } = useToast()

  const THEME_OPTIONS = [
    { val: 'dark',   label: '🌙 Dark'   },
    { val: 'light',  label: '☀️ Light'  },
    { val: 'system', label: '⚙️ System' },
  ]

  const handleDelete = async () => {
    const confirmed = window.confirm(
      '⚠️ Delete ALL your data?\n\nThis removes your profile, food history, custom foods and water logs permanently. This cannot be undone.'
    )
    if (!confirmed) return
    setDeleting(true)
    try {
      await profileApi.delete(sessionId)
      clearSession()
      showToast('All data deleted', 'info')
      setTimeout(() => onReset(), 800)
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error')
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      {ToastEl}

      <div className="section-head">
        <span className="section-title">Settings</span>
      </div>

      {/* Profile info */}
      {profile && (
        <div className="card">
          <div className="card-title">Profile</div>
          {[
            ['Nickname',       profile.nickname],
            ['Height',         `${profile.height} cm`],
            ['Weight',         `${profile.weight} kg`],
            ['BMI',            `${profile.bmi?.toFixed(1)} · ${profile.bmi < 18.5 ? 'Underweight' : profile.bmi < 25 ? 'Normal' : profile.bmi < 30 ? 'Overweight' : 'Obese'}`],
            ['Age',            profile.age],
            ['Gender',         profile.gender],
            ['Goal',           profile.primary_goal?.replace(/_/g, ' ')],
            ['Activity',       profile.activity_level?.replace(/_/g, ' ')],
            ['Currency',       profile.currency],
          ].map(([k, v]) => v && (
            <div key={k} className="settings-row">
              <div className="settings-row-label">{k}</div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'capitalize' }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Nutrition goals summary */}
      {goals && (
        <div className="card">
          <div className="card-title">Daily Goals</div>
          {[
            ['Calories',    `${goals.calorie_goal?.toFixed(0)} kcal`],
            ['Protein',     `${goals.protein_goal?.toFixed(0)} g`],
            ['Carbs',       `${goals.carb_goal?.toFixed(0)} g`],
            ['Fat',         `${goals.fat_goal?.toFixed(0)} g`],
            ['Fiber',       `${goals.fiber_goal?.toFixed(0)} g`],
            ['Cholesterol', `≤ ${goals.cholesterol_limit?.toFixed(0)} mg`],
            ['Iron',        `${goals.iron_goal?.toFixed(0)} mg`],
            ['Water',       `${goals.water_goal?.toFixed(1)} L`],
          ].map(([k, v]) => (
            <div key={k} className="settings-row">
              <div className="settings-row-label">{k}</div>
              <div style={{ fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {v}
              </div>
            </div>
          ))}
          {goals.explanation && (
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-elevated)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {goals.explanation}
            </div>
          )}
        </div>
      )}

      {/* Theme */}
      <div className="card">
        <div className="card-title">Appearance</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {THEME_OPTIONS.map(opt => (
            <button
              key={opt.val}
              onClick={() => toggleTheme(opt.val)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: 'var(--radius-md)',
                background: theme === opt.val ? 'rgba(0,229,160,0.1)' : 'var(--bg-elevated)',
                border: theme === opt.val ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                color: theme === opt.val ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Session info */}
      <div className="card">
        <div className="card-title">Session</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Session ID</div>
            <div className="settings-row-sub">Stored in your browser. Clear app data to reset.</div>
          </div>
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 11,
          color: 'var(--text-muted)',
          background: 'var(--bg-elevated)',
          borderRadius: 8, padding: '8px 12px',
          wordBreak: 'break-all',
          marginTop: 6,
        }}>
          {sessionId}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'rgba(255,77,109,0.2)' }}>
        <div className="card-title" style={{ color: 'var(--danger)' }}>Danger Zone</div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
          Deletes your profile, all food logs, custom foods, and water history. You'll go back to the setup screen. This cannot be undone.
        </div>
        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting} style={{ width: '100%' }}>
          {deleting ? '⟳ Deleting...' : '🗑 Clear All My Data'}
        </button>
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
