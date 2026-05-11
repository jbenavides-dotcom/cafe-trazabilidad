/**
 * OfferingPublic.tsx
 *
 * Página pública /offering/:token — el cliente abre el link recibido por email
 * sin login. Ve el preview del offering con sus muestras, escoge las que le
 * interesan (kg pedidos + notas opcionales) y envía la selección.
 *
 * - No requiere autenticación (montada FUERA del AppShell en App.tsx)
 * - Lee con anon key (RLS deshabilitado en ct_* — GRANT ALL a anon)
 * - Marca recipient.funnel_stage='responded' al enviar
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getOfferingByToken, submitClientSelection, trackOfferingView, type ClientSelectionInput } from '../lib/fichas'
import type { Offering, OfferingSample } from '../types/fichas'
import './OfferingPublic.css'

interface SelectionRowState {
  selected: boolean
  requested_kg: string
  priority: 1 | 2 | 3
  client_notes: string
}

export default function OfferingPublic() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [offering, setOffering] = useState<Offering | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [rows, setRows] = useState<Record<number, SelectionRowState>>({})

  const [submitting, setSubmitting] = useState(false)
  const [submittedOk, setSubmittedOk] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Token inválido')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const o = await getOfferingByToken(token)
        if (cancelled) return
        if (!o) {
          setError('Este enlace no es válido o el offering ya no está disponible.')
        } else {
          setOffering(o)
          // Init rows
          const init: Record<number, SelectionRowState> = {}
          for (const s of o.samples) {
            init[s.sample_order] = {
              selected: false,
              requested_kg: '',
              priority: 2,
              client_notes: '',
            }
          }
          setRows(init)
          // Track view (async, no esperar)
          void trackOfferingView(token)
        }
      } catch (e) {
        console.error(e)
        setError('No se pudo cargar el offering. Revisa el enlace.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  const cfg = useMemo(() => offering ? getTemplateColors(offering.template_code) : null, [offering])

  const selectedCount = Object.values(rows).filter(r => r.selected).length
  const canSubmit = !!clientEmail.trim() && /\S+@\S+\.\S+/.test(clientEmail) && selectedCount > 0 && !submitting

  function updateRow(sampleOrder: number, patch: Partial<SelectionRowState>) {
    setRows(prev => ({
      ...prev,
      [sampleOrder]: { ...prev[sampleOrder], ...patch },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!offering || !token) return
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const selections: ClientSelectionInput[] = Object.entries(rows).map(([order, r]) => ({
        sample_order: Number(order),
        selected: r.selected,
        requested_kg: r.requested_kg ? Number(r.requested_kg) : undefined,
        priority: r.priority,
        client_notes: r.client_notes || undefined,
      }))
      await submitClientSelection(token, clientEmail, clientName, selections)
      setSubmittedOk(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al enviar la selección'
      setSubmitErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Estados de render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="op-shell">
        <div className="op-loader">Cargando offering…</div>
      </div>
    )
  }

  if (error || !offering) {
    return (
      <div className="op-shell">
        <div className="op-error-card">
          <h1>Enlace no disponible</h1>
          <p>{error ?? 'No encontramos este offering.'}</p>
          <p className="op-error-hint">Si recibiste este enlace por email, contacta a La Palma y El Tucán para obtener uno nuevo.</p>
        </div>
      </div>
    )
  }

  if (submittedOk) {
    return (
      <div className="op-shell">
        <div className="op-success-card" style={{ borderColor: cfg?.headerBg }}>
          <div className="op-success-icon" style={{ background: cfg?.headerBg }}>✓</div>
          <h1>¡Gracias por tu selección!</h1>
          <p>Hemos recibido tu interés en <strong>{selectedCount}</strong> {selectedCount === 1 ? 'muestra' : 'muestras'} de <strong>{programDisplayName(offering.template_code)}</strong>.</p>
          <p>El equipo de La Palma y El Tucán se pondrá en contacto pronto al correo <strong>{clientEmail}</strong>.</p>
          <p className="op-success-foot">From the Heart is how we move forward.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="op-shell">
      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div className="op-hero" style={{ background: cfg?.headerBg ?? '#B30055' }}>
        <div className="op-hero-brand">LA PALMA &amp; EL TUCÁN</div>
        <h1 className="op-hero-title">
          From <em>The</em> heart
        </h1>
        <div className="op-hero-program" style={{ color: cfg?.scriptColor }}>
          {programDisplayName(offering.template_code)}
        </div>
        {offering.title && <div className="op-hero-subtitle">{offering.title}</div>}
      </div>

      {/* ── INTRO ───────────────────────────────────────────────────────── */}
      <div className="op-intro">
        {offering.cover_message && (
          <p className="op-intro-message">{offering.cover_message}</p>
        )}
        <p className="op-intro-instructions">
          Below you'll find the available samples. Select the ones you'd like to receive, indicate how many kilograms you need, and add any notes for our team.
        </p>
      </div>

      {/* ── FORM ────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="op-form">
        {/* Datos cliente */}
        <div className="op-section">
          <h2>Your details</h2>
          <div className="op-field-row">
            <label className="op-field">
              <span>Name</span>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label className="op-field">
              <span>Email *</span>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </label>
          </div>
        </div>

        {/* Lista de muestras */}
        <div className="op-section">
          <h2>Samples ({offering.samples.length})</h2>
          <div className="op-samples-list">
            {offering.samples.map((sample) => (
              <SampleCard
                key={sample.sample_order}
                sample={sample}
                state={rows[sample.sample_order]}
                onChange={(patch) => updateRow(sample.sample_order, patch)}
                accentColor={cfg?.headerBg ?? '#B30055'}
              />
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="op-footer-bar">
          <div className="op-footer-count">
            {selectedCount === 0
              ? 'No samples selected yet'
              : `${selectedCount} ${selectedCount === 1 ? 'sample' : 'samples'} selected`}
          </div>
          {submitErr && <div className="op-submit-err">{submitErr}</div>}
          <button
            type="submit"
            disabled={!canSubmit}
            className="op-submit-btn"
            style={{ background: canSubmit ? cfg?.headerBg : '#999' }}
          >
            {submitting ? 'Sending…' : 'Send my selection'}
          </button>
        </div>
      </form>

      <footer className="op-bottom">
        <span>@lapalmayeltucan</span>
        <span>lapalmayeltucan.com</span>
      </footer>
    </div>
  )
}

// ─── SampleCard ─────────────────────────────────────────────────────────────

function SampleCard({
  sample,
  state,
  onChange,
  accentColor,
}: {
  sample: OfferingSample
  state: SelectionRowState | undefined
  onChange: (patch: Partial<SelectionRowState>) => void
  accentColor: string
}) {
  const s = state ?? { selected: false, requested_kg: '', priority: 2 as const, client_notes: '' }

  return (
    <div className={`op-sample${s.selected ? ' op-sample-selected' : ''}`}
         style={{ borderColor: s.selected ? accentColor : '#E5E5E5' }}>
      <label className="op-sample-toggle">
        <input
          type="checkbox"
          checked={s.selected}
          onChange={e => onChange({ selected: e.target.checked })}
        />
        <span className="op-sample-checkbox" style={{ borderColor: accentColor, background: s.selected ? accentColor : 'transparent' }}>
          {s.selected && <span className="op-check">✓</span>}
        </span>
        <span className="op-sample-num">#{sample.sample_order}</span>
        <span className="op-sample-variety">{sample.variety || '—'}</span>
        {sample.tasting_score && <span className="op-sample-score" style={{ color: accentColor }}>{sample.tasting_score}</span>}
      </label>

      <div className="op-sample-body">
        <div className="op-sample-meta">
          <div className="op-meta-item">
            <span className="op-meta-label">Process</span>
            <span className="op-meta-value">{sample.process || '—'}</span>
          </div>
          {sample.macroprofile && (
            <div className="op-meta-item">
              <span className="op-meta-label">Profile</span>
              <span className="op-meta-value">{sample.macroprofile}</span>
            </div>
          )}
          <div className="op-meta-item">
            <span className="op-meta-label">Available</span>
            <span className="op-meta-value">{sample.availability_kg > 0 ? `${sample.availability_kg} kg` : '—'}</span>
          </div>
          <div className="op-meta-item">
            <span className="op-meta-label">Price</span>
            <span className="op-meta-value">{sample.price_usd_per_lb > 0 ? `$${sample.price_usd_per_lb.toFixed(2)}/lb` : '—'}</span>
          </div>
        </div>
        {sample.tasting_notes && (
          <div className="op-sample-notes">{sample.tasting_notes}</div>
        )}
      </div>

      {s.selected && (
        <div className="op-sample-request">
          <label className="op-req-field">
            <span>Requested kg</span>
            <input
              type="number"
              min="0"
              step="0.5"
              max={sample.availability_kg}
              value={s.requested_kg}
              onChange={e => onChange({ requested_kg: e.target.value })}
              placeholder={`Max ${sample.availability_kg} kg`}
            />
          </label>
          <label className="op-req-field">
            <span>Priority</span>
            <select
              value={s.priority}
              onChange={e => onChange({ priority: Number(e.target.value) as 1 | 2 | 3 })}
            >
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </label>
          <label className="op-req-field op-req-field-wide">
            <span>Notes (optional)</span>
            <input
              type="text"
              value={s.client_notes}
              onChange={e => onChange({ client_notes: e.target.value })}
              placeholder="Any specific requirements?"
            />
          </label>
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function programDisplayName(code: Offering['template_code']): string {
  const map: Record<Offering['template_code'], string> = {
    pulse: 'PULSE',
    beat: 'BEAT',
    connect: 'CONNECT',
    amistad: 'LA AMISTAD',
  }
  return map[code]
}

function getTemplateColors(code: Offering['template_code']): { headerBg: string; scriptColor: string } {
  const map: Record<Offering['template_code'], { headerBg: string; scriptColor: string }> = {
    pulse:   { headerBg: '#E97062', scriptColor: '#FFE8E0' },
    beat:    { headerBg: '#A8327E', scriptColor: '#F6E1EE' },
    connect: { headerBg: '#8470B5', scriptColor: '#E8E1F5' },
    amistad: { headerBg: '#7D8456', scriptColor: '#EBEBD5' },
  }
  return map[code]
}
