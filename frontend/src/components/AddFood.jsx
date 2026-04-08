import React, { useState, useRef } from 'react'
import { foodApi, aiApi } from '../services/api'
import { useToast } from '../hooks/useToast'

const EMPTY = {
  name: '', default_unit: 'serving',
  protein_per_unit: '', carbs_per_unit: '', fat_per_unit: '',
  cholesterol_per_unit: '', iron_per_unit: '', fiber_per_unit: '',
  calories_per_unit: '', cost_per_unit: '',
}

export default function AddFood({ sessionId, onFoodAdded }) {
  const [form, setForm]         = useState(EMPTY)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [aiSource, setAiSource] = useState(null)
  const { showToast, ToastEl }  = useToast()
  const nameRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── AI auto-fill ─────────────────────────────────────────────────────────

  const autofill = async () => {
    if (!form.name.trim()) {
      showToast('Enter food name first', 'error')
      nameRef.current?.focus()
      return
    }
    setAiLoading(true)
    setAiSource(null)
    try {
      const qty = form.default_unit?.toLowerCase().includes('g')
        ? 100 : 100
      const res = await aiApi.predict(form.name.trim(), qty)
      if (res.success && res.nutrition) {
        const n = res.nutrition
        setForm(f => ({
          ...f,
          protein_per_unit:     n.protein     > 0 ? n.protein     : f.protein_per_unit,
          carbs_per_unit:       n.carbs       > 0 ? n.carbs       : f.carbs_per_unit,
          fat_per_unit:         n.fat         > 0 ? n.fat         : f.fat_per_unit,
          cholesterol_per_unit: n.cholesterol > 0 ? n.cholesterol : f.cholesterol_per_unit,
          iron_per_unit:        n.iron        > 0 ? n.iron        : f.iron_per_unit,
          fiber_per_unit:       n.fiber       > 0 ? n.fiber       : f.fiber_per_unit,
          calories_per_unit:    n.calories    > 0 ? n.calories    : f.calories_per_unit,
        }))
        setAiSource(n.source || 'ai')
        showToast(`Filled from ${n.source === 'web_search' ? 'web' : 'AI'} — review & adjust if needed`, 'info', 3500)
      } else {
        showToast('Could not find data — fill manually', 'error')
      }
    } catch (e) {
      showToast('AI lookup failed — fill manually', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.name.trim()) { showToast('Food name is required', 'error'); return }
    if (!form.cost_per_unit) { showToast('Cost is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name:                 form.name.trim(),
        default_unit:         form.default_unit || 'serving',
        protein_per_unit:     parseFloat(form.protein_per_unit)     || 0,
        carbs_per_unit:       parseFloat(form.carbs_per_unit)       || 0,
        fat_per_unit:         parseFloat(form.fat_per_unit)         || 0,
        cholesterol_per_unit: parseFloat(form.cholesterol_per_unit) || 0,
        iron_per_unit:        parseFloat(form.iron_per_unit)        || 0,
        fiber_per_unit:       parseFloat(form.fiber_per_unit)       || 0,
        calories_per_unit:    parseFloat(form.calories_per_unit)    || 0,
        cost_per_unit:        parseFloat(form.cost_per_unit)        || 0,
      }
      await foodApi.add(sessionId, payload)
      showToast(`"${payload.name}" saved!`, 'success')
      setForm(EMPTY)
      setAiSource(null)
      onFoodAdded?.()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      {ToastEl}

      <div className="section-head">
        <span className="section-title">Add Food</span>
      </div>

      {/* Name + AI */}
      <div className="card">
        <div className="card-title">Food Details</div>

        <div className="field">
          <label className="label">Food Name *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={nameRef}
              className="input"
              placeholder="e.g. Chicken Biryani, Paneer, Egg"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && autofill()}
            />
            <button className="ai-btn" onClick={autofill} disabled={aiLoading} style={{ flexShrink: 0 }}>
              {aiLoading
                ? <><span className="spin">⟳</span> Searching</>
                : <><span>✦</span> AI Fill</>}
            </button>
          </div>
          {aiSource && (
            <div className="ai-badge" style={{ marginTop: 8 }}>
              <span>✦</span>
              {aiSource.includes('web') ? 'Filled from web search' : 'Filled by AI'}
              &nbsp;· edit values if needed
            </div>
          )}
        </div>

        <div className="field">
          <label className="label">Serving Unit</label>
          <input className="input" placeholder="e.g. serving, 100g, cup, bowl"
            value={form.default_unit} onChange={e => set('default_unit', e.target.value)} />
        </div>
      </div>

      {/* Macros */}
      <div className="card">
        <div className="card-title">Nutrition per Serving</div>

        <div className="field-row">
          <div className="field">
            <label className="label">🔥 Calories</label>
            <input className="input" type="number" step="1" placeholder="0"
              value={form.calories_per_unit} onChange={e => set('calories_per_unit', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">🥩 Protein (g)</label>
            <input className="input" type="number" step="0.1" placeholder="0"
              value={form.protein_per_unit} onChange={e => set('protein_per_unit', e.target.value)} />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="label">🍞 Carbs (g)</label>
            <input className="input" type="number" step="0.1" placeholder="0"
              value={form.carbs_per_unit} onChange={e => set('carbs_per_unit', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">🫐 Fat (g)</label>
            <input className="input" type="number" step="0.1" placeholder="0"
              value={form.fat_per_unit} onChange={e => set('fat_per_unit', e.target.value)} />
          </div>
        </div>

        <div className="field-row-3">
          <div className="field">
            <label className="label">🌿 Fiber (g)</label>
            <input className="input" type="number" step="0.1" placeholder="0"
              value={form.fiber_per_unit} onChange={e => set('fiber_per_unit', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">🍳 Chol. (mg)</label>
            <input className="input" type="number" step="1" placeholder="0"
              value={form.cholesterol_per_unit} onChange={e => set('cholesterol_per_unit', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">🩸 Iron (mg)</label>
            <input className="input" type="number" step="0.1" placeholder="0"
              value={form.iron_per_unit} onChange={e => set('iron_per_unit', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Cost */}
      <div className="card">
        <div className="card-title">Cost</div>
        <div className="field">
          <label className="label">Price per Serving *</label>
          <input className="input" type="number" step="0.5" placeholder="0"
            value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)} />
        </div>
      </div>

      <button className="btn btn-primary" onClick={save} disabled={saving} style={{ marginTop: 4 }}>
        {saving ? '⟳ Saving...' : '+ Save Food'}
      </button>

      <div style={{ height: 16 }} />
    </div>
  )
}
