import React, { useState, useRef, useEffect, useCallback } from 'react'
import { foodApi, aiApi } from '../services/api'
import { useToast } from '../hooks/useToast'

const EMPTY = {
  name: '', default_unit: 'serving',
  protein_per_unit: '', carbs_per_unit: '', fat_per_unit: '',
  cholesterol_per_unit: '', iron_per_unit: '', fiber_per_unit: '',
  calories_per_unit: '', cost_per_unit: '',
}

const CONF_STYLE = {
  high:   { color: '#00e5a0', label: '✓ High confidence' },
  medium: { color: '#ffb347', label: '~ Medium confidence — review values' },
  low:    { color: '#ff4d6d', label: '⚠ Low confidence — edit carefully' },
}

const GRAM_UNITS = new Set(['g', 'gram', 'grams', 'kg', 'kilo', 'kilogram',
                             'oz', 'ounce', 'ounces', 'lb', 'lbs'])

// Pipeline stages
const STAGE = {
  IDLE:        'idle',
  CHECKING_DB: 'checking_db',   // Step 1: user's food DB
  ASKING_LLM:  'asking_llm',    // Step 2: LLM (Groq)
  WEB_SEARCH:  'web_search',    // Step 3: web search
  DONE:        'done',
  ERROR:       'error',
}

