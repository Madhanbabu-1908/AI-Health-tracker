import React, { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('health_theme') || 'system'
  })

  // Derive actual applied theme
  const [appliedTheme, setAppliedTheme] = useState('dark')

  useEffect(() => {
    const apply = (t) => {
      document.documentElement.setAttribute('data-theme', t)
      setAppliedTheme(t)
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches ? 'dark' : 'light')
      const handler = (e) => apply(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    } else {
      apply(theme)
    }
  }, [theme])

  const toggleTheme = (t) => {
    setTheme(t)
    localStorage.setItem('health_theme', t)
  }

  return (
    <AppContext.Provider value={{ theme, appliedTheme, toggleTheme }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
