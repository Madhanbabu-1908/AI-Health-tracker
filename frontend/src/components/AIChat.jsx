import React, { useState } from 'react'
import { API_BASE_URL } from '../services/api'

export default function AIChat({ profile, nutritionGoals }) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState([])

  const askAI = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    setConversation(prev => [...prev, { role: 'user', content: query, time: new Date().toLocaleTimeString() }])
    
    try {
      const res = await fetch(`${API_BASE_URL}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: query,
          context: {
            profile: profile,
            goals: nutritionGoals
          }
        })
      })
      const data = await res.json()
      
      const aiResponse = data.response || "I'm here to help with your nutrition goals! What would you like to know?"
      setResponse(aiResponse)
      setConversation(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponse,
        time: new Date().toLocaleTimeString()
      }])
      
    } catch (error) {
      const errorMsg = '❌ Error connecting to AI. Please try again.'
      setResponse(errorMsg)
      setConversation(prev => [...prev, { role: 'assistant', content: errorMsg, time: new Date().toLocaleTimeString() }])
    } finally {
      setLoading(false)
      setQuery('')
    }
  }

  const quickQuestions = [
    "How much protein do I need today?",
    "What should I eat for better iron?",
    "How to lower cholesterol naturally?",
    "Suggest a high protein vegetarian meal",
    "Am I on track with my goals?"
  ]

  return (
    <div className="ai-chat">
      <h2>🤖 AI Health Coach</h2>
      
      {profile && (
        <div className="profile-context">
          <span>👤 Coaching {profile.nickname}</span>
          <span>📊 BMI: {profile.bmi}</span>
          <span>🎯 Goal: {nutritionGoals?.protein_goal || 72}g protein/day</span>
        </div>
      )}
      
      <div className="chat-messages">
        {conversation.length === 0 ? (
          <div className="welcome-message">
            <p>👋 Hello! I'm your AI health coach.</p>
            <p>Ask me about nutrition, meal planning, or your fitness goals!</p>
          </div>
        ) : (
          conversation.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
              <div className="message-time">{msg.time}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="message assistant">
            <div className="message-content">🤔 Thinking...</div>
          </div>
        )}
      </div>

      <div className="quick-questions">
        <h4>Quick Questions:</h4>
        <div className="quick-buttons">
          {quickQuestions.map((q, idx) => (
            <button key={idx} onClick={() => setQuery(q)} className="quick-btn">
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="chat-input-area">
        <input 
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask about nutrition, meals, or your progress..."
          onKeyPress={(e) => e.key === 'Enter' && askAI()}
        />
        <button onClick={askAI} disabled={loading}>
          {loading ? '🤔' : '💬 Ask'}
        </button>
      </div>

      {response && !loading && (
        <div className="chat-response">
          <p>{response}</p>
        </div>
      )}
    </div>
  )
}
