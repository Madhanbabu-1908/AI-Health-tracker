import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import FoodLogger from './components/FoodLogger'
import AddFood from './components/AddFood'
import HistoryChart from './components/HistoryChart'
import AIChat from './components/AIChat'
import { API_BASE_URL } from './services/api'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [profileInitialized, setProfileInitialized] = useState(false)
  const [nickname, setNickname] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')

  useEffect(() => {
    checkProfile()
  }, [])

  const checkProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        setProfileInitialized(true)
      }
    } catch (error) {
      console.error('Profile not found')
    }
  }

  const initializeProfile = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch(`${API_BASE_URL}/profile/init?nickname=${nickname}&height=${parseFloat(height)}&weight=${parseFloat(weight)}`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setProfile(data.profile)
        setProfileInitialized(true)
      }
    } catch (error) {
      alert('Error initializing profile')
    }
  }

  if (!profileInitialized) {
    return (
      <div className="app">
        <header>
          <h1>🏋️ AI Health Tracker</h1>
        </header>
        <div className="content">
          <div className="onboarding">
            <h2>Welcome! Let's set up your profile</h2>
            <form onSubmit={initializeProfile}>
              <input type="text" placeholder="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
              <input type="number" placeholder="Height (cm)" value={height} onChange={(e) => setHeight(e.target.value)} required />
              <input type="number" placeholder="Weight (kg)" value={weight} onChange={(e) => setWeight(e.target.value)} required />
              <button type="submit">Start My Journey</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>🏋️ AI Health Tracker</h1>
        <p>👤 {profile.nickname} • BMI: {profile.bmi?.toFixed(1)} • Goal: 100g protein</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>🍽️ Log Food</button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕ Add Food</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>📈 History</button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>🤖 AI Coach</button>
      </div>

      <div className="content">
        {activeTab === 'dashboard' && <Dashboard profile={profile} />}
        {activeTab === 'log' && <FoodLogger />}
        {activeTab === 'add' && <AddFood />}
        {activeTab === 'history' && <HistoryChart />}
        {activeTab === 'ai' && <AIChat profile={profile} />}
      </div>
    </div>
  )
}

export default App
