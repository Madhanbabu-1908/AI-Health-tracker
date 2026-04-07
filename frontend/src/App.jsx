import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import FoodLogger from './components/FoodLogger'
import AddFood from './components/AddFood'
import CustomFoods from './components/CustomFoods'
import HistoryChart from './components/HistoryChart'
import AIChat from './components/AIChat'
import { API_BASE_URL } from './services/api'
import './styles/App.css'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/profile`)
      const data = await response.json()
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshData = () => {
    setRefreshTrigger(prev => prev + 1)
    fetchProfile()
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="app">
      <header>
        <h1>🏋️ Madhan Health Tracker</h1>
        <p>{profile?.weight}kg • Goal: {profile?.goal_protein}g protein</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
          📊 Dashboard
        </button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>
          🍽️ Log Food
        </button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>
          ➕ Add Food
        </button>
        <button className={activeTab === 'myfoods' ? 'active' : ''} onClick={() => setActiveTab('myfoods')}>
          📚 My Foods
        </button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
          📈 History
        </button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
          🤖 AI Coach
        </button>
      </div>

      <div className="content">
        {activeTab === 'dashboard' && <Dashboard profile={profile} refreshTrigger={refreshTrigger} />}
        {activeTab === 'log' && <FoodLogger onLog={refreshData} />}
        {activeTab === 'add' && <AddFood onAdd={refreshData} />}
        {activeTab === 'myfoods' && <CustomFoods onDelete={refreshData} />}
        {activeTab === 'history' && <HistoryChart refreshTrigger={refreshTrigger} />}
        {activeTab === 'ai' && <AIChat />}
      </div>
    </div>
  )
}

export default App
