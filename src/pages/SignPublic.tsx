/**
 * SignPublic.tsx
 *
 * Página pública /sign/:token — firma digital de documentos comerciales.
 * Cumple Ley 527/1999 (Colombia, firma electrónica simple):
 *   - Identidad del firmante (nombre, email, rol)
 *   - Manifestación inequívoca de voluntad (canvas firmado + checkbox aceptación)
 *   - Integridad: hash SHA-256 del payload firmado
 *   - Auditoría: IP + user agent + timestamp servidor
 *
 * Sin login. Lee/escribe con anon key (RLS deshabilitado modo pruebas).
 */

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getSignatureByToken,
  submitSignature,
  sha256Hex,
  type PendingSignatureRecord,
} from '../lib/fichas'
import './SignPublic.css'

export default function SignPublic() {
  const { token } = useParams<{ token: string }>()

  const [loading, setLoading] = useState(true)
  const [record, setRecord] = useState<PendingSignatureRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [signerName, setSignerName] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [signerRole, setSignerRole] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [canvasHasContent, setCanvasHasContent] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitErr, setSubmitErr] = useState<string | null>(null)

  // Cargar firma pendiente
  useEffect(() => {
    if (!token) { setError('Token inválido'); setLoading(false); return }
    let cancelled = false
    ;(async () => {
      try {
        const r = await getSignatureByToken(token)
        if (cancelled) return
        if (!r) {
          setError('Este enlace no es válido o ya fue usado.')
        } else if (r.status === 'signed') {
          setError('Este documento ya fue firmado previamente.')
        } else if (r.status === 'expired') {
          setError('Este enlace expiró. Solicita uno nuevo al equipo de La Palma y El Tucán.')
        } else {
          setRecord(r)
          if (r.signer_name) setSignerName(r.signer_name)
          if (r.signer_email) setSignerEmail(r.signer_email)
          if (r.signer_role) setSignerRole(r.signer_role)
        }
      } catch (e) {
        console.error(e)
        setError('No se pudo cargar el documento. Revisa el enlace.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // Canvas firma
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    // Ajustar resolución al DPR para evitar trazo borroso
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#1A1A1A'
    }
  }, [record])

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!
    const rect = c.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    drawingRef.current = true
    lastPtRef.current = getPoint(e)
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const c = canvasRef.current!
    const ctx = c.getContext('2d')
    if (!ctx) return
    const pt = getPoint(e)
    const last = lastPtRef.current
    if (last) {
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    }
    lastPtRef.current = pt
    if (!canvasHasContent) setCanvasHasContent(true)
  }

  function endDraw() {
    drawingRef.current = false
    lastPtRef.current = null
  }

  function clearCanvas() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    setCanvasHasContent(false)
  }

  const canSubmit =
    !!record &&
    !!signerName.trim() &&
    /\S+@\S+\.\S+/.test(signerEmail) &&
    accepted &&
    canvasHasContent &&
    !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!record || !token || !canvasRef.current) return
    setSubmitting(true)
    setSubmitErr(null)
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      const payload = `${record.document_type}:${record.document_id}|signer:${signerName.trim()}|email:${signerEmail.trim().toLowerCase()}|token:${token}|ts:${new Date().toISOString()}`
      const hash = await sha256Hex(payload)
      await submitSignature(token, {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim(),
        signer_role: signerRole.trim() || undefined,
        signature_image_data_url: dataUrl,
        document_hash_sha256: hash,
      })
      setDone(true)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo procesar la firma.'
      setSubmitErr(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render states ─────────────────────────────────────────────────────────

  if (loading) {
    return <div className="sp-shell"><div className="sp-loader">Cargando documento…</div></div>
  }

  if (error || !record) {
    return (
      <div className="sp-shell">
        <div className="sp-card sp-error">
          <h1>Enlace no disponible</h1>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="sp-shell">
        <div className="sp-card sp-success">
          <div className="sp-success-check">✓</div>
          <h1>Firma registrada</h1>
          <p>Gracias <strong>{signerName}</strong>. Tu firma electrónica fue registrada exitosamente para:</p>
          <p className="sp-doc-name">{record.document_label ?? `${record.document_type} · ${record.document_id.slice(0, 8)}`}</p>
          <p className="sp-success-foot">
            Recibirás copia del documento firmado al correo <strong>{signerEmail}</strong>.<br />
            En cumplimiento de la Ley 527/1999 (Colombia) y normativa internacional aplicable.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sp-shell">
      {/* Header */}
      <header className="sp-header">
        <div className="sp-brand">LA PALMA &amp; EL TUCÁN</div>
        <h1 className="sp-title">Firma digital</h1>
        <div className="sp-doc-label">{record.document_label ?? `${record.document_type} · ${record.document_id.slice(0, 8)}`}</div>
      </header>

      <form onSubmit={handleSubmit} className="sp-form">
        {/* Datos firmante */}
        <section className="sp-section">
          <h2>Datos del firmante</h2>
          <div className="sp-grid">
            <label className="sp-field">
              <span>Nombre completo *</span>
              <input
                type="text"
                value={signerName}
                onChange={e => setSignerName(e.target.value)}
                required
                placeholder="Tu nombre legal"
              />
            </label>
            <label className="sp-field">
              <span>Correo electrónico *</span>
              <input
                type="email"
                value={signerEmail}
                onChange={e => setSignerEmail(e.target.value)}
                required
                placeholder="tu@empresa.com"
              />
            </label>
            <label className="sp-field sp-field-wide">
              <span>Cargo (opcional)</span>
              <input
                type="text"
                value={signerRole}
                onChange={e => setSignerRole(e.target.value)}
                placeholder="Ej. Director de Compras"
              />
            </label>
          </div>
        </section>

        {/* Canvas firma */}
        <section className="sp-section">
          <h2>Firma</h2>
          <div className="sp-canvas-wrap">
            <canvas
              ref={canvasRef}
              className="sp-canvas"
              onPointerDown={startDraw}
              onPointerMove={draw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
              onPointerLeave={endDraw}
            />
            {!canvasHasContent && (
              <div className="sp-canvas-placeholder">Firma aquí con tu mouse o dedo</div>
            )}
          </div>
          <div className="sp-canvas-actions">
            <button type="button" onClick={clearCanvas} className="sp-btn-ghost">
              Limpiar firma
            </button>
          </div>
        </section>

        {/* Aceptación legal */}
        <section className="sp-section sp-legal">
          <label className="sp-check">
            <input
              type="checkbox"
              checked={accepted}
              onChange={e => setAccepted(e.target.checked)}
            />
            <span>
              Declaro que la firma anterior es de mi autoría y que acepto el contenido de este documento
              como vinculante. Entiendo que mi IP, fecha y hora quedan registrados como evidencia conforme a
              la <strong>Ley 527 de 1999</strong> (Colombia) sobre firma electrónica.
            </span>
          </label>
        </section>

        {/* Submit */}
        <div className="sp-submit-bar">
          {submitErr && <div className="sp-err-msg">{submitErr}</div>}
          <button type="submit" disabled={!canSubmit} className="sp-btn-primary">
            {submitting ? 'Procesando firma…' : 'Firmar documento'}
          </button>
        </div>
      </form>

      <footer className="sp-foot">
        <span>@lapalmayeltucan</span>
        <span>lapalmayeltucan.com</span>
      </footer>
    </div>
  )
}
