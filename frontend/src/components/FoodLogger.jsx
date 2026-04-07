import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from '../services/api'

export default function FoodLogger({ onLog }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])

  useEffect(() => {
    fetchSuggestions()
  }, [])

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/food_suggestions?limit=8`)
      const data = await response.json()
      setSuggestions(data.suggestions || [])
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    }
  }

  const searchFoods = async () => {
    if (!searchQuery.trim()) return
    
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/search_foods?query=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data.results || [])
    } catch (error) {
      console.error('Error searching foods:', error)
      setMessage('❌ Error searching. Check backend connection.')
    } finally {
      setLoading(false)
    }
  }

  const logFood = async (food) => {
    setLoading(true)
    try {
      const url = `${API_BASE_URL}/log_food?name=${encodeURIComponent(food.name)}&quantity=${quantity}&unit=${food.unit || 'serving'}&notes=${encodeURIComponent(notes)}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ Logged ${quantity} × ${food.name}. ${data.advice}`)
        setTimeout(() => setMessage(''), 4000)
        if (onLog) onLog()
        setSearchQuery('')
        setSearchResults([])
        setQuantity(1)
        setNotes('')
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
            placeholder="e.g., chicken breast, homemade paneer, protein shake..."
            onKeyPress={(e) => e.key === 'Enter' && searchFoods()}
          />
          <button onClick={searchFoods} disabled={loading}>Search</button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h3>Results:</h3>
            {searchResults.map((food, idx) => (
              <div key={idx} className="food-item" onClick={() => logFood(food)}>
                <div className="food-name">{food.name}</div>
                <div className="food-nutrition">
                  <span>🥩 {food.protein}g</span>
                  <span>🍳 {food.cholesterol}mg</span>
                  <span>🔥 {food.calories}cal</span>
                  <span className="food-unit">per {food.unit}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="suggestions-section">
        <h3>⭐ Frequently Used</h3>
        <div className="suggestions-grid">
          {suggestions.map((food, idx) => (
            <button key={idx} onClick={() => logFood(food)} className="suggestion-btn">
              {food.name}
              <small>{food.protein}g protein</small>
            </button>
          ))}
        </div>
      </div>

      <div className="quantity-section">
        <h3>⚙️ Log Options</h3>
        <div className="quantity-control">
          <label>Quantity:</label>
          <input 
            type="number" 
            value={quantity} 
            onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
            step="0.5"
            min="0.1"
          />
          <input 
            type="text" 
            placeholder="Notes (optional)" 
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {message && <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  )
}
