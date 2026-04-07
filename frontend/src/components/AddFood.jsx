import React, { useState } from 'react'
import { API_BASE_URL } from '../services/api'

export default function AddFood() {
  const [formData, setFormData] = useState({
    name: '',
    protein: '',
    carbs: '',
    cholesterol: '',
    iron: '',
    calories: '',
    cost: '',
    unit: 'serving'
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setMessage('❌ Please enter food name')
      return
    }
    
    if (!formData.cost) {
      setMessage('❌ Please enter cost')
      return
    }
    
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        name: formData.name,
        cost: parseFloat(formData.cost),
        protein: parseFloat(formData.protein) || 0,
        carbs: parseFloat(formData.carbs) || 0,
        cholesterol: parseFloat(formData.cholesterol) || 0,
        iron: parseFloat(formData.iron) || 0,
        calories: parseFloat(formData.calories) || 0,
        unit: formData.unit
      })
      
      const response = await fetch(`${API_BASE_URL}/food/add?${params}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setMessage(`✅ Added "${formData.name}" to your foods!`)
        setFormData({
          name: '',
          protein: '',
          carbs: '',
          cholesterol: '',
          iron: '',
          calories: '',
          cost: '',
          unit: 'serving'
        })
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(`❌ ${data.detail || 'Failed to add food'}`)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessage('❌ Error connecting to server')
    }
    
    setLoading(false)
  }

  return (
    <div className="add-food">
      <h2>➕ Add Custom Food</h2>
      <p className="info-text">Add your own foods with their nutrition values. They will appear in your food list for logging.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Food Name *</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Homemade Chicken Curry, Protein Shake"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Protein (g)</label>
            <input 
              type="number" 
              name="protein" 
              value={formData.protein}
              onChange={handleChange}
              step="0.1"
              placeholder="e.g., 25"
            />
          </div>

          <div className="form-group">
            <label>Carbs (g)</label>
            <input 
              type="number" 
              name="carbs" 
              value={formData.carbs}
              onChange={handleChange}
              step="0.1"
              placeholder="e.g., 30"
            />
          </div>

          <div className="form-group">
            <label>Cholesterol (mg)</label>
            <input 
              type="number" 
              name="cholesterol" 
              value={formData.cholesterol}
              onChange={handleChange}
              step="1"
              placeholder="e.g., 80"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Iron (mg)</label>
            <input 
              type="number" 
              name="iron" 
              value={formData.iron}
              onChange={handleChange}
              step="0.1"
              placeholder="e.g., 2.5"
            />
          </div>

          <div className="form-group">
            <label>Calories</label>
            <input 
              type="number" 
              name="calories" 
              value={formData.calories}
              onChange={handleChange}
              step="1"
              placeholder="e.g., 250"
            />
          </div>

          <div className="form-group">
            <label>Cost (₹) *</label>
            <input 
              type="number" 
              name="cost" 
              value={formData.cost}
              onChange={handleChange}
              step="0.01"
              placeholder="e.g., 150"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Serving Unit</label>
          <input 
            type="text" 
            name="unit" 
            value={formData.unit}
            onChange={handleChange}
            placeholder="e.g., plate, 100g, cup"
          />
          <small>How you measure this food (serving, 100g, cup, etc.)</small>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Adding...' : '➕ Add to My Foods'}
        </button>
      </form>

      {message && <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>}
      
      <div className="tips">
        <h4>💡 Tips:</h4>
        <ul>
          <li>Check nutritional labels on packaged foods</li>
          <li>For homemade food, sum up ingredients and divide by servings</li>
          <li>Once added, you can log this food from the "Log Food" tab</li>
          <li>You can add as many foods as you want - they're all saved to your personal database</li>
        </ul>
      </div>
    </div>
  )
}
