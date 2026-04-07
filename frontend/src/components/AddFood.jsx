import React, { useState } from 'react'
import { API_BASE_URL } from '../services/api'

export default function AddFood() {
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    unit: 'serving'
  })
  const [predictedNutrition, setPredictedNutrition] = useState(null)
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
    
    const cost = parseFloat(formData.cost)
    if (isNaN(cost)) {
      setMessage('❌ Please enter cost')
      return
    }
    
    setLoading(true)
    try {
      const url = `${API_BASE_URL}/food/add?name=${encodeURIComponent(formData.name)}&cost=${cost}&unit=${encodeURIComponent(formData.unit)}`
      const response = await fetch(url, { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setPredictedNutrition(data.nutrition_predicted)
        setMessage(`✅ Added "${formData.name}"! AI predicted nutrition values.`)
        setFormData({ name: '', cost: '', unit: 'serving' })
        setTimeout(() => setMessage(''), 4000)
      } else {
        setMessage('❌ Failed to add food')
      }
    } catch (error) {
      setMessage('❌ Error connecting to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-food">
      <h2>➕ Add New Food</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Food Name *</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="e.g., Homemade Chicken Curry" required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cost (₹) *</label>
            <input type="number" name="cost" value={formData.cost} onChange={handleChange} step="0.01" placeholder="e.g., 150" required />
          </div>
          <div className="form-group">
            <label>Serving Unit</label>
            <input type="text" name="unit" value={formData.unit} onChange={handleChange} placeholder="e.g., plate, 100g" />
          </div>
        </div>

        <button type="submit" disabled={loading}>{loading ? 'AI Analyzing...' : '➕ Add Food'}</button>
      </form>

      {predictedNutrition && (
        <div className="predicted-nutrition">
          <h3>🤖 AI Predicted Nutrition (per serving)</h3>
          <div className="nutrition-grid">
            <div>🥩 Protein: {predictedNutrition.protein || 0}g</div>
            <div>🍞 Carbs: {predictedNutrition.carbs || 0}g</div>
            <div>🍳 Cholesterol: {predictedNutrition.cholesterol || 0}mg</div>
            <div>🩸 Iron: {predictedNutrition.iron || 0}mg</div>
            <div>🔥 Calories: {predictedNutrition.calories || 0}</div>
          </div>
          <small>You can edit these values later by re-adding the food</small>
        </div>
      )}

      {message && <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  )
}
