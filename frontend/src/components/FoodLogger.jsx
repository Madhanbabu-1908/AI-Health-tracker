import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function FoodLogger() {
  const [foods, setFoods] = useState([])
  const [selectedFood, setSelectedFood] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)
  const [todaysEntries, setTodaysEntries] = useState([])

  useEffect(() => {
    loadFoods()
    loadTodaysEntries()
    
    // Listen for food updates
    window.addEventListener('foodsUpdated', loadFoods)
    return () => window.removeEventListener('foodsUpdated', loadFoods)
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

  const loadTodaysEntries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/today`)
      const data = await response.json()
      // This would need a separate endpoint to get today's entries
    } catch (error) {
      console.error('Error loading entries:', error)
    }
  }

  const handleFoodSelect = (e) => {
    const foodId = e.target.value
    const food = foods.find(f => f.id === foodId)
    setSelectedFood(food)
  }

  const logFood = async () => {
    if (!selectedFood) {
      setMessageType('error')
      setMessage('❌ Please select a food first')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/food/log?name=${encodeURIComponent(selectedFood.name)}&quantity=${quantity}`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setMessageType('success')
        setMessage(`✅ Logged ${quantity} × ${selectedFood.name}`)
        setTimeout(() => setMessage(''), 3000)
        setQuantity(1)
        setSelectedFood(null)
        // Reset select dropdown
        const select = document.getElementById('food-select')
        if (select) select.value = ''
        // Refresh dashboard
        window.dispatchEvent(new Event('foodLogged'))
      } else {
        setMessageType('error')
        setMessage(`❌ ${data.detail || 'Failed to log food'}`)
      }
    } catch (error) {
      setMessageType('error')
      setMessage('❌ Error connecting to server')
    }
    setLoading(false)
  }

  if (foods.length === 0) {
    return (
      <div className="food-logger">
        <h2>🍽️ Log Your Meal</h2>
        <div className="empty-state">
          <p>📭 You haven't added any foods yet!</p>
          <p>Go to the <strong>"Add Food"</strong> tab to add your first food.</p>
          <p>Once added, you'll see them here to log.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="food-logger">
      <h2>🍽️ Log Your Meal</h2>
      
      <div className="form-section">
        <h3>📋 Select Food</h3>
        <select id="food-select" className="food-select" onChange={handleFoodSelect} value={selectedFood?.id || ''}>
          <option value="">-- Select a food --</option>
          {foods.map(food => (
            <option key={food.id} value={food.id}>
              {food.name} - {food.protein_per_unit}g protein, {food.calories_per_unit} cal, ₹{food.cost}
            </option>
          ))}
        </select>
      </div>

      {selectedFood && (
        <div className="selected-food-info">
          <h3>📊 Nutrition Facts (per serving)</h3>
          <div className="nutrition-preview">
            <div className="nutrition-item">🥩 Protein: {selectedFood.protein_per_unit}g</div>
            <div className="nutrition-item">🍞 Carbs: {selectedFood.carbs_per_unit}g</div>
            <div className="nutrition-item">🍳 Cholesterol: {selectedFood.cholesterol_per_unit}mg</div>
            <div className="nutrition-item">🩸 Iron: {selectedFood.iron_per_unit}mg</div>
            <div className="nutrition-item">🔥 Calories: {selectedFood.calories_per_unit}</div>
            <div className="nutrition-item">💰 Cost: ₹{selectedFood.cost}</div>
          </div>
        </div>
      )}

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

      <button onClick={logFood} disabled={loading || !selectedFood} className="log-btn">
        {loading ? 'Logging...' : '➕ Add to Today\'s Log'}
      </button>

      {message && (
        <div className={`message ${messageType === 'success' ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  )
}