export default function AddFood({ sessionId, onFoodAdded }) {
  const [form, setForm]             = useState(EMPTY)
  const [stage, setStage]           = useState(STAGE.IDLE)
  const [saving, setSaving]         = useState(false)
  const [aiMeta, setAiMeta]         = useState(null)
  const [autoFill, setAutoFill]     = useState(true)
  // Confirmation dialog state
  const [pendingData, setPendingData] = useState(null)  // { nutrition, source, confidence, message }
  const [showConfirm, setShowConfirm] = useState(false)
  const { showToast, ToastEl }      = useToast()
  const nameRef   = useRef()
  const debouncer = useRef(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isLoading = [STAGE.CHECKING_DB, STAGE.ASKING_LLM, STAGE.WEB_SEARCH].includes(stage)

  const applyNutrition = useCallback((n, meta) => {
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
    setAiMeta(meta)
    setStage(STAGE.DONE)
  }, [])

  // ── Smart pipeline: DB → LLM → Web ──────────────────────────────────────

  const runLookup = useCallback(async (foodName, unit) => {
    if (!foodName.trim()) return
    setAiMeta(null)
    setShowConfirm(false)
    setPendingData(null)

    try {
      // ── Step 1: Check user's DB ─────────────────────────────────────────
      setStage(STAGE.CHECKING_DB)
      const isGramUnit = GRAM_UNITS.has(unit.toLowerCase().trim())

      let res
      if (isGramUnit) {
        res = await aiApi.predict(foodName.trim(), 100, 'g', sessionId)
      } else {
        res = await aiApi.predictServing(foodName.trim(), 1, unit, sessionId)
      }

      if (res.from_db && res.db_food) {
        // Found in user's DB — apply directly, no confirmation needed
        const n = res.nutrition
        applyNutrition(n, {
          source: 'your food database',
          confidence: 'high',
          per_grams: res.db_food.calories_per_unit ? 'saved' : 100,
          stage: 'db',
        })
        showToast(`Found "${foodName}" in your food database ✓`, 'success', 3000)
        return
      }

      // ── Step 2: LLM result came back (always attempted) ────────────────
      const n = res.nutrition
      const confidence = n?.confidence || 'low'
      const source = n?.source || 'ai'

      if (confidence === 'high' || (confidence === 'medium' && source.includes('openfoodfacts'))) {
        // High quality data — apply directly
        applyNutrition(n, {
          source: _friendlySource(source),
          confidence,
          per_grams: n.serving_grams || n.per_grams || 100,
          stage: 'llm',
        })
        showToast(`Data loaded · ${_friendlySource(source)}`, 'info', 3000)
        return
      }

      // ── Step 3: Low/medium confidence — show confirmation ──────────────
      setStage(STAGE.WEB_SEARCH)

      const filled = _countFilled(n)
      const confirmMsg = confidence === 'medium'
        ? `AI found data for "${foodName}" with medium confidence. The values may not be exact — please review before saving.`
        : `Low confidence data for "${foodName}". This may be approximate. Please verify and edit before saving.`

      setPendingData({
        nutrition: n,
        source: _friendlySource(source),
        confidence,
        message: confirmMsg,
        filled,
      })
      setShowConfirm(true)
      setStage(STAGE.DONE)

    } catch (e) {
      setStage(STAGE.ERROR)
      showToast('Lookup failed — fill manually', 'error')
    }
  }, [sessionId, applyNutrition, showToast])

  // User confirms the pending data
  const confirmData = () => {
    if (!pendingData) return
    applyNutrition(pendingData.nutrition, {
      source: pendingData.source,
      confidence: pendingData.confidence,
      per_grams: pendingData.nutrition?.serving_grams || pendingData.nutrition?.per_grams || 100,
      stage: 'confirmed',
    })
    setShowConfirm(false)
    setPendingData(null)
    showToast('Values applied — review and adjust if needed', 'info', 3000)
  }

  const rejectData = () => {
    setShowConfirm(false)
    setPendingData(null)
    setStage(STAGE.IDLE)
    showToast('Cleared — please fill values manually', 'info', 2500)
  }

  // ── Debounced unit change auto-retrigger ─────────────────────────────────

  useEffect(() => {
    if (!autoFill) return
    if (!form.name.trim()) return
    if (!form.default_unit.trim()) return

    if (debouncer.current) clearTimeout(debouncer.current)
    debouncer.current = setTimeout(() => {
      runLookup(form.name, form.default_unit)
    }, 900)

    return () => clearTimeout(debouncer.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.default_unit])

  const autofill = () => {
    if (!form.name.trim()) {
      showToast('Enter food name first', 'error')
      nameRef.current?.focus()
      return
    }
    runLookup(form.name, form.default_unit || 'serving')
  }

  const onNameBlur = () => {
    if (!form.name.trim()) return
    const hasData = form.calories_per_unit || form.protein_per_unit
    if (!hasData && autoFill) {
      runLookup(form.name, form.default_unit || 'serving')
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
      setStage(STAGE.IDLE)
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
              disabled={isLoading}
              style={{ flexShrink: 0 }}
            >
              {isLoading
                ? <><span className="spin" style={{ display:'inline-block' }}>⟳</span> {_stageLabel(stage)}</>
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

        {/* Loading state — show pipeline progress */}
        {isLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginTop: 4,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          }}>
            <span style={{ animation: 'spin 1s linear infinite', display:'inline-block', fontSize: 18 }}>⟳</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>
                {_stageDescription(stage)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {_stageSub(stage)}
              </div>
            </div>
          </div>
        )}

        {/* Confidence + source badge (after successful fill) */}
        {aiMeta && !isLoading && !showConfirm && (
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
                Source: {aiMeta.source}
                {aiMeta.stage === 'db' ? ' (from your database)' : ` · per ${aiMeta.per_grams}g`}
              </div>
            </div>
            <button
              onClick={autofill}
              disabled={isLoading}
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

        {/* Confirmation dialog for low/medium confidence */}
        {showConfirm && pendingData && (
          <div style={{
            padding: '14px', borderRadius: 12, marginTop: 8,
            background: 'var(--bg-elevated)',
            border: `1px solid ${pendingData.confidence === 'medium' ? '#ffb34755' : '#ff4d6d55'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>
                {pendingData.confidence === 'medium' ? '⚡' : '⚠️'}
              </span>
              <div>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: pendingData.confidence === 'medium' ? '#ffb347' : '#ff4d6d',
                  marginBottom: 4,
                }}>
                  {pendingData.confidence === 'medium' ? 'Medium confidence data found' : 'Low confidence data found'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {pendingData.message}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  Source: {pendingData.source} · {pendingData.filled}/7 fields filled
                </div>
              </div>
            </div>

            {/* Preview values */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
              padding: '10px', borderRadius: 8,
              background: 'var(--bg-page)', marginBottom: 12,
            }}>
              {[
                ['🔥', 'Cal', pendingData.nutrition?.calories, 'kcal'],
                ['🥩', 'Pro', pendingData.nutrition?.protein, 'g'],
                ['🍞', 'Carb', pendingData.nutrition?.carbs, 'g'],
                ['🫐', 'Fat', pendingData.nutrition?.fat, 'g'],
              ].map(([icon, label, val, unit]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{icon} {label}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: val > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}>
                    {val > 0 ? `${val.toFixed(1)}${unit}` : '—'}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmData}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'rgba(0,229,160,0.1)',
                  border: '1px solid rgba(0,229,160,0.4)',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✓ Use these values
              </button>
              <button
                onClick={rejectData}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10,
                  background: 'rgba(255,77,109,0.08)',
                  border: '1px solid rgba(255,77,109,0.3)',
                  color: 'var(--danger)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                ✕ Fill manually
              </button>
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
              (for 1 {form.default_unit || 'serving'}
              {aiMeta.stage !== 'db' ? ` ≈ ${aiMeta.per_grams}g` : ''})
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
        disabled={saving || isLoading || showConfirm}
        style={{ marginTop: 4 }}
      >
        {saving ? '⟳ Saving...' : '+ Save Food'}
      </button>

      <div style={{
        margin: '14px 0 8px', padding: '12px 14px',
        background: 'var(--bg-elevated)', borderRadius: 12,
        fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text-secondary)' }}>How it works</strong><br />
        1. Checks your saved food DB first (instant & accurate)<br />
        2. Asks AI with cuisine-aware prompts (Groq LLM)<br />
        3. Falls back to web search if AI is uncertain<br />
        · You confirm before low-confidence data is applied
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _friendlySource(src) {
  if (!src) return 'AI estimate'
  if (src.includes('openfoodfacts'))    return 'Open Food Facts'
  if (src.includes('web_page'))         return 'Nutrition database'
  if (src.includes('web_search_high'))  return 'Web (high accuracy)'
  if (src.includes('web+ai'))           return 'Web + AI'
  if (src.includes('user_db'))          return 'Your database'
  return 'AI estimate'
}

function _countFilled(n) {
  if (!n) return 0
  return ['calories','protein','carbs','fat','fiber','cholesterol','iron'].filter(k => n[k] > 0).length
}

function _stageLabel(stage) {
  if (stage === STAGE.CHECKING_DB) return 'Checking DB'
  if (stage === STAGE.ASKING_LLM)  return 'Asking AI'
  if (stage === STAGE.WEB_SEARCH)  return 'Searching Web'
  return 'Loading'
}

function _stageDescription(stage) {
  if (stage === STAGE.CHECKING_DB) return 'Step 1: Checking your food database...'
  if (stage === STAGE.ASKING_LLM)  return 'Step 2: Asking AI (Groq LLM)...'
  if (stage === STAGE.WEB_SEARCH)  return 'Step 3: Searching the web...'
  return 'Searching...'
}

function _stageSub(stage) {
  if (stage === STAGE.CHECKING_DB) return 'Looking for exact match in your saved foods'
  if (stage === STAGE.ASKING_LLM)  return 'Cuisine-aware nutrition prediction'
  if (stage === STAGE.WEB_SEARCH)  return 'Open Food Facts + DuckDuckGo + page fetch'
  return ''
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
