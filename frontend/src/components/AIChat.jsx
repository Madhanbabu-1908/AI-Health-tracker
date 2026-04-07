import React, { useState } from 'react'
import { API_BASE_URL } from '../services/api'

export default function AIChat() {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState([])

  const askAI = async () => {
    if (!query.trim()) return
    
    setLoading(true)
    setConversation(prev => [...prev, { role: 'user', content: query }])
    
    try {
      const res = await fetch(`${API_BASE_URL}/ai_query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
      })
      const data = await res.json()
      
      const aiResponse = data.ai_response || 'No response from AI'
      setResponse(aiResponse)
      setConversation(prev => [...prev, { role: 'assistant', content: aiResponse }])
      
      if (data.web_search && data.web_search.length > 0) {
        const webInfo = `\n\n🔍 Web Results:\n${data.web_search.map(r => `• ${r.title}`).join('\n')}`
        setResponse(prev => prev + webInfo)
      }
    } catch (error) {
      const errorMsg = '❌ Error connecting to AI. Please check backend.'
      setResponse(errorMsg)
      setConversation(prev => [...prev, { role: 'assistant', content: errorMsg }])
    } finally {
      setLoading(false)
      setQuery('')
    }
  }

  const quickQuestions = [
    "What should I eat for 30g protein?",
    "Is beef chukka good for recovery?",
    "How to lower cholesterol naturally?",
    "Best post-workout meal?",
    "Suggest a high protein breakfast"
  ]

  return (
    <div className="ai-chat">
      <h2>🤖 AI Health Coach</h2>
      
      <div className="chat-history">
        {conversation.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}`}>
            <strong>{msg.role === 'user' ? '👤 You:' : '🤖 AI:'}</strong>
            <p>{msg.content}</p>
          </div>
        ))}
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
        <textarea 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about nutrition, workouts, or meal planning..."
          rows={3}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && askAI()}
        />
        <button onClick={askAI} disabled={loading}>
          {loading ? '🤔 Thinking...' : '💬 Ask AI Coach'}
        </button>
      </div>

      {response && !loading && (
        <div className="chat-response">
          <h3>💡 AI Response:</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  )
}
