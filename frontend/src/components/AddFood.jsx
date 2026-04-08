import React, { useState, useRef, useEffect, useCallback } from 'react'
import { foodApi, aiApi } from '../services/api'
import { useToast } from '../hooks/useToast'

const EMPTY = {
  name: '', default_unit: 'serving',
  protein_per_unit: '', carbs_per_unit: '', fat_per_unit: '',
  cholesterol_per_unit: '', iron_per_unit: '', fiber_per_unit: '',
  calories_per_unit: '', cost_per_unit: '',
}

// Confidence colour
const CONF_STYLE = {
  high:   { color: '#00e5a0', label: '✓ High confidence' },
  medium: { color: '#ffb347', label: '~ Medium confidence — review values' },
  low:    { color: '#ff4d6d', label: '⚠ Low confidence — edit carefully' },
}

// Determine how to call the API based on unit type
const GRAM_UNITS = new Set(['g', 'gram', 'grams', 'kg', 'kilo', 'kilogram',
                             'oz', 'ounce', 'ounces', 'lb', 'lbs'])

export default function AddFood({ sessionId, onFoodAdded }) {
  const [form, setForm]           = useState(EMPTY)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [aiMeta, setAiMeta]       = useState(null)   // { source, confidence, per_grams }
  const [autoFill, setAutoFill]   = useState(true)   // auto-retrigger on unit change
  const { showToast, ToastEl }    = useToast()
  const nameRef   = useRef()
  const debouncer = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Core autofill logic ───────────────────────────────────────────────────

  const runAutofill = useCallback(async (foodName, unit) => {
    if (!foodName.trim()) return
    setAiLoading(true)
    setAiMeta(null)
    try {
      const isGramUnit = GRAM_UNITS.has(unit.toLowerCase().trim())
      let res
      if (isGramUnit) {
        // For gram-based units just look up per-100g
        res = await aiApi.predict(foodName.trim(), 100, 'g')
      } else {
        // For serving/cup/bowl etc — resolve weight first
        res = await aiApi.predictServing(foodName.trim(), 1, unit)
      }

      if (res.success && res.nutrition) {
        const n = res.nutrition
        setForm(f => ({
          ...f,
          calories_per_unit:    n.calories    > 0 ? String(+n.calories.toFixed(1))    : f.calories_per_unit,
          protein_per_unit:     n.protein     > 0 ? String(+n.protein.toFixed(1))     : f.protein_per_unit,
          carbs_per_unit:       n.carbs       > 0 ? String(+n.carbs.toFixed(1))       : f.carbs_per_unit,
          fat_per_unit:         n.fat         > 0 ? String(+n.fat.toFixed(1))         : f.fat_per_unit,
          fiber_per_unit:       n.fiber       > 0 ? String(+n.fiber.toFixed(1))       : f.fiber_per_unit,
          cholesterol_per_unit: n.cholesterol > 0 ? String(+n.cholesterol.toFixed(1)) : f.cholesterol_per_unit,
          iron_per_unit:        n.iron        > 0 ? String(+n.iron.toFixed(2))        : f.iron_per_unit,
        }))
        setAiMeta({
          source:    n.source || 'ai',
          confidence: n.confidence || 'medium',
          per_grams: n.serving_grams || n.per_grams || 100,
        })
        const src = n.source?.includes('openfoodfacts') ? 'Open Food Facts'
                  : n.source?.includes('web_page')      ? 'nutrition database'
                  : n.source?.includes('web_search_high') ? 'web (high accuracy)'
                  : n.source?.includes('web+ai')         ? 'web + AI'
                  : 'AI estimate'
        showToast(`Data from ${src} · check & adjust if needed`, 'info', 3500)
      } else {
        showToast('No data found — fill manually', 'error')
      }
    } catch (e) {
      showToast('Lookup failed — fill manually', 'error')
    } finally {
      setAiLoading(false)
    }
  }, [showToast])

  // ── Debounced unit change auto-retrigger ─────────────────────────────────

  useEffect(() => {
    if (!autoFill) return
    if (!form.name.trim()) return
    // Don't retrigger if unit is empty
    if (!form.default_unit.trim()) return

    if (debouncer.current) clearTimeout(debouncer.current)
    debouncer.current = setTimeout(() => {
      runAutofill(form.name, form.default_unit)
    }, 900)   // 900ms debounce after user stops typing unit

    return () => clearTimeout(debouncer.current)
  // Only retrigger when unit changes (not every form field change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.default_unit])

  // ── Manual AI Fill button ────────────────────────────────────────────────

  const autofill = () => {
    if (!form.name.trim()) {
      showToast('Enter food name first', 'error')
      nameRef.current?.focus()
      return
    }
    runAutofill(form.name, form.default_unit || 'serving')
  }

  // ── Name blur — auto-fill if no data yet ────────────────────────────────

  const onNameBlur = () => {
    if (!form.name.trim()) return
    const hasData = form.calories_per_unit || form.protein_per_unit
    if (!hasData && autoFill) {
      runAutofill(form.name, form.default_unit || 'serving')
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!form.name.trim()) { showToast('Food name is required', 'error'); return }
    if (!form.cost_per_unit) { showToast('Cost is required', 'error'); return }
    setSaving(true)
    try {
      await foodApi.add(sessionId, {
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
      })
      showToast(`"${form.name.trim()}" saved!`, 'success')
      setForm(EMPTY)
      setAiMeta(null)
      onFoodAdded?.()
    } catch (e) {
      showToast(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  const conf = aiMeta ? CONF_STYLE[aiMeta.confidence] || CONF_STYLE.medium : null

  return (
    <div className="page">
      {ToastEl}

      <div className="section-head">
        <span className="section-title">Add Food</span>
        {/* Auto-fill toggle */}
        <button
          onClick={() => setAutoFill(v => !v)}
          style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: autoFill ? 'rgba(0,229,160,0.1)' : 'var(--bg-elevated)',
            border: autoFill ? '1px solid var(--accent)' : '1px solid var(--border)',
            color: autoFill ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
        >
          {autoFill ? '✦ Auto-fill ON' : '✦ Auto-fill OFF'}
        </button>
      </div>

      {/* Food name + AI button */}
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
              onBlur={onNameBlur}
              onKeyDown={e => e.key === 'Enter' && autofill()}
            />
            <button
              className="ai-btn"
              onClick={autofill}
              disabled={aiLoading}
              style={{ flexShrink: 0 }}
            >
              {aiLoading
                ? <><span className="spin" style={{ display:'inline-block' }}>⟳</span> Searching</>
                : <><span>✦</span> AI Fill</>}
            </button>
          </div>
        </div>

        <div className="field">
          <label className="label">
            Serving Unit
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
              (changing this re-fetches nutrition)
            </span>
          </label>
          <input
            className="input"
            placeholder="e.g. serving, 100g, cup, bowl, plate, piece"
            value={form.default_unit}
            onChange={e => set('default_unit', e.target.value)}
          />
        </div>

        {/* Confidence + source badge */}
        {aiMeta && !aiLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginTop: 4,
            background: 'var(--bg-elevated)',
            border: `1px solid ${conf.color}33`,
          }}>
            <span style={{ fontSize: 20 }}>
              {aiMeta.confidence === 'high' ? '✅' : aiMeta.confidence === 'medium' ? '⚡' : '⚠️'}
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: conf.color }}>
                {conf.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Source: {aiMeta.source} · per {aiMeta.per_grams}g
              </div>
            </div>
            {/* Re-fetch button */}
            <button
              onClick={autofill}
              disabled={aiLoading}
              style={{
                marginLeft: 'auto', padding: '5px 12px', borderRadius: 20,
                background: 'transparent', border: `1px solid ${conf.color}55`,
                color: conf.color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ↺ Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {aiLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginTop: 4,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display:'inline-block', fontSize: 18 }}>⟳</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>
                Searching Open Food Facts + Web + AI...
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Checking 3 sources simultaneously
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Macros */}
      <div className="card">
        <div className="card-title">
          Nutrition per Serving
          {aiMeta && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
              (for 1 {form.default_unit || 'serving'} ≈ {aiMeta.per_grams}g)
            </span>
          )}
        </div>

        <div className="field-row">
          <NutField label="🔥 Calories" field="calories_per_unit" unit="kcal"
            form={form} set={set} step="1" />
          <NutField label="🥩 Protein" field="protein_per_unit" unit="g"
            form={form} set={set} step="0.1" />
        </div>

        <div className="field-row">
          <NutField label="🍞 Carbs" field="carbs_per_unit" unit="g"
            form={form} set={set} step="0.1" />
          <NutField label="🫐 Fat" field="fat_per_unit" unit="g"
            form={form} set={set} step="0.1" />
        </div>

        <div className="field-row-3">
          <NutField label="🌿 Fiber" field="fiber_per_unit" unit="g"
            form={form} set={set} step="0.1" />
          <NutField label="🍳 Chol." field="cholesterol_per_unit" unit="mg"
            form={form} set={set} step="1" />
          <NutField label="🩸 Iron" field="iron_per_unit" unit="mg"
            form={form} set={set} step="0.1" />
        </div>
      </div>

      {/* Cost */}
      <div className="card">
        <div className="card-title">Cost</div>
        <div className="field">
          <label className="label">Price per Serving *</label>
          <input className="input" type="number" step="0.5" placeholder="0"
            value={form.cost_per_unit}
            onChange={e => set('cost_per_unit', e.target.value)} />
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={save}
        disabled={saving || aiLoading}
        style={{ marginTop: 4 }}
      >
        {saving ? '⟳ Saving...' : '+ Save Food'}
      </button>

      {/* Tips */}
      <div style={{
        margin: '14px 0 8px', padding: '12px 14px',
        background: 'var(--bg-elevated)', borderRadius: 12,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Tips</strong><br />
        · Type food name → data loads on blur<br />
        · Change the unit (serving/cup/100g) → data updates automatically<br />
        · Click <strong>↺ Retry</strong> if values look wrong<br />
        · Always review AI-filled values before saving
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}

// ─── Small nutrition field component ────────────────────────────────────────

function NutField({ label, field, unit, form, set, step }) {
  const val = form[field]
  const filled = val !== '' && parseFloat(val) > 0
  return (
    <div className="field">
      <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({unit})</span>
        {filled && <span style={{ color: 'var(--accent)', fontSize: 10 }}>●</span>}
      </label>
      <input
        className="input"
        type="number"
        step={step}
        placeholder="0"
        value={val}
        onChange={e => set(field, e.target.value)}
        style={{ borderColor: filled ? 'rgba(0,229,160,0.3)' : undefined }}
      />
    </div>
  )
}
