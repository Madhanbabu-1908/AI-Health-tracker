import React, { useState, useEffect, useCallback } from 'react'
import { getSessionId, clearSession } from './services/api'
import { profileApi } from './services/api'
import { useApp } from './context/AppContext'
import Onboarding    from './components/Onboarding'
import Dashboard     from './components/Dashboard'
import FoodLogger    from './components/FoodLogger'
import AddFood       from './components/AddFood'
import HistoryChart  from './components/HistoryChart'
import AIChat        from './components/AIChat'
import Settings      from './components/Settings'

const NAV = [
  { id: 'dashboard', icon: '📊', label: 'Today' },
  { id: 'log',       icon: '🍽️', label: 'Log'   },
  { id: 'add',       icon: '＋',  label: 'Add'   },
  { id: 'history',   icon: '📈', label: 'Stats' },
  { id: 'ai',        icon: '✦',  label: 'Coach' },
  { id: 'settings',  icon: '⚙️', label: 'Me'    },
]

function BMIPill({ bmi }) {
  if (!bmi) return null
  const [cls, label] =
    bmi < 18.5 ? ['under', `${bmi.toFixed(1)} ↓`] :
    bmi < 25   ? ['normal', bmi.toFixed(1)] :
    bmi < 30   ? ['over', `${bmi.toFixed(1)} ↑`] :
                 ['obese', `${bmi.toFixed(1)} ⚠`]
  return <div className={`bmi-pill ${cls}`}>BMI {label}</div>
}

export default function App() {
  const [tab, setTab]           = useState('dashboard')
  const [profile, setProfile]   = useState(null)
  const [goals, setGoals]       = useState(null)
  const [ready, setReady]       = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [connErr, setConnErr]   = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const sessionId = getSessionId()
  const { appliedTheme, toggleTheme } = useApp()

  const boot = useCallback(async () => {
    try {
      const [p, g] = await Promise.all([
        profileApi.get(sessionId),
        profileApi.goals(sessionId),
      ])
      setProfile(p)
      setGoals(g)
      setLoggedIn(true)
      setConnErr(false)
    } catch (e) {
      if (e.message?.includes('404') || e.message?.includes('not found')) {
        setLoggedIn(false)
      } else {
        setConnErr(true)
      }
    } finally {
      setReady(true)
    }
  }, [sessionId])

  useEffect(() => { boot() }, [boot])

  const onOnboardComplete = (p, g) => {
    setProfile(p)
    setGoals(g)
    setLoggedIn(true)
  }

  const onFoodAction = () => setRefreshKey(k => k + 1)

  const onReset = () => {
    setProfile(null)
    setGoals(null)
    setLoggedIn(false)
    setRefreshKey(k => k + 1)
  }

  // Log out: just clear local session, data stays on server
  const handleLogout = () => {
    setLoggingOut(true)
    clearSession()
    // Small delay for visual feedback
    setTimeout(() => {
      setProfile(null)
      setGoals(null)
      setLoggedIn(false)
      setLoggingOut(false)
      setTab('dashboard')
    }, 300)
  }

  if (!ready) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', gap: 16 }}>
      <img src="/favicon.svg" alt="Nalamudan" style={{ width: 48, height: 48 }} />
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    </div>
  )

  if (connErr) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24, textAlign: 'center', gap: 16 }}>
      <div style={{ fontSize: 48 }}>📡</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>
        Can't reach server
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
        The backend at Render.com might be sleeping (free tier). Wait 30 seconds and try again.
      </div>
      <button className="btn btn-primary" style={{ maxWidth: 220 }} onClick={boot}>
        Retry
      </button>
    </div>
  )

  if (!loggedIn) return (
    <Onboarding sessionId={sessionId} onComplete={onOnboardComplete} />
  )

  const themeIcon = appliedTheme === 'dark' ? '☀️' : '🌙'

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <img src="/favicon.svg" alt="Nalamudan" className="logo-icon" />
          <div className="logo-text">
            NALAMU<span>DAN</span>
          </div>
        </div>
        <div className="header-right">
          <BMIPill bmi={profile?.bmi} />
          <button
            className="theme-btn"
            onClick={() => toggleTheme(appliedTheme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
          >
            {themeIcon}
          </button>
          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Log out (your data stays safe)"
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--danger)'
              e.currentTarget.style.color = 'var(--danger)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }}
          >
            {loggingOut ? '...' : '⏏ Log out'}
          </button>
        </div>
      </header>

      {/* Page content */}
      {tab === 'dashboard' && (
        <Dashboard
          profile={profile} goals={goals}
          sessionId={sessionId} refreshKey={refreshKey}
        />
      )}
      {tab === 'log' && (
        <FoodLogger
          sessionId={sessionId}
          onLogged={onFoodAction}
          refreshKey={refreshKey}
        />
      )}
      {tab === 'add' && (
        <AddFood
          sessionId={sessionId}
          onFoodAdded={onFoodAction}
        />
      )}
      {tab === 'history' && (
        <HistoryChart
          sessionId={sessionId}
          goals={goals}
          profile={profile}
        />
      )}
      {tab === 'ai' && (
        <AIChat
          sessionId={sessionId}
          profile={profile}
          goals={goals}
        />
      )}
      {tab === 'settings' && (
        <Settings
          profile={profile}
          goals={goals}
          sessionId={sessionId}
          onReset={onReset}
        />
      )}

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <button
            key={n.id}
            className={`nav-item ${tab === n.id ? 'active' : ''}`}
            onClick={() => setTab(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
