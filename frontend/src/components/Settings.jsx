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
      '⚠️ PERMANENTLY DELETE all data?\n\n' +
      'This will remove from the server:\n' +
      '• Your profile & nutrition goals\n' +
      '• All food logs & history\n' +
      '• Your custom food database\n' +
      '• All water logs\n\n' +
      'This CANNOT be undone. Are you sure?'
    )
    if (!confirmed) return

    // Double-confirm for safety
    const reconfirmed = window.confirm('Last chance — permanently delete everything?')
    if (!reconfirmed) return

    setDeleting(true)
    try {
      // DELETE /session/:id — cascades to all related tables on the server
      await profileApi.delete(sessionId)
      // Clear local storage too
      clearSession()
      showToast('All data permanently deleted from server', 'info')
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
            <div className="settings-row-sub">
              Your data is tied to this ID on the server.
              Log out keeps data; Clear Data removes it permanently.
            </div>
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

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
          <strong>Clear All My Data</strong> permanently removes your profile, food logs,
          custom food database, and water history from the server. This cannot be undone.
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: 10, marginBottom: 14,
          background: 'rgba(255,77,109,0.06)', border: '1px solid rgba(255,77,109,0.15)',
          fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
        }}>
          💡 <strong>Just want to switch devices?</strong> Use <em>Log out</em> (top right) instead.
          Your data stays on the server and you can log back in with your session ID.
        </div>

        <button className="btn btn-danger" onClick={handleDelete} disabled={deleting} style={{ width: '100%' }}>
          {deleting ? '⟳ Deleting from server...' : '🗑 Permanently Delete All My Data'}
        </button>
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
