import React, { useState, useEffect } from 'react'
import Dashboard from './components/Dashboard'
import FoodLogger from './components/FoodLogger'
import AddFood from './components/AddFood'
import HistoryChart from './components/HistoryChart'
import AIChat from './components/AIChat'
import { API_BASE_URL } from './services/api'

function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [profile, setProfile] = useState(null)
  const [nutritionGoals, setNutritionGoals] = useState(null)
  const [profileInitialized, setProfileInitialized] = useState(false)
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  
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
    { value: 'lose_weight', label: '🏃 Lose Weight', description: 'Gradually reduce body weight' },
    { value: 'maintain_weight', label: '⚖️ Maintain Weight', description: 'Keep current healthy weight' },
    { value: 'gain_muscle', label: '💪 Gain Muscle', description: 'Build lean muscle mass' },
    { value: 'improve_endurance', label: '🏊 Improve Endurance', description: 'Boost stamina and energy' },
    { value: 'lower_cholesterol', label: '❤️ Lower Cholesterol', description: 'Improve heart health' },
    { value: 'increase_iron', label: '🩸 Increase Iron', description: 'Boost iron levels' }
  ]

  const activityLevels = [
    { value: 'sedentary', label: '🛋️ Sedentary', description: 'Little or no exercise, desk job' },
    { value: 'light', label: '🚶 Light', description: 'Exercise 1-3 times per week' },
    { value: 'moderate', label: '🏃 Moderate', description: 'Exercise 3-5 times per week' },
    { value: 'active', label: '🏋️ Active', description: 'Exercise 6-7 times per week' },
    { value: 'very_active', label: '⚡ Very Active', description: 'Physical job + daily exercise' }
  ]

  useEffect(() => {
    checkProfile()
  }, [])

  const checkProfile = async () => {
    setLoading(true)
    setError('')
    
    try {
      console.log('Checking profile at:', `${API_BASE_URL}/profile`)
      
      const response = await fetch(`${API_BASE_URL}/profile`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Profile found:', data)
        setProfile(data)
        setShowReset(true)
        
        try {
          const goalsResponse = await fetch(`${API_BASE_URL}/nutrition-goals`)
          if (goalsResponse.ok) {
            const goalsData = await goalsResponse.json()
            setNutritionGoals(goalsData)
          }
        } catch (err) {
          console.error('Error fetching goals:', err)
        }
        
        setProfileInitialized(true)
      } else if (response.status === 404) {
        console.log('No profile found - showing onboarding')
        setProfileInitialized(false)
        setShowReset(false)
      } else {
        setError(`Server error: ${response.status}`)
      }
    } catch (error) {
      console.error('Connection error:', error)
      setError(`Cannot connect to backend. Make sure backend is running at ${API_BASE_URL}`)
    } finally {
      setLoading(false)
    }
  }

  const resetProfile = async () => {
    if (confirm('Are you sure you want to reset your profile? All your food data will be lost.')) {
      try {
        const response = await fetch(`${API_BASE_URL}/clear-profile`, { method: 'DELETE' })
        if (response.ok) {
          setProfile(null)
          setNutritionGoals(null)
          setProfileInitialized(false)
          setShowReset(false)
          window.location.reload()
        } else {
          alert('Failed to reset profile. Please try again.')
        }
      } catch (error) {
        console.error('Error resetting profile:', error)
        alert('Error resetting profile. Please check backend connection.')
      }
    }
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const toggleSecondaryGoal = (goalValue) => {
    setFormData(prev => {
      const newSecondary = prev.secondary_goals.includes(goalValue)
        ? prev.secondary_goals.filter(g => g !== goalValue)
        : [...prev.secondary_goals, goalValue]
      return { ...prev, secondary_goals: newSecondary }
    })
  }

  const initializeProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      if (!formData.nickname || !formData.height || !formData.weight || !formData.age) {
        setError('Please fill all required fields')
        setLoading(false)
        return
      }
      
      const heightCm = parseFloat(formData.height)
      const weightKg = parseFloat(formData.weight)
      
      if (heightCm < 50 || heightCm > 250) {
        setError('Height must be between 50cm and 250cm')
        setLoading(false)
        return
      }
      
      if (weightKg < 20 || weightKg > 300) {
        setError('Weight must be between 20kg and 300kg')
        setLoading(false)
        return
      }
      
      const params = new URLSearchParams({
        nickname: formData.nickname,
        height: heightCm,
        weight: weightKg,
        age: parseInt(formData.age),
        gender: formData.gender,
        primary_goal: formData.primary_goal,
        activity_level: formData.activity_level,
        secondary_goals: formData.secondary_goals.join(',')
      })
      
      console.log('Creating profile at:', `${API_BASE_URL}/user/setup-goals?${params}`)
      
      const response = await fetch(`${API_BASE_URL}/user/setup-goals?${params}`, {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setProfile(data.profile)
        setNutritionGoals(data.nutrition_goals)
        setProfileInitialized(true)
        setShowReset(false)
      } else {
        setError(data.message || 'Failed to create profile')
      }
    } catch (error) {
      console.error('Error setting up profile:', error)
      setError(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  // Show loading state
  if (loading) {
    return (
      <div className="app">
        <header>
          <h1>🏋️ Madhan Health Tracker</h1>
          <p>Personalized Nutrition Coach</p>
        </header>
        <div className="content">
          <div className="loading">
            <div>Loading...</div>
            <div style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>
              Backend: {API_BASE_URL}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error with retry button
  if (error && !profileInitialized) {
    return (
      <div className="app">
        <header>
          <h1>🏋️ Madhan Health Tracker</h1>
          <p>Personalized Nutrition Coach</p>
        </header>
        <div className="content">
          <div className="error-message" style={{ background: '#fee', color: '#c00', padding: '20px', borderRadius: '16px', textAlign: 'center' }}>
            <h3>Connection Error</h3>
            <p>{error}</p>
            <p style={{ fontSize: '12px', marginTop: '10px' }}>Backend URL: {API_BASE_URL}</p>
            <button 
              onClick={() => window.location.reload()} 
              style={{ marginTop: '16px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Onboarding screens
  if (!profileInitialized) {
    return (
      <div className="app">
        <header>
          <h1>🏋️ Madhan Health Tracker</h1>
          <p>Personalized Nutrition Coach</p>
        </header>
        <div className="content">
          <div className="onboarding">
            <h2>Welcome! Let's set up your profile</h2>
            
            {error && <div className="error-message">{error}</div>}
            
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                <h3>Basic Information</h3>
                <input 
                  type="text" 
                  name="nickname" 
                  placeholder="Nickname" 
                  value={formData.nickname} 
                  onChange={handleInputChange} 
                  required 
                />
                <input 
                  type="number" 
                  name="age" 
                  placeholder="Age" 
                  value={formData.age} 
                  onChange={handleInputChange} 
                  required 
                />
                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <input 
                  type="number" 
                  name="height" 
                  placeholder="Height (cm)" 
                  value={formData.height} 
                  onChange={handleInputChange} 
                  required 
                />
                <input 
                  type="number" 
                  name="weight" 
                  placeholder="Weight (kg)" 
                  value={formData.weight} 
                  onChange={handleInputChange} 
                  required 
                />
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 2 && (
              <form onSubmit={(e) => { e.preventDefault(); setStep(3); }}>
                <h3>What's your primary health goal?</h3>
                <div className="goals-grid">
                  {goalsList.map(goal => (
                    <div 
                      key={goal.value} 
                      className={`goal-card ${formData.primary_goal === goal.value ? 'selected' : ''}`} 
                      onClick={() => setFormData({ ...formData, primary_goal: goal.value })}
                    >
                      <h4>{goal.label}</h4>
                      <p>{goal.description}</p>
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
                    <div 
                      key={level.value} 
                      className={`activity-card ${formData.activity_level === level.value ? 'selected' : ''}`} 
                      onClick={() => setFormData({ ...formData, activity_level: level.value })}
                    >
                      <h4>{level.label}</h4>
                      <p>{level.description}</p>
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
                      <input 
                        type="checkbox" 
                        checked={formData.secondary_goals.includes(goal.value)} 
                        onChange={() => toggleSecondaryGoal(goal.value)} 
                      />
                      {goal.label}
                    </label>
                  ))}
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? 'Creating your plan...' : 'Start My Journey 🚀'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Safe defaults if nutritionGoals not loaded
  const safeNutritionGoals = nutritionGoals || {
    protein_goal: 100,
    calorie_goal: 2500,
    cholesterol_limit: 300,
    carb_limit: 300,
    iron_goal: 15,
    fat_goal: 70,
    fiber_goal: 25,
    water_goal: 2.5
  }

  const getBMIColor = (bmi) => {
    if (bmi < 18.5) return '#ffaa44'
    if (bmi < 25) return '#4caf50'
    if (bmi < 30) return '#ff9800'
    return '#ff4444'
  }

  return (
    <div className="app">
      <header>
        <h1>🏋️ Madhan Health Tracker</h1>
        <div className="header-stats">
          <span>👤 {profile?.nickname || 'User'}</span>
          <span className="bmi-badge" style={{ background: getBMIColor(profile?.bmi || 24) }}>
            BMI: {profile?.bmi?.toFixed(1) || '--'}
          </span>
          <span>🎯 {safeNutritionGoals.protein_goal}g protein</span>
        </div>
      </header>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>🍽️ Log Food</button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕ Add Food</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>📈 History</button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>🤖 AI Coach</button>
      </div>

      {showReset && (
        <div style={{ padding: '10px 20px', textAlign: 'center' }}>
          <button 
            onClick={resetProfile}
            style={{ padding: '8px 16px', background: '#ff4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Reset Profile (Clear Test Data)
          </button>
        </div>
      )}

      <div className="content">
        {activeTab === 'dashboard' && <Dashboard profile={profile} nutritionGoals={safeNutritionGoals} />}
        {activeTab === 'log' && <FoodLogger />}
        {activeTab === 'add' && <AddFood />}
        {activeTab === 'history' && <HistoryChart />}
        {activeTab === 'ai' && <AIChat profile={profile} nutritionGoals={safeNutritionGoals} />}
      </div>
    </div>
  )
}

export default App
