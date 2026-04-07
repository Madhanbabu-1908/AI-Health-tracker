import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function FoodLogger() {
  const [foods, setFoods] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadFoods()
  }, [])

  const loadFoods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/food/list`)
      const data = await response.json()
      setFoods(data.foods || [])
    } catch (error) {
      console.error('Error loading foods:', error)
    }
  }

  const logFood = async (food) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/food/log?name=${encodeURIComponent(food.name)}&quantity=${quantity}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ Logged ${quantity} × ${food.name}`)
        setTimeout(() => setMessage(''), 3000)
        setQuantity(1)
      } else {
        setMessage(`❌ ${data.detail || 'Failed to log food'}`)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('❌ Error connecting to server')
    }
    setLoading(false)
  }

  if (foods.length === 0) {
    return (
      <div className="food-logger">
        <h2>🍽️ Log Food</h2>
        <div className="empty-state">
          <p>You haven't added any foods yet!</p>
          <p>Go to the <strong>"Add Food"</strong> tab to add your first food.</p>
          <p>Once added, you'll see them here to log.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="food-logger">
      <h2>🍽️ Log Your Meal</h2>
      
      <div className="foods-section">
        <h3>📚 Your Foods ({foods.length})</h3>
        <div className="food-grid">
          {foods.map((food) => (
            <button 
              key={food.id} 
              onClick={() => logFood(food)} 
              className="food-card"
              disabled={loading}
            >
              <div className="food-name">{food.name}</div>
              <div className="food-nutrition">
                <span>🥩 {food.protein_per_unit}g</span>
                <span>🔥 {food.calories_per_unit}cal</span>
                <span>💰 ₹{food.cost}</span>
              </div>
              <small>per {food.default_unit}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="quantity-section">
        <h3>⚙️ Quantity</h3>
        <div className="quantity-control">
          <label>Number of servings:</label>
          <input 
            type="number" 
            value={quantity} 
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
            step="0.5"
            min="0.1"
          />
        </div>
      </div>

      {message && <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  )
}
