import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { API_BASE_URL } from '../services/api'

export default function HistoryChart() {
  const [dateRange, setDateRange] = useState('week')
  const [nutritionMetric, setNutritionMetric] = useState('protein')
  const [chartData, setChartData] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(true)

  const dateRangeOptions = [
    { value: 'week', label: 'Last 7 Days' },
    { value: 'weeks', label: 'Last 14 Days' },
    { value: 'weeks3', label: 'Last 21 Days' },
    { value: 'month', label: 'Last 30 Days' }
  ]

  const nutritionOptions = [
    { value: 'protein', label: '🥩 Protein', color: '#8884d8' },
    { value: 'carbs', label: '🍞 Carbs', color: '#ffaa44' },
    { value: 'cholesterol', label: '🍳 Cholesterol', color: '#ff4444' },
    { value: 'iron', label: '🩸 Iron', color: '#82ca9d' },
    { value: 'calories', label: '🔥 Calories', color: '#4caf50' },
    { value: 'cost', label: '💰 Cost', color: '#ff6b6b' }
  ]

  useEffect(() => {
    fetchAnalysis()
  }, [dateRange])

  const fetchAnalysis = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/nutrition/analysis?date_range=${dateRange}`)
      const data = await response.json()
      setAnalysis(data)
      
      const chartData = data.daily_data.dates.map((date, index) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        protein: data.daily_data.protein[index],
        carbs: data.daily_data.carbs[index],
        cholesterol: data.daily_data.cholesterol[index],
        iron: data.daily_data.iron[index],
        calories: data.daily_data.calories[index] || 0,
        cost: data.daily_data.cost?.[index] || 0
      }))
      setChartData(chartData)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading chart...</div>

  const selectedMetric = nutritionOptions.find(m => m.value === nutritionMetric)
  const metricData = analysis?.[nutritionMetric]

  return (
    <div className="history-chart">
      <h2>📈 Nutrition Progress</h2>
      
      <div className="chart-controls">
        <div className="control-group">
          <label>Date Range:</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            {dateRangeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        
        <div className="control-group">
          <label>Nutrition:</label>
          <select value={nutritionMetric} onChange={(e) => setNutritionMetric(e.target.value)}>
            {nutritionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={nutritionMetric} stroke={selectedMetric?.color} name={selectedMetric?.label} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>

      {metricData && (
        <div className="insights">
          <h3>📊 Analysis</h3>
          <div className="insight-stats">
            <div className="insight">
              <strong>Average {selectedMetric?.label}:</strong> {metricData.average.toFixed(1)}
            </div>
            {metricData.goal && (
              <div className="insight">
                <strong>Goal:</strong> {metricData.goal}
              </div>
            )}
            {metricData.goal_hit_percentage && (
              <div className="insight">
                <strong>Goal Met:</strong> {metricData.goal_hit_percentage.toFixed(0)}% of days
              </div>
            )}
            {metricData.within_limit_percentage && (
              <div className="insight">
                <strong>Within Limit:</strong> {metricData.within_limit_percentage.toFixed(0)}% of days
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
