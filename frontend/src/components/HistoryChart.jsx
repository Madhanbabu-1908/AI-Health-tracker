import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { API_BASE_URL } from '../services/api'

export default function HistoryChart({ refreshTrigger }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState('line')

  useEffect(() => {
    fetchHistory()
  }, [refreshTrigger])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/history/7`)
      const history = await response.json()
      
      const chartData = Object.entries(history)
        .map(([date, dayData]) => ({
          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          protein: dayData.protein || 0,
          cholesterol: dayData.cholesterol || 0,
          calories: dayData.calories || 0
        }))
        .reverse()
      
      setData(chartData)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading history...</div>

  if (data.length === 0) {
    return (
      <div className="history-chart">
        <h2>📈 Last 7 Days Progress</h2>
        <div className="empty-chart">
          <p>No data yet. Start logging your meals!</p>
          <p>Go to "Log Food" tab to add your first entry.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="history-chart">
      <h2>📈 Last 7 Days Progress</h2>
      
      <div className="chart-controls">
        <button className={chartType === 'line' ? 'active' : ''} onClick={() => setChartType('line')}>
          📊 Line Chart
        </button>
        <button className={chartType === 'bar' ? 'active' : ''} onClick={() => setChartType('bar')}>
          📊 Bar Chart
        </button>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" label={{ value: 'Protein (g)', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Cholesterol (mg)', angle: 90, position: 'insideRight' }} />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="protein" stroke="#8884d8" name="Protein (g)" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="cholesterol" stroke="#ff4444" name="Cholesterol (mg)" strokeWidth={2} />
            <Line yAxisId="left" type="monotone" dataKey="calories" stroke="#82ca9d" name="Calories" strokeWidth={2} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="protein" fill="#8884d8" name="Protein (g)" />
            <Bar dataKey="calories" fill="#82ca9d" name="Calories" />
          </BarChart>
        )}
      </ResponsiveContainer>

      <div className="insights">
        <h3>📊 Summary</h3>
        <div className="insight-stats">
          <div className="insight">
            <strong>Avg Protein:</strong> {(data.reduce((sum, d) => sum + d.protein, 0) / data.length).toFixed(1)}g/day
          </div>
          <div className="insight">
            <strong>Best Day:</strong> {data.reduce((best, d) => d.protein > best.protein ? d : best, data[0]).date}
          </div>
          <div className="insight">
            <strong>Goal Met:</strong> {data.filter(d => d.protein >= 100).length}/7 days
          </div>
        </div>
      </div>
    </div>
  )
}
