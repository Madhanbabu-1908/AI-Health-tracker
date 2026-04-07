import React, { useState } from 'react'
import { API_BASE_URL } from '../services/api'

export default function AddFood({ onAdd }) {
  const [formData, setFormData] = useState({
    name: '',
    protein: '',
    cholesterol: '',
    calories: '',
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
    
    const protein = parseFloat(formData.protein)
    const cholesterol = parseFloat(formData.cholesterol)
    const calories = parseFloat(formData.calories)
    
    if (isNaN(protein) || isNaN(cholesterol) || isNaN(calories)) {
      setMessage('❌ Please enter valid numbers for nutrition values')
      return
    }
    
    setLoading(true)
    try {
      const url = `${API_BASE_URL}/add_food?name=${encodeURIComponent(formData.name)}&protein=${protein}&cholesterol=${cholesterol}&calories=${calories}&unit=${encodeURIComponent(formData.unit)}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setMessage(data.message)
        setFormData({ name: '', protein: '', cholesterol: '', calories: '', unit: 'serving' })
        setTimeout(() => setMessage(''), 3000)
        if (onAdd) onAdd()
      } else {
        setMessage('❌ Failed to add food')
      }
    } catch (error) {
      console.error('Error adding food:', error)
      setMessage('❌ Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-food">
      <h2>➕ Add Custom Food</h2>
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
            <label>Protein (g per {formData.unit}) *</label>
            <input 
              type="number" 
              name="protein" 
              value={formData.protein}
              onChange={handleChange}
              step="0.1"
              placeholder="e.g., 25"
              required
            />
          </div>

          <div className="form-group">
            <label>Cholesterol (mg per {formData.unit}) *</label>
            <input 
              type="number" 
              name="cholesterol" 
              value={formData.cholesterol}
              onChange={handleChange}
              step="1"
              placeholder="e.g., 80"
              required
            />
          </div>

          <div className="form-group">
            <label>Calories (per {formData.unit}) *</label>
            <input 
              type="number" 
              name="calories" 
              value={formData.calories}
              onChange={handleChange}
              step="1"
              placeholder="e.g., 250"
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
            placeholder="e.g., plate, bowl, cup, 100g"
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
          <li>Use nutritional labels on packaged foods</li>
          <li>Search online: "nutrition facts [food name]"</li>
          <li>For homemade food, sum up ingredients and divide by servings</li>
          <li>You can edit or delete foods from "My Foods" tab</li>
        </ul>
      </div>
    </div>
  )
}
