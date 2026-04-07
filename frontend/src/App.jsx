import React, { useState, useEffect } from 'react'
import { API_BASE_URL } from './services/api'

// Simple dashboard component inline to avoid import issues
function Dashboard({ profile, nutritionGoals, todayData }) {
  const proteinPercent = nutritionGoals?.protein_goal ? (todayData.protein / nutritionGoals.protein_goal) * 100 : 0
  const caloriePercent = nutritionGoals?.calorie_goal ? (todayData.calories / nutritionGoals.calorie_goal) * 100 : 0
  const cholesterolPercent = nutritionGoals?.cholesterol_limit ? (todayData.cholesterol / nutritionGoals.cholesterol_limit) * 100 : 0

  return (
    <div className="dashboard">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>🥩 Protein</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(proteinPercent, 100)}%` }}>
              {Math.min(proteinPercent, 100).toFixed(0)}%
            </div>
          </div>
          <p>{todayData.protein.toFixed(1)} / {nutritionGoals?.protein_goal || 100}g</p>
        </div>

        <div className="stat-card">
          <h3>🍳 Cholesterol</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(cholesterolPercent, 100)}%`, background: cholesterolPercent > 80 ? '#ff4444' : '#ffaa44' }}>
              {Math.min(cholesterolPercent, 100).toFixed(0)}%
            </div>
          </div>
          <p>{todayData.cholesterol.toFixed(0)} / {nutritionGoals?.cholesterol_limit || 300}mg</p>
        </div>

        <div className="stat-card">
          <h3>🔥 Calories</h3>
          <div className="progress-bar">
            <div className="progress" style={{ width: `${Math.min(caloriePercent, 100)}%` }}>
              {Math.min(caloriePercent, 100).toFixed(0)}%
            </div>
          </div>
          <p>{todayData.calories.toFixed(0)} / {nutritionGoals?.calorie_goal || 2500}</p>
        </div>

        <div className="stat-card">
          <h3>💰 Cost</h3>
          <p>₹{todayData.cost.toFixed(2)}</p>
        </div>
      </div>

      <div className="ai-advice">
        <h3>🤖 AI Coach Says:</h3>
        <p>Keep tracking your meals to get personalized advice!</p>
      </div>
    </div>
  )
}

// Simple FoodLogger component
function FoodLogger() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const logFood = async (name, protein) => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/food/log?name=${encodeURIComponent(name)}&quantity=1`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setMessage(`✅ Logged ${name}! +${protein}g protein`)
        setTimeout(() => setMessage(''), 3000)
        window.location.reload() // Refresh to update dashboard
      }
    } catch (error) {
      setMessage('❌ Error logging food')
    }
    setLoading(false)
  }

  const commonFoods = [
    { name: 'Beef Chukka', protein: 40 },
    { name: 'Country Egg', protein: 6 },
    { name: 'Chickpeas', protein: 15 },
    { name: 'Chappathi', protein: 3 }
  ]

  return (
    <div className="food-logger">
      <h2>🍽️ Log Your Meal</h2>
      <div className="food-grid">
        {commonFoods.map(food => (
          <button key={food.name} onClick={() => logFood(food.name, food.protein)} disabled={loading} className="food-btn">
            {food.name}
            <small>{food.protein}g protein</small>
          </button>
        ))}
      </div>
      {message && <div className="message success">{message}</div>}
    </div>
  )
}

// Simple AddFood component
function AddFood() {
  const [name, setName] = useState('')
  const [cost, setCost] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const addFood = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/food/add?name=${encodeURIComponent(name)}&cost=${parseFloat(cost)}&unit=serving`, { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setMessage(`✅ Added ${name}!`)
        setName('')
        setCost('')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch (error) {
      setMessage('❌ Error adding food')
    }
    setLoading(false)
  }

  return (
    <div className="add-food">
      <h2>➕ Add Custom Food</h2>
      <form onSubmit={addFood}>
        <input type="text" placeholder="Food Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input type="number" placeholder="Cost (₹)" value={cost} onChange={(e) => setCost(e.target.value)} step="0.01" required />
        <button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Food'}</button>
      </form>
      {message && <div className="message success">{message}</div>}
    </div>
  )
}

