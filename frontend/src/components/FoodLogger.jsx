import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function FoodLogger() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
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

  const searchFoods = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/food/search?query=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Error searching foods:', error)
      setMessage('❌ Error searching. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const logFood = async (food) => {
    setLoading(true)
    try {
      const url = `${API_BASE_URL}/food/log?name=${encodeURIComponent(food.name)}&quantity=${quantity}&unit=${food.default_unit || 'serving'}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ Logged ${quantity} × ${food.name}`)
        setTimeout(() => setMessage(''), 3000)
        setSearchQuery('')
        setSearchResults([])
        setQuantity(1)
      } else {
        setMessage(`❌ ${data.error || 'Failed to log food'}`)
      }
    } catch (error) {
      console.error('Error logging food:', error)
      setMessage('❌ Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="food-logger">
      <div className="search-section">
        <h2>🔍 Search Food</h2>
        <div className="search-box">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for food..."
            onKeyPress={(e) => e.key === 'Enter' && searchFoods()}
          />
          <button onClick={searchFoods} disabled={loading}>Search</button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Search Results:</h3>
            {searchResults.map((food, idx) => (
              <div key={idx} className="food-item" onClick={() => logFood(food)}>
                <div className="food-name">{food.name}</div>
                <div className="food-nutrition">
                  <span>🥩 {food.protein_per_unit}g</span>
                  <span>🍞 {food.carbs_per_unit}g</span>
                  <span>🍳 {food.cholesterol_per_unit}mg</span>
                  <span>💰 ₹{food.cost}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="foods-section">
        <h3>📚 Your Food Library</h3>
        <div className="food-grid">
          {foods.map((food) => (
            <button key={food.id} onClick={() => logFood(food)} className="food-btn" disabled={loading}>
              {food.name}
              <small>🥩 {food.protein_per_unit}g | 💰 ₹{food.cost}</small>
            </button>
          ))}
        </div>
        {foods.length === 0 && (
          <p className="empty-message">No foods added yet. Go to "Add Food" tab to add your first food!</p>
        )}
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
