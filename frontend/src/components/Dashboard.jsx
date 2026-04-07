import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function Dashboard({ profile, nutritionGoals }) {
  const [todayData, setTodayData] = useState({ 
    totals: { protein: 0, carbs: 0, cholesterol: 0, iron: 0, calories: 0, cost: 0 },
    percentages: { protein: 0, calories: 0, cholesterol: 0, iron: 0 }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodayData()
    const interval = setInterval(fetchTodayData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchTodayData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/today`)
      const data = await response.json()
      setTodayData(data)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const goals = nutritionGoals || {
    protein_goal: 100,
    calorie_goal: 2500,
    cholesterol_limit: 300,
    carb_limit: 300,
    iron_goal: 15
  }

  if (loading) {
    return (
      <div className="loading">
        <div>Loading your stats...</div>
      </div>
    )
  }

  const stats = [
    { icon: '🥩', title: 'Protein', current: todayData.totals?.protein || 0, goal: goals.protein_goal, unit: 'g', color: '#667eea' },
    { icon: '🍞', title: 'Carbs', current: todayData.totals?.carbs || 0, goal: goals.carb_limit || 300, unit: 'g', color: '#ffaa44' },
    { icon: '🍳', title: 'Cholesterol', current: todayData.totals?.cholesterol || 0, goal: goals.cholesterol_limit, unit: 'mg', color: '#ff4444' },
    { icon: '🩸', title: 'Iron', current: todayData.totals?.iron || 0, goal: goals.iron_goal, unit: 'mg', color: '#82ca9d' },
    { icon: '🔥', title: 'Calories', current: todayData.totals?.calories || 0, goal: goals.calorie_goal, unit: 'cal', color: '#ff6b6b' },
    { icon: '💰', title: 'Cost', current: todayData.totals?.cost || 0, goal: null, unit: '₹', color: '#4caf50' }
  ]

  // Calculate remaining protein
  const remainingProtein = Math.max(0, goals.protein_goal - (todayData.totals?.protein || 0))
  const proteinStatus = remainingProtein === 0 ? "✅ Goal met!" : `Need ${remainingProtein.toFixed(0)}g more`

  return (
    <div className="dashboard">
      {/* Daily Summary Card */}
      <div className="summary-card" style={{
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        borderRadius: '20px',
        padding: '20px',
        marginBottom: '20px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', opacity: 0.9 }}>Today's Progress</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{proteinStatus}</span>
        </div>
        <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
          {todayData.totals?.protein?.toFixed(0) || 0} / {goals.protein_goal}g
        </div>
        <div className="progress-bar" style={{ background: 'rgba(255,255,255,0.2)', height: '8px', borderRadius: '10px' }}>
          <div className="progress-fill" style={{ 
            width: `${Math.min((todayData.totals?.protein || 0) / goals.protein_goal * 100, 100)}%`,
            background: 'white',
            height: '8px',
            borderRadius: '10px'
          }} />
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-header">
              <h3>{stat.icon} {stat.title}</h3>
              <span className="stat-value">
                {stat.current.toFixed(1)}
                <span className="stat-unit"> / {stat.goal ? stat.goal + stat.unit : ''}</span>
              </span>
            </div>
            
            {stat.goal && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${Math.min((stat.current / stat.goal) * 100, 100)}%`,
                      background: `linear-gradient(90deg, ${stat.color}, ${stat.color}dd)`
                    }}
                  />
                </div>
                <div className="progress-stats">
                  <span className="progress-current">{Math.min((stat.current / stat.goal) * 100, 100).toFixed(0)}%</span>
                  <span className="progress-goal">Goal: {stat.goal}{stat.unit}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ai-advice">
        <h3>🤖 AI Coach Says:</h3>
        <p>
          {todayData.totals?.protein === 0 
            ? "Start by logging your first meal! I'll provide personalized recommendations based on your nutrition goals."
            : `Great progress! You've consumed ${todayData.totals?.protein.toFixed(0)}g of protein today. ${remainingProtein > 0 ? `Need ${remainingProtein.toFixed(0)}g more to reach your goal.` : 'You\'ve reached your protein goal! 🎉'}`}
        </p>
      </div>
    </div>
  )
      }
