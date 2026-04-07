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
  }, [])

  const fetchTodayData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/today`)
      const data = await response.json()
      setTodayData(data)
    } catch (error) {
      console.error('Error fetching today data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Safe defaults if nutritionGoals is not yet loaded
  const goals = nutritionGoals || {
    protein_goal: 100,
    calorie_goal: 2500,
    cholesterol_limit: 300,
    iron_goal: 15
  }

  if (loading) return <div className="loading">Loading dashboard...</div>

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🥩 Protein</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(todayData.percentages?.protein || 0, 100)}%` }}>
              {todayData.percentages?.protein || 0}%
            </div>
          </div>
          <p>{todayData.totals?.protein?.toFixed(1) || 0} / {goals.protein_goal}g</p>
        </div>

        <div className="stat-card">
          <h3>🍞 Carbs</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min((todayData.totals?.carbs || 0) / (goals.carb_limit || 300) * 100, 100)}%`, background: '#ffaa44' }}>
              {Math.min((todayData.totals?.carbs || 0) / (goals.carb_limit || 300) * 100, 100).toFixed(0)}%
            </div>
          </div>
          <p>{(todayData.totals?.carbs || 0).toFixed(1)} / {goals.carb_limit || 300}g</p>
        </div>

        <div className="stat-card">
          <h3>🍳 Cholesterol</h3>
          <div className="progress-bar">
            <div className="progress" style={{ 
              width: `${Math.min(todayData.percentages?.cholesterol || 0, 100)}%`, 
              background: (todayData.percentages?.cholesterol || 0) > 80 ? '#ff4444' : '#4caf50' 
            }}>
              {todayData.percentages?.cholesterol || 0}%
            </div>
          </div>
          <p>{(todayData.totals?.cholesterol || 0).toFixed(0)} / {goals.cholesterol_limit}mg</p>
        </div>

        <div className="stat-card">
          <h3>🩸 Iron</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(todayData.percentages?.iron || 0, 100)}%`, background: '#82ca9d' }}>
              {todayData.percentages?.iron || 0}%
            </div>
          </div>
          <p>{(todayData.totals?.iron || 0).toFixed(1)} / {goals.iron_goal}mg</p>
        </div>

        <div className="stat-card">
          <h3>🔥 Calories</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(todayData.percentages?.calories || 0, 100)}%` }}>
              {todayData.percentages?.calories || 0}%
            </div>
          </div>
          <p>{(todayData.totals?.calories || 0).toFixed(0)} / {goals.calorie_goal}</p>
        </div>

        <div className="stat-card">
          <h3>💰 Cost</h3>
          <p>₹{(todayData.totals?.cost || 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="ai-advice">
        <h3>🤖 AI Coach Says:</h3>
        <p>Keep up the great work! Track your meals to see personalized advice.</p>
      </div>
    </div>
  )
}
