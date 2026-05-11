/**
 * SignatureSection.tsx
 *
 * Sección que se monta al pie de un documento (OC / Shipping / Trip).
 * Muestra el estado de firma y permite generar el link público para el cliente.
 *
 * Estados:
 *   - sin firma         → botón "Compartir para firma del cliente"
 *   - firma pending     → link copiable + estado "Enviado, esperando firma"
 *   - firma signed      → imagen firma + datos firmante + IP + timestamp (verde)
 *   - firma declined    → estado rojo "Rechazada"
 *   - firma expired     → estado naranja "Expirada"
 *
 * Recibe documentType + documentId del padre. Si documentId está vacío
 * (documento aún no guardado) el botón está deshabilitado.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  createSignatureLink,
  getSignatureForDocument,
  sendSignatureEmail,
  type SignatureDocumentType,
} from '../lib/fichas'
import './SignatureSection.css'

interface SigState {
  id: string
  signature_token: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  signer_name?: string
  signer_email?: string
  signer_role?: string
  signature_image_url?: string
  signed_at?: string
  signed_ip?: string
  expires_at?: string
  sent_at?: string
}

interface Props {
  documentType: SignatureDocumentType
  documentId?: string  // si undefined, el doc no está guardado todavía
  /** Hint para pre-rellenar (ej. buyer.contact_name + buyer.email del OC) */
  signerHint?: { signer_name?: string; signer_email?: string; signer_role?: string }
  /** Etiqueta visible (ej. "OC-2026-001") — solo cosmético */
  documentLabel?: string
  /** Resumen corto del documento para el cuerpo del email (ej. "Geisha 38.5kg · $4116 USD · DAP") */
  documentSummary?: string
}

