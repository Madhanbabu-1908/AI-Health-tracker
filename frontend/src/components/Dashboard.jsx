import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function Dashboard({ profile }) {
  const [todayData, setTodayData] = useState({ protein: 0, carbs: 0, cholesterol: 0, iron: 0, calories: 0, cost: 0 })
  const [goals, setGoals] = useState({ protein_goal: 100, cholesterol_limit: 300, carb_limit: 300, iron_goal: 15, calorie_goal: 2500 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodayData()
    fetchGoals()
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

  const fetchGoals = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/nutrition-goals`)
      const data = await response.json()
      setGoals(data)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🥩 Protein</h3>
          <div className="progress-bar"><div className="progress" style={{ width: `${Math.min((todayData.protein / goals.protein_goal) * 100, 100)}%` }}></div></div>
          <p>{todayData.protein.toFixed(1)} / {goals.protein_goal}g</p>
        </div>
        <div className="stat-card">
          <h3>🍞 Carbs</h3>
          <div className="progress-bar"><div className="progress" style={{ width: `${Math.min((todayData.carbs / goals.carb_limit) * 100, 100)}%`, background: '#ffaa44' }}></div></div>
          <p>{todayData.carbs.toFixed(1)} / {goals.carb_limit}g</p>
        </div>
        <div className="stat-card">
          <h3>🍳 Cholesterol</h3>
          <div className="progress-bar"><div className="progress" style={{ width: `${Math.min((todayData.cholesterol / goals.cholesterol_limit) * 100, 100)}%`, background: todayData.cholesterol > goals.cholesterol_limit ? '#ff4444' : '#4caf50' }}></div></div>
          <p>{todayData.cholesterol.toFixed(0)} / {goals.cholesterol_limit}mg</p>
        </div>
        <div className="stat-card">
          <h3>🩸 Iron</h3>
          <div className="progress-bar"><div className="progress" style={{ width: `${Math.min((todayData.iron / goals.iron_goal) * 100, 100)}%`, background: '#82ca9d' }}></div></div>
          <p>{todayData.iron.toFixed(1)} / {goals.iron_goal}mg</p>
        </div>
        <div className="stat-card">
          <h3>🔥 Calories</h3>
          <div className="progress-bar"><div className="progress" style={{ width: `${Math.min((todayData.calories / goals.calorie_goal) * 100, 100)}%` }}></div></div>
          <p>{todayData.calories.toFixed(0)} / {goals.calorie_goal}</p>
        </div>
        <div className="stat-card">
          <h3>💰 Cost</h3>
          <p>₹{todayData.cost.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
