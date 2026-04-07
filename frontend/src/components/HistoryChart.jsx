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
    { value: 'week', label: 'Last 7 Days', days: 7 },
    { value: 'weeks', label: 'Last 14 Days', days: 14 },
    { value: 'weeks3', label: 'Last 21 Days', days: 21 },
    { value: 'month', label: 'Last 30 Days', days: 30 }
  ]

  const nutritionOptions = [
    { value: 'protein', label: '🥩 Protein', color: '#8884d8', unit: 'g' },
    { value: 'carbs', label: '🍞 Carbs', color: '#ffaa44', unit: 'g' },
    { value: 'cholesterol', label: '🍳 Cholesterol', color: '#ff4444', unit: 'mg' },
    { value: 'iron', label: '🩸 Iron', color: '#82ca9d', unit: 'mg' },
    { value: 'calories', label: '🔥 Calories', color: '#4caf50', unit: 'cal' },
    { value: 'cost', label: '💰 Cost', color: '#ff6b6b', unit: '₹' }
  ]

  useEffect(() => {
    fetchHistory()
  }, [dateRange])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/history?days=${dateRangeOptions.find(o => o.value === dateRange)?.days || 7}`)
      const data = await response.json()
      
      setChartData(data)
      
      // Calculate analysis
      if (data.length > 0) {
        const metricData = data.map(d => d[nutritionMetric] || 0)
        const avg = metricData.reduce((a, b) => a + b, 0) / metricData.length
        const max = Math.max(...metricData)
        const min = Math.min(...metricData)
        const total = metricData.reduce((a, b) => a + b, 0)
        
        setAnalysis({ avg, max, min, total })
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedMetric = nutritionOptions.find(m => m.value === nutritionMetric)

  if (loading) return <div className="loading">Loading chart...</div>

  if (chartData.length === 0) {
    return (
      <div className="history-chart">
        <h2>📈 Nutrition Progress</h2>
        <div className="empty-chart">
          <p>No data yet. Start logging your meals!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-chart">
      <h2>📈 Nutrition Progress</h2>
      
      <div className="chart-controls">
        <div className="control-group">
          <label>📅 Date Range</label>
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            {dateRangeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        <div className="control-group">
          <label>🥗 Nutrition</label>
          <select value={nutritionMetric} onChange={(e) => setNutritionMetric(e.target.value)}>
            {nutritionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="date" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip 
              contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              formatter={(value) => [`${value} ${selectedMetric?.unit || ''}`, selectedMetric?.label]}
            />
            <Legend />
            <Bar 
              dataKey={nutritionMetric} 
              fill={selectedMetric?.color} 
              name={selectedMetric?.label}
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {analysis && (
        <div className="insights">
          <h3>📊 Summary Analysis</h3>
          <div className="insight-stats">
            <div className="insight-card">
              <div className="insight-value">{analysis.avg.toFixed(1)}</div>
              <div className="insight-label">Average {selectedMetric?.label}</div>
            </div>
            <div className="insight-card">
              <div className="insight-value">{analysis.max.toFixed(1)}</div>
              <div className="insight-label">Highest Day</div>
            </div>
            <div className="insight-card">
              <div className="insight-value">{analysis.min.toFixed(1)}</div>
              <div className="insight-label">Lowest Day</div>
            </div>
            <div className="insight-card">
              <div className="insight-value">{analysis.total.toFixed(1)}</div>
              <div className="insight-label">Total {selectedMetric?.label}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
