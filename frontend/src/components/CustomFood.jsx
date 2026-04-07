import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function CustomFoods({ onDelete }) {
  const [foods, setFoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchFoods()
  }, [])

  const fetchFoods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/my_foods`)
      const data = await response.json()
      setFoods(data.foods || [])
    } catch (error) {
      console.error('Error fetching foods:', error)
      setMessage('❌ Error loading your foods')
    } finally {
      setLoading(false)
    }
  }

  const deleteFood = async (foodId, foodName) => {
    if (!confirm(`Delete "${foodName}" from your foods?`)) return
    
    try {
      const response = await fetch(`${API_BASE_URL}/food/${foodId}`, { method: 'DELETE' })
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ Deleted "${foodName}"`)
        setTimeout(() => setMessage(''), 2000)
        fetchFoods()
        if (onDelete) onDelete()
      } else {
        setMessage('❌ Failed to delete')
      }
    } catch (error) {
      console.error('Error deleting food:', error)
      setMessage('❌ Error connecting to server')
    }
  }

  if (loading) return <div className="loading">Loading your foods...</div>

  return (
    <div className="custom-foods">
      <h2>📚 My Custom Foods</h2>
      
      {foods.length === 0 ? (
        <div className="empty-state">
          <p>No custom foods added yet.</p>
          <p>Go to "Add Food" tab to create your own foods!</p>
        </div>
      ) : (
        <div className="foods-list">
          {foods.map(food => (
            <div key={food.id} className="food-card">
              <div className="food-header">
                <h3>{food.name}</h3>
                <button onClick={() => deleteFood(food.id, food.name)} className="delete-btn">🗑️</button>
              </div>
              <div className="food-details">
                <div className="detail">
                  <span className="label">🥩 Protein:</span>
                  <span>{food.protein_per_unit}g per {food.default_unit}</span>
                </div>
                <div className="detail">
                  <span className="label">🍳 Cholesterol:</span>
                  <span>{food.cholesterol_per_unit}mg</span>
                </div>
                <div className="detail">
                  <span className="label">🔥 Calories:</span>
                  <span>{food.calories_per_unit}cal</span>
                </div>
                <div className="detail">
                  <span className="label">📊 Used:</span>
                  <span>{food.usage_count} times</span>
                </div>
              </div>
              <div className="food-meta">
                <small>Added: {new Date(food.created_at).toLocaleDateString()}</small>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {message && <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  )
}
