import React, { useState, useEffect, useCallback } from 'react'
import { foodApi, logApi } from '../services/api'
import { useToast } from '../hooks/useToast'

export default function FoodLogger({ sessionId, onLogged, refreshKey }) {
  const [foods, setFoods]         = useState([])
  const [selected, setSelected]   = useState(null)
  const [qty, setQty]             = useState(1)
  const [search, setSearch]       = useState('')
  const [logging, setLogging]     = useState(false)
  const [deleting, setDeleting]   = useState(null)
  const [entries, setEntries]     = useState([])
  const { showToast, ToastEl }    = useToast()

  const loadFoods = useCallback(async () => {
    try {
      const res = await foodApi.list(sessionId)
      setFoods(res.foods || [])
    } catch (e) { console.error(e) }
  }, [sessionId])

  const loadEntries = useCallback(async () => {
    try {
      const res = await logApi.today(sessionId)
      setEntries(res.entries || [])
    } catch (e) { console.error(e) }
  }, [sessionId])

  useEffect(() => {
    loadFoods()
    loadEntries()
  }, [loadFoods, loadEntries, refreshKey])

  const filtered = foods.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  )

  const log = async () => {
    if (!selected) { showToast('Select a food first', 'error'); return }
    setLogging(true)
    try {
      await logApi.log(sessionId, { food_id: selected.id, quantity: qty })
      showToast(`Logged ${qty} × ${selected.name}`, 'success')
      setSelected(null)
      setQty(1)
      setSearch('')
      loadEntries()
      onLogged?.()
    } catch (e) {
      showToast(e.message || 'Logging failed', 'error')
    } finally {
      setLogging(false)
    }
  }

  const deleteEntry = async (entryId) => {
    setDeleting(entryId)
    try {
      await logApi.deleteEntry(sessionId, entryId)
      showToast('Entry removed', 'info')
      loadEntries()
      onLogged?.()
    } catch (e) {
      showToast('Remove failed', 'error')
    } finally {
      setDeleting(null)
    }
  }

  const deleteFood = async (foodId, e) => {
    e.stopPropagation()
    try {
      await foodApi.remove(sessionId, foodId)
      if (selected?.id === foodId) { setSelected(null); setSearch('') }
      loadFoods()
      showToast('Food deleted', 'info')
    } catch (e) {
      showToast('Delete failed', 'error')
    }
  }

  return (
    <div className="page">
      {ToastEl}

      <div className="section-head">
        <span className="section-title">Log Meal</span>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{foods.length} foods</span>
      </div>

      {foods.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🍽️</div>
          <h3>No foods yet</h3>
          <p>Go to Add Food to create your food database, then come back here to log meals.</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="card" style={{ marginBottom: 12 }}>
            <input
              className="input"
              placeholder="🔍 Search foods..."
              value={search}
              onChange={e => { setSearch(e.target.value); setSelected(null) }}
            />
          </div>

          {/* Food list */}
          <div className="card">
            <div className="card-title">Select Food</div>
            {filtered.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '12px 0' }}>
                No foods match "{search}"
              </div>
            )}
            {filtered.map(food => (
              <div
                key={food.id}
                className="food-item"
                onClick={() => { setSelected(food); setQty(1) }}
                style={{
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 8px',
                  background: selected?.id === food.id ? 'rgba(0,229,160,0.07)' : 'transparent',
                  border: selected?.id === food.id ? '1px solid rgba(0,229,160,0.3)' : '1px solid transparent',
                  transition: 'all 0.15s',
                  marginBottom: 2,
                }}
              >
                <div className="food-item-icon"
                  style={{ background: selected?.id === food.id ? 'rgba(0,229,160,0.15)' : 'rgba(0,229,160,0.06)' }}>
                  🥘
                </div>
                <div className="food-item-info">
                  <div className="food-item-name">{food.name}</div>
                  <div className="food-item-meta">
                    {food.protein_per_unit}g protein · {food.calories_per_unit} kcal · ₹{food.cost_per_unit}
                    <span style={{ color: 'var(--text-muted)' }}> / {food.default_unit}</span>
                  </div>
                </div>
                <div className="food-item-actions">
                  {selected?.id === food.id && (
                    <span style={{ fontSize: 18, color: 'var(--accent)' }}>✓</span>
                  )}
                  <button
                    className="btn btn-icon btn-secondary btn-sm"
                    style={{ width: 30, height: 30, borderRadius: 8, fontSize: 14, color: 'var(--danger)', border: 'none' }}
                    onClick={(e) => deleteFood(food.id, e)}
                  >✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* Quantity + log */}
          {selected && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">Quantity</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 10 }}>
                  <strong style={{ color: 'var(--accent)' }}>{selected.name}</strong>
                  &nbsp;· {selected.default_unit}
                </div>
                <div className="qty-row">
                  <button className="qty-btn" onClick={() => setQty(q => Math.max(0.5, q - 0.5))}>−</button>
                  <input
                    className="qty-input"
                    type="number"
                    min="0.1"
                    step="0.5"
                    value={qty}
                    onChange={e => setQty(parseFloat(e.target.value) || 1)}
                  />
                  <button className="qty-btn" onClick={() => setQty(q => q + 0.5)}>+</button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      = {(selected.protein_per_unit * qty).toFixed(1)}g protein
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {(selected.calories_per_unit * qty).toFixed(0)} kcal
                      &nbsp;· ₹{(selected.cost_per_unit * qty).toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={log} disabled={logging}>
                {logging ? '⟳ Logging...' : `Log ${qty} × ${selected.name}`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Today's log */}
      {entries.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">Today's Log</div>
          {entries.map((e) => (
            <div key={e.id} className="food-item">
              <div className="food-item-icon">🍽️</div>
              <div className="food-item-info">
                <div className="food-item-name">{e.name}</div>
                <div className="food-item-meta">
                  {e.protein?.toFixed(1)}g protein · {e.calories?.toFixed(0)} kcal · ₹{e.cost?.toFixed(0)}
                  <span style={{ color: 'var(--text-muted)' }}> · {e.quantity} {e.unit}</span>
                </div>
              </div>
              <button
                className="btn btn-icon"
                style={{ width: 30, height: 30, borderRadius: 8, fontSize: 14, color: 'var(--danger)', background: 'rgba(255,77,109,0.1)', border: 'none', cursor: 'pointer' }}
                onClick={() => deleteEntry(e.id)}
                disabled={deleting === e.id}
              >
                {deleting === e.id ? '⟳' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
