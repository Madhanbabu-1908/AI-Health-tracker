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
  const [loading, setLoading] = useState(false)
  
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
    try {
      const response = await fetch(`${API_BASE_URL}/profile`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data)
        
        const goalsResponse = await fetch(`${API_BASE_URL}/nutrition-goals`)
        const goalsData = await goalsResponse.json()
        setNutritionGoals(goalsData)
        
        setProfileInitialized(true)
      }
    } catch (error) {
      console.error('Profile not found')
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
    try {
      const params = new URLSearchParams({
        nickname: formData.nickname,
        height: parseFloat(formData.height),
        weight: parseFloat(formData.weight),
        age: parseInt(formData.age),
        gender: formData.gender,
        primary_goal: formData.primary_goal,
        activity_level: formData.activity_level,
        secondary_goals: formData.secondary_goals.join(',')
      })
      
      const response = await fetch(`${API_BASE_URL}/user/setup-goals?${params}`, {
        method: 'POST'
      })
      const data = await response.json()
      if (data.success) {
        setProfile(data.profile)
        setNutritionGoals(data.nutrition_goals)
        setProfileInitialized(true)
        alert(data.message)
      }
    } catch (error) {
      alert('Error setting up profile. Please try again.')
    }
    setLoading(false)
  }

  if (!profileInitialized) {
    return (
      <div className="app">
        <header>
          <h1>🏋️ AI Health Tracker</h1>
          <p>Personalized Nutrition Coach</p>
        </header>
        <div className="content">
          <div className="onboarding">
            <h2>Welcome! Let's set up your profile</h2>
            
            {step === 1 && (
              <form onSubmit={() => setStep(2)}>
                <h3>Basic Information</h3>
                <input type="text" name="nickname" placeholder="Nickname" value={formData.nickname} onChange={handleInputChange} required />
                <input type="number" name="age" placeholder="Age" value={formData.age} onChange={handleInputChange} required />
                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <input type="number" name="height" placeholder="Height (cm)" value={formData.height} onChange={handleInputChange} required />
                <input type="number" name="weight" placeholder="Weight (kg)" value={formData.weight} onChange={handleInputChange} required />
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 2 && (
              <form onSubmit={() => setStep(3)}>
                <h3>What's your primary health goal?</h3>
                <div className="goals-grid">
                  {goalsList.map(goal => (
                    <div key={goal.value} className={`goal-card ${formData.primary_goal === goal.value ? 'selected' : ''}`} onClick={() => setFormData({ ...formData, primary_goal: goal.value })}>
                      <h4>{goal.label}</h4>
                      <p>{goal.description}</p>
                    </div>
                  ))}
                </div>
                <button type="submit">Next →</button>
              </form>
            )}
            
            {step === 3 && (
              <form onSubmit={() => setStep(4)}>
                <h3>What's your activity level?</h3>
                <div className="activity-grid">
                  {activityLevels.map(level => (
                    <div key={level.value} className={`activity-card ${formData.activity_level === level.value ? 'selected' : ''}`} onClick={() => setFormData({ ...formData, activity_level: level.value })}>
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
                      <input type="checkbox" checked={formData.secondary_goals.includes(goal.value)} onChange={() => toggleSecondaryGoal(goal.value)} />
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

  return (
    <div className="app">
      <header>
        <h1>🏋️ AI Health Tracker</h1>
        <p>👤 {profile.nickname} • BMI: {profile.bmi?.toFixed(1)} • Goal: {nutritionGoals?.protein_goal}g protein</p>
      </header>

      <div className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={activeTab === 'log' ? 'active' : ''} onClick={() => setActiveTab('log')}>🍽️ Log Food</button>
        <button className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕ Add Food</button>
        <button className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>📈 History</button>
        <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>🤖 AI Coach</button>
      </div>

      <div className="content">
        {activeTab === 'dashboard' && <Dashboard profile={profile} nutritionGoals={nutritionGoals} />}
        {activeTab === 'log' && <FoodLogger />}
        {activeTab === 'add' && <AddFood />}
        {activeTab === 'history' && <HistoryChart />}
        {activeTab === 'ai' && <AIChat profile={profile} nutritionGoals={nutritionGoals} />}
      </div>
    </div>
  )
}

export default App
