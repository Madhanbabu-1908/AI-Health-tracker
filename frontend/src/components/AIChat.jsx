import React, { useState, useEffect, useRef, useCallback } from 'react'
import { aiApi } from '../services/api'

const QUICK = [
  'Am I on track today?',
  'High protein meal ideas?',
  'How to lower cholesterol?',
  'Iron-rich foods for me?',
  'Best pre-workout snack?',
  'Analyse my week',
  'How much water left?',
  'Low-cost protein sources?',
]

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--text-muted)',
          animation: 'pulse 1.2s ease-in-out infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:.3} 40%{opacity:1} }`}</style>
    </div>
  )
}

export default function AIChat({ sessionId, profile, goals }) {
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: `வணக்கம் ${profile?.nickname || 'there'}! 👋 I'm your Nalamudan AI coach. Ask me anything about nutrition, your progress, or meal ideas.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: null,
    }
  ])
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()
  const textareaRef = useRef()

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
  }, [])

  useEffect(() => { scrollBottom() }, [messages, scrollBottom])

  const send = async (text) => {
    const q = (text || input).trim()
    if (!q || loading) return

    setInput('')
    setMessages(prev => [...prev, {
      role: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }])
    setLoading(true)

    try {
      const res = await aiApi.chat(sessionId, q)
      setMessages(prev => [...prev, {
        role: 'ai',
        text: res.response || 'Something went wrong. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: res.model || null,
        cached: res.cached || false,
        blocked: res.blocked || false,
      }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: '⚠️ Could not connect to AI. Check your internet connection and try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: null,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Context strip */}
      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap',
        padding: '10px 0 12px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 12,
      }}>
        {[
          { icon: '👤', val: profile?.nickname },
          { icon: '🎯', val: `${goals?.protein_goal || '--'}g protein` },
          { icon: '🔥', val: `${goals?.calorie_goal || '--'} kcal` },
          { icon: '⚖️',  val: `BMI ${profile?.bmi?.toFixed(1) || '--'}` },
        ].map((s, i) => s.val && (
          <div key={i} style={{
            padding: '4px 10px', borderRadius: 20,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
          }}>
            {s.icon} {s.val}
          </div>
        ))}
      </div>

      {/* Quick prompts */}
      <div className="quick-pill-row">
        {QUICK.map(q => (
          <button key={q} className="quick-pill" onClick={() => send(q)} disabled={loading}>
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-area" style={{ flex: 1 }}>
        {messages.map((m, i) => (
          <div key={i}>
            <div className={`bubble ${m.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
              {m.text}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'center',
              gap: 6,
              marginTop: 4,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{m.time}</span>
              {m.model && m.model !== 'cache' && m.model !== 'offline' && (
                <span className="model-tag">✦ {m.model}</span>
              )}
              {m.cached && (
                <span className="model-tag" style={{ color: 'var(--text-muted)', borderColor: 'transparent', background: 'transparent' }}>
                  cached
                </span>
              )}
              {m.blocked && (
                <span style={{ fontSize: 10, color: 'var(--danger)' }}>blocked</span>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="bubble bubble-ai">
            <TypingDots />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          ref={textareaRef}
          className="chat-input"
          placeholder="Ask about nutrition, meals, your progress..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={loading}
        />
        <button
          className="chat-send"
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          {loading ? (
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          ) : '↑'}
        </button>
      </div>

      <div style={{ height: 8 }} />
    </div>
  )
}