export function SignatureSection({ documentType, documentId, signerHint, documentLabel, documentSummary }: Props) {
  const [sig, setSig] = useState<SigState | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [emailMsg, setEmailMsg] = useState<string | null>(null)
  const [emailTo, setEmailTo] = useState('')

  const refresh = useCallback(async () => {
    if (!documentId) { setSig(null); return }
    setLoading(true)
    try {
      const s = await getSignatureForDocument(documentType, documentId)
      setSig(s)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [documentType, documentId])

  useEffect(() => { void refresh() }, [refresh])

  async function handleCreateLink() {
    if (!documentId) return
    setCreating(true)
    setError(null)
    try {
      await createSignatureLink(documentType, documentId, signerHint)
      await refresh()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el link'
      setError(msg)
    } finally {
      setCreating(false)
    }
  }

  function buildShareUrl(token: string): string {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '/')
    return `${base}#/sign/${token}`
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyMsg('¡Link copiado!')
      setTimeout(() => setCopyMsg(null), 2500)
    } catch {
      setCopyMsg('No se pudo copiar — usa Ctrl+C manual')
      setTimeout(() => setCopyMsg(null), 3500)
    }
  }

  async function handleSendEmail(signUrl: string) {
    const target = (emailTo || signerHint?.signer_email || '').trim()
    if (!target || !/\S+@\S+\.\S+/.test(target)) {
      setEmailMsg('Ingresa un correo válido antes de enviar.')
      setTimeout(() => setEmailMsg(null), 3500)
      return
    }
    setSending(true)
    setEmailMsg(null)
    try {
      await sendSignatureEmail({
        to: target,
        signer_name: signerHint?.signer_name,
        document_label: documentLabel ?? 'Documento',
        document_summary: documentSummary ?? '',
        sign_url: signUrl,
      })
      setEmailMsg(`✓ Email enviado a ${target}`)
      setTimeout(() => setEmailMsg(null), 5000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al enviar el email'
      setEmailMsg(`✗ ${msg}`)
      setTimeout(() => setEmailMsg(null), 6000)
    } finally {
      setSending(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!documentId) {
    return (
      <section className="sigsec sigsec-disabled">
        <header className="sigsec-header">
          <h3>Firma del cliente</h3>
          <span className="sigsec-badge sigsec-badge-gray">No disponible</span>
        </header>
        <p className="sigsec-help">
          Guarda primero el documento (botón <strong>Generar PDF</strong>) para poder compartirlo a firma.
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="sigsec sigsec-loading">
        <header className="sigsec-header"><h3>Firma del cliente</h3></header>
        <p>Cargando estado de firma…</p>
      </section>
    )
  }

  // Caso: ya hay firma firmada
  if (sig?.status === 'signed') {
    return (
      <section className="sigsec sigsec-signed">
        <header className="sigsec-header">
          <h3>Firma del cliente</h3>
          <span className="sigsec-badge sigsec-badge-green">✓ Firmado</span>
        </header>

        <div className="sigsec-signed-grid">
          <div className="sigsec-signed-meta">
            <div className="sigsec-meta-row">
              <span className="sigsec-meta-label">Firmante</span>
              <span className="sigsec-meta-value">{sig.signer_name || '—'}</span>
            </div>
            <div className="sigsec-meta-row">
              <span className="sigsec-meta-label">Email</span>
              <span className="sigsec-meta-value">{sig.signer_email || '—'}</span>
            </div>
            {sig.signer_role && (
              <div className="sigsec-meta-row">
                <span className="sigsec-meta-label">Cargo</span>
                <span className="sigsec-meta-value">{sig.signer_role}</span>
              </div>
            )}
            <div className="sigsec-meta-row">
              <span className="sigsec-meta-label">Firmado</span>
              <span className="sigsec-meta-value">{fmtDate(sig.signed_at)}</span>
            </div>
            {sig.signed_ip && (
              <div className="sigsec-meta-row">
                <span className="sigsec-meta-label">IP</span>
                <span className="sigsec-meta-value sigsec-meta-mono">{sig.signed_ip}</span>
              </div>
            )}
            <div className="sigsec-meta-row sigsec-legal-note">
              <small>
                Firma electrónica registrada conforme a la Ley 527 de 1999 (Colombia).
              </small>
            </div>
          </div>

          <div className="sigsec-signed-image">
            <div className="sigsec-img-label">Firma manuscrita</div>
            {sig.signature_image_url ? (
              <img src={sig.signature_image_url} alt="Firma del cliente" className="sigsec-img" />
            ) : (
              <div className="sigsec-img-missing">Sin imagen registrada</div>
            )}
          </div>
        </div>
      </section>
    )
  }

  // Caso: firma pendiente (esperando firma del cliente)
  if (sig?.status === 'pending') {
    const url = buildShareUrl(sig.signature_token)
    return (
      <section className="sigsec sigsec-pending">
        <header className="sigsec-header">
          <h3>Firma del cliente</h3>
          <span className="sigsec-badge sigsec-badge-orange">⌛ Enviado · Esperando firma</span>
        </header>

        <div className="sigsec-link-row">
          <input type="text" readOnly value={url} className="sigsec-link-input"
                 onFocus={e => e.currentTarget.select()} />
          <button type="button" className="sigsec-btn-copy"
                  onClick={() => void copyToClipboard(url)}>
            Copiar link
          </button>
        </div>
        {copyMsg && <div className="sigsec-copy-msg">{copyMsg}</div>}

        <div className="sigsec-pending-meta">
          {sig.signer_email && <span>Destino: <strong>{sig.signer_email}</strong></span>}
          {sig.sent_at && <span>Generado: {fmtDate(sig.sent_at)}</span>}
          {sig.expires_at && <span>Expira: {fmtDate(sig.expires_at)}</span>}
        </div>

        {/* ── Envío por correo ── */}
        <div className="sigsec-email-row">
          <input
            type="email"
            className="sigsec-email-input"
            placeholder={signerHint?.signer_email || 'correo@cliente.com'}
            value={emailTo}
            onChange={e => setEmailTo(e.target.value)}
          />
          <button
            type="button"
            className="sigsec-btn-send"
            onClick={() => void handleSendEmail(url)}
            disabled={sending}
          >
            {sending ? 'Enviando…' : '📧 Enviar por correo'}
          </button>
        </div>
        {emailMsg && (
          <div className={`sigsec-email-msg${emailMsg.startsWith('✓') ? ' sigsec-email-ok' : ' sigsec-email-err'}`}>
            {emailMsg}
          </div>
        )}

        <p className="sigsec-help">
          Envía el link al cliente por correo (o copia y pega). Al hacer click, abrirá la página de firma
          donde podrá firmar con su mouse/dedo y aceptar el documento.
        </p>

        <button type="button" className="sigsec-btn-regen"
                onClick={() => void handleCreateLink()}
                disabled={creating}>
          {creating ? 'Generando…' : 'Generar nuevo link'}
        </button>
      </section>
    )
  }

  // Caso: declined / expired
  if (sig?.status === 'declined' || sig?.status === 'expired') {
    return (
      <section className={`sigsec sigsec-${sig.status}`}>
        <header className="sigsec-header">
          <h3>Firma del cliente</h3>
          <span className={`sigsec-badge ${sig.status === 'declined' ? 'sigsec-badge-red' : 'sigsec-badge-orange'}`}>
            {sig.status === 'declined' ? '✗ Rechazada' : '⚠ Expirada'}
          </span>
        </header>
        <p className="sigsec-help">
          {sig.status === 'declined'
            ? 'El cliente rechazó la firma. Puedes generar un nuevo link para reintentar.'
            : 'El link expiró sin firma. Genera uno nuevo para compartir con el cliente.'}
        </p>
        <button type="button" className="sigsec-btn-share"
                onClick={() => void handleCreateLink()}
                disabled={creating}>
          {creating ? 'Generando…' : 'Generar nuevo link'}
        </button>
      </section>
    )
  }

  // Caso: sin firma todavía
  return (
    <section className="sigsec sigsec-empty">
      <header className="sigsec-header">
        <h3>Firma del cliente</h3>
        <span className="sigsec-badge sigsec-badge-gray">Sin enviar</span>
      </header>
      <p className="sigsec-help">
        Cuando estés listo, comparte un link público para que el cliente firme este documento{documentLabel ? ` (${documentLabel})` : ''}.
        El link expira en 30 días.
      </p>
      {error && <div className="sigsec-error">{error}</div>}
      <button type="button" className="sigsec-btn-share"
              onClick={() => void handleCreateLink()}
              disabled={creating}>
        {creating ? 'Generando…' : 'Compartir para firma del cliente'}
      </button>
    </section>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
  } catch { return iso }
}
