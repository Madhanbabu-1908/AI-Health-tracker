import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function Dashboard({ profile, refreshTrigger }) {
  const [todayData, setTodayData] = useState({ protein: 0, cholesterol: 0, calories: 0 })
  const [advice, setAdvice] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodayData()
  }, [refreshTrigger])

  const fetchTodayData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/today`)
      const data = await response.json()
      setTodayData({
        protein: data.protein || 0,
        cholesterol: data.cholesterol || 0,
        calories: data.calories || 0
      })
      
      const remainingProtein = Math.max(0, profile.goal_protein - (data.protein || 0))
      const remainingChol = Math.max(0, profile.cholesterol_limit - (data.cholesterol || 0))
      
      if (remainingProtein <= 0) {
        setAdvice('🎉 Amazing! You hit your protein goal. Focus on recovery.')
      } else if (remainingChol <= 0) {
        setAdvice('⚠️ Cholesterol limit reached. Switch to plant proteins.')
      } else {
        setAdvice(`💪 Need ${remainingProtein.toFixed(1)}g more protein. ${remainingChol.toFixed(0)}mg cholesterol left.`)
      }
    } catch (error) {
      console.error('Error fetching today data:', error)
      setAdvice('Connect to backend to see your progress')
    } finally {
      setLoading(false)
    }
  }

  const proteinPercent = (todayData.protein / profile.goal_protein) * 100
  const cholesterolPercent = (todayData.cholesterol / profile.cholesterol_limit) * 100

  if (loading) return <div className="loading-stats">Loading stats...</div>

  return (
    <div className="dashboard">
      <div className="stats">
        <div className="stat-card">
          <h3>🥩 Protein</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(proteinPercent, 100)}%` }}>
              <span>{Math.min(proteinPercent, 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="stat-value">{todayData.protein.toFixed(1)} / {profile.goal_protein}g</p>
        </div>

        <div className="stat-card">
          <h3>🍳 Cholesterol</h3>
          <div className="progress-bar">
            <div className="progress" style={{ 
              width: `${Math.min(cholesterolPercent, 100)}%`, 
              background: cholesterolPercent > 80 ? '#ff4444' : '#ffaa44' 
            }}>
              <span>{Math.min(cholesterolPercent, 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="stat-value">{todayData.cholesterol.toFixed(0)} / {profile.cholesterol_limit}mg</p>
          {todayData.cholesterol > profile.cholesterol_limit && <p className="warning">⚠️ LDL Risk! Consider plant proteins tomorrow.</p>}
        </div>

        <div className="stat-card">
          <h3>🔥 Calories</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min((todayData.calories / profile.calorie_goal) * 100, 100)}%` }}>
              <span>{Math.min((todayData.calories / profile.calorie_goal) * 100, 100).toFixed(0)}%</span>
            </div>
          </div>
          <p className="stat-value">{todayData.calories.toFixed(0)} / {profile.calorie_goal} kcal</p>
        </div>
      </div>

      <div className="ai-advice">
        <h3>🤖 AI Coach Says:</h3>
        <p>{advice}</p>
      </div>
    </div>
  )
}
