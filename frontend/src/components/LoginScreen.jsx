import React, { useState } from 'react'
import { profileApi, restoreSession } from '../services/api'

export default function LoginScreen({ onLogin, onNewUser }) {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async () => {
    if (!nickname.trim()) { setError('Please enter your nickname'); return }
    setLoading(true)
    setError('')
    try {
      const res = await profileApi.byNickname(nickname.trim())
      restoreSession(res.profile.session_id)
      onLogin(res.profile, res.goals)
    } catch (e) {
      setError(e.message?.includes('404') ? 'No account found with that nickname.' : e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboard-wrap">
      <div className="onboard-card">
        <div className="onboard-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <img src="/favicon.svg" alt="Nalamudan" style={{ width: 44, height: 44 }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, letterSpacing: '0.02em' }}>
              NALAMU<span style={{ color: 'var(--accent)' }}>DAN</span>
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            Welcome back 👋
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="field">
            <label className="label">Your Nickname</label>
            <input
              className="input"
              placeholder="Enter your nickname to continue"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              autoFocus
            />
          </div>

          {error && <div className="error-banner" style={{ marginBottom: 12 }}>{error}</div>}

          <button className="btn btn-primary" onClick={handleLogin} disabled={loading}>
            {loading ? '⟳ Looking up...' : '→ Continue'}
          </button>

          <button
            className="btn btn-secondary"
            style={{ marginTop: 10 }}
            onClick={onNewUser}
          >
            Create new account
          </button>
        </div>
      </div>
    </div>
  )
}