// Simple HistoryChart component
function HistoryChart() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE_URL}/nutrition/analysis?date_range=week`)
      .then(res => res.json())
      .then(data => {
        if (data.daily_data) {
          const chartData = data.daily_data.dates.map((date, i) => ({
            date: new Date(date).toLocaleDateString(),
            protein: data.daily_data.protein[i] || 0
          }))
          setData(chartData)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading">Loading history...</div>

  return (
    <div className="history-chart">
      <h2>📈 Last 7 Days Protein</h2>
      {data.length === 0 ? (
        <p>No data yet. Start logging meals!</p>
      ) : (
        <div className="simple-chart">
          {data.map(day => (
            <div key={day.date} className="chart-bar-container">
              <span className="chart-label">{day.date.slice(0, 5)}</span>
              <div className="chart-bar" style={{ width: `${Math.min((day.protein / 100) * 100, 100)}%` }}>
                {day.protein}g
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Simple AIChat component
function AIChat({ profile }) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const askAI = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      const data = await res.json()
      setResponse(data.response || 'No response')
    } catch (error) {
      setResponse('Error connecting to AI')
    }
    setLoading(false)
  }

  return (
    <div className="ai-chat">
      <h2>🤖 AI Health Coach</h2>
      {profile && <p className="profile-context">👤 Coaching {profile.nickname} (BMI: {profile.bmi?.toFixed(1)})</p>}
      <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about nutrition..." rows={3} />
      <button onClick={askAI} disabled={loading}>{loading ? 'Thinking...' : 'Ask AI'}</button>
      {response && <div className="chat-response"><strong>AI:</strong> {response}</div>}
    </div>
  )
}

// Main App Component
function App() {
  const [profile, setProfile] = useState(null)
  const [nutritionGoals, setNutritionGoals] = useState(null)
  const [todayData, setTodayData] = useState({ protein: 0, cholesterol: 0, calories: 0, cost: 0 })
  const [profileInitialized, setProfileInitialized] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  
  const [formData, setFormData] = useState({
    nickname: '',
    age: '',
    gender: 'male',
    height: '',
    weight: '',
    primary_goal: 'maintain_weight',
    activity_level: 'moderate',
    secondary_goals: []
  })

  const goalsList = [
    { value: 'lose_weight', label: '🏃 Lose Weight' },
    { value: 'maintain_weight', label: '⚖️ Maintain Weight' },
    { value: 'gain_muscle', label: '💪 Gain Muscle' },
    { value: 'improve_endurance', label: '🏊 Improve Endurance' },
    { value: 'lower_cholesterol', label: '❤️ Lower Cholesterol' },
    { value: 'increase_iron', label: '🩸 Increase Iron' }
  ]

  const activityLevels = [
    { value: 'sedentary', label: '🛋️ Sedentary' },
    { value: 'light', label: '🚶 Light (1-3x/week)' },
    { value: 'moderate', label: '🏃 Moderate (3-5x/week)' },
    { value: 'active', label: '🏋️ Active (6-7x/week)' },
    { value: 'very_active', label: '⚡ Very Active' }
  ]

  useEffect(() => {
    checkProfile()
  }, [])

  const checkProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/profile`)
      if (res.ok) {
        const profileData = await res.json()
        setProfile(profileData)
        
        const goalsRes = await fetch(`${API_BASE_URL}/nutrition-goals`)
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json()
          setNutritionGoals(goalsData)
        }
        
        const todayRes = await fetch(`${API_BASE_URL}/today`)
        if (todayRes.ok) {
          const todayData = await todayRes.json()
          setTodayData(todayData.totals || todayData)
        }
        
        setProfileInitialized(true)
      }
    } catch (error) {
      console.log('Profile not found')
    }
  }

  const calculateBMI = (weight, heightCm) => {
    const heightM = heightCm / 100
    return weight / (heightM * heightM)
  }

  const initializeProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    const height = parseFloat(formData.height)
    const weight = parseFloat(formData.weight)
    const bmi = calculateBMI(weight, height)
    
    try {
      const params = new URLSearchParams({
        nickname: formData.nickname,
        height: height,
        weight: weight,
        age: parseInt(formData.age),
        gender: formData.gender,
        primary_goal: formData.primary_goal,
        activity_level: formData.activity_level,
        secondary_goals: formData.secondary_goals.join(',')
      })
      
      const response = await fetch(`${API_BASE_URL}/user/setup-goals?${params}`, { method: 'POST' })
      const data = await response.json()
      
      if (data.success) {
        setProfile(data.profile)
        setNutritionGoals(data.nutrition_goals)
        setProfileInitialized(true)
      } else {
        alert(data.message || 'Error creating profile')
      }
    } catch (error) {
      alert('Error connecting to server')
    }
    setLoading(false)
  }

  // BMI calculation display
  const getBMICategory = (bmi) => {
    if (bmi < 18.5) return 'Underweight'
    if (bmi < 25) return 'Normal weight'
    if (bmi < 30) return 'Overweight'
    return 'Obese'
  }

  if (!profileInitialized) {
    return (
      <div className="app">
        <header><h1>🏋️ AI Health Tracker</h1><p>Personalized Nutrition Coach</p></header>
        <div className="content">
          <div className="onboarding">
            <h2>Welcome! Let's set up your profile</h2>
            
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                <h3>Basic Information</h3>
                <input type="text" name="nickname" placeholder="Nickname" value={formData.nickname} onChange={(e) => setFormData({...formData, nickname: e.target.value})} required />
                <input type="number" name="age" placeholder="Age" value={formData.age} onChange={(e) => setFormData({...formData, age: e.target.value})} required />
                <select name="gender" value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <input type="number" name="height" placeholder="Height (cm)" value={formData.height} onChange={(e) => setFormData({...formData, height: e.target.value})} required />
                <input type="number" name="weight" placeholder="Weight (kg)" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} required />
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 2 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <h3>What's your primary health goal?</h3>
                <div className="goals-grid">
                  {goalsList.map(goal => (
                    <div key={goal.value} className={`goal-card ${formData.primary_goal === goal.value ? 'selected' : ''}`} onClick={() => setFormData({...formData, primary_goal: goal.value})}>
                      <h4>{goal.label}</h4>
                    </div>
                  ))}
                </div>
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 3 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(4); }}>
                <h3>What's your activity level?</h3>
                <div className="activity-grid">
                  {activityLevels.map(level => (
                    <div key={level.value} className={`activity-card ${formData.activity_level === level.value ? 'selected' : ''}`} onClick={() => setFormData({...formData, activity_level: level.value})}>
                      <h4>{level.label}</h4>
                    </div>
                  ))}
                </div>
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 4 && (
              <form onSubmit={initializeProfile}>
                <h3>Any secondary goals? (Optional)</h3>
                <div className="secondary-goals">
                  {goalsList.filter(g => g.value !== formData.primary_goal).map(goal => (
                    <label key={goal.value} className="checkbox-label">
                      <input type="checkbox" checked={formData.secondary_goals.includes(goal.value)} onChange={() => {
                        const newSecondary = formData.secondary_goals.includes(goal.value)
                          ? formData.secondary_goals.filter(g => g !== goal.value)
                          : [...formData.secondary_goals, goal.value]
                        setFormData({...formData, secondary_goals: newSecondary})
                      }} />
                      {goal.label}
                    </label>
                  ))}
                </div>
                <button type="submit" disabled={loading}>{loading ? 'Creating your plan...' : 'Start My Journey 🚀'}</button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  const bmiValue = profile?.bmi || calculateBMI(profile?.weight, profile?.height)
  const bmiCategory = getBMICategory(bmiValue)

  return (
    <div className="app">
      <header>
        <h1>🏋️ AI Health Tracker</h1>
        <p>👤 {profile?.nickname} • BMI: {bmiValue.toFixed(1)} ({bmiCategory}) • Goal: {nutritionGoals?.protein_goal || 100}g protein</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>🍽️ Log Food</button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕ Add Food</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>📈 History</button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>🤖 AI Coach</button>
      </div>

      <div className="content">
        {activeTab === 'dashboard' && <Dashboard profile={profile} nutritionGoals={nutritionGoals} todayData={todayData} />}
        {activeTab === 'log' && <FoodLogger />}
        {activeTab === 'add' && <AddFood />}
        {activeTab === 'history' && <HistoryChart />}
        {activeTab === 'ai' && <AIChat profile={profile} />}
      </div>
    </div>
  )
}

export default App
