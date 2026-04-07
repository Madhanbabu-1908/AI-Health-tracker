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
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPrediction, setAiPrediction] = useState(null)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const fetchAIPrediction = async () => {
    if (!formData.name.trim()) {
      setMessageType('error')
      setMessage('❌ Please enter food name first')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setAiLoading(true)
    setAiPrediction(null)

    try {
      const response = await fetch(`${API_BASE_URL}/ai/predict-nutrition?food_name=${encodeURIComponent(formData.name)}`, {
        method: 'GET'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAiPrediction(data.nutrition)
        setFormData(prev => ({
          ...prev,
          protein: data.nutrition.protein || '',
          carbs: data.nutrition.carbs || '',
          cholesterol: data.nutrition.cholesterol || '',
          iron: data.nutrition.iron || '',
          calories: data.nutrition.calories || ''
        }))
        setMessageType('success')
        setMessage(`🤖 AI predicted nutrition for "${formData.name}". You can edit values if needed.`)
        setTimeout(() => setMessage(''), 4000)
      } else {
        setMessageType('error')
        setMessage(`❌ Could not predict nutrition. Please enter manually.`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error fetching AI prediction:', error)
      setMessageType('error')
      setMessage('❌ AI prediction failed. Please enter manually.')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setMessageType('error')
      setMessage('❌ Please enter food name')
      setTimeout(() => setMessage(''), 3000)
      return
    }
    
    if (!formData.cost) {
      setMessageType('error')
      setMessage('❌ Please enter cost')
      setTimeout(() => setMessage(''), 3000)
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
        setMessageType('success')
        setMessage(`✅ "${formData.name}" added to your foods!`)
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
        setAiPrediction(null)
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessageType('error')
        setMessage(`❌ ${data.detail || 'Failed to add food'}`)
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      console.error('Error:', error)
      setMessageType('error')
      setMessage('❌ Error connecting to server')
      setTimeout(() => setMessage(''), 3000)
    }
    
    setLoading(false)
  }

  return (
    <div className="add-food">
      <h2>➕ Add Custom Food</h2>
      <p className="info-text">Add your own foods with their nutrition values. Try the <strong>🤖 AI Auto-Fill</strong> button!</p>
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>📝 Food Details</h3>
          
          <div className="form-group">
            <label>Food Name *</label>
            <div className="name-input-group">
              <input 
                type="text" 
                name="name" 
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Homemade Chicken Curry, Protein Shake"
                required
              />
              <button 
                type="button" 
                onClick={fetchAIPrediction} 
                className="ai-btn"
                disabled={aiLoading}
              >
                {aiLoading ? '🤖 Predicting...' : '🤖 AI Auto-Fill'}
              </button>
            </div>
            <small>Enter food name and click AI Auto-Fill to get nutrition predictions</small>
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
            <small>How you measure this food</small>
          </div>
        </div>

        {aiPrediction && (
          <div className="ai-prediction-banner">
            <span>🤖</span>
            <div>
              <strong>AI Predicted Values</strong>
              <p>Based on web search for "{formData.name}"</p>
            </div>
          </div>
        )}

        <div className="form-section">
          <h3>🥗 Nutrition Information (per serving)</h3>
          
          <div className="form-row">
            <div className="form-group">
              <label>🥩 Protein (g)</label>
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
              <label>🍞 Carbs (g)</label>
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
              <label>🍳 Cholesterol (mg)</label>
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
              <label>🩸 Iron (mg)</label>
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
              <label>🔥 Calories</label>
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
              <label>💰 Cost (₹) *</label>
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
        </div>

        <button type="submit" disabled={loading} className="submit-btn">
          {loading ? 'Adding...' : '➕ Add to My Foods'}
        </button>
      </form>

      {message && (
        <div className={`message ${messageType === 'success' ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
      
      <div className="tips">
        <h4>💡 Tips:</h4>
        <ul>
          <li>Enter food name and click <strong>🤖 AI Auto-Fill</strong> to automatically get nutrition values</li>
          <li>You can edit the AI-predicted values before saving</li>
          <li>Check nutritional labels on packaged foods for accuracy</li>
          <li>For homemade food, sum up ingredients and divide by servings</li>
          <li>Once added, you can log this food from the "Log Food" tab</li>
        </ul>
      </div>
    </div>
  )
        }
