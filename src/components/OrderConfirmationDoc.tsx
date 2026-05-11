import { useState, useEffect } from 'react'
import './OrderConfirmationDoc.css'
import type { OrderConfirmation, OrderConfirmationItem } from '../types/fichas'
import { OrderConfirmationPDF } from './pdf/OrderConfirmationPDF'
import { pdf } from '@react-pdf/renderer'
import { saveOrderConfirmationFull } from '../lib/fichas'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import { SignatureSection } from './SignatureSection'

// ─── Bache disponible (AS APROBADO) ───────────────────────────────────────────

interface BacheOption {
  code: string
  variety: string
  process: string
  kg_disp: number
  sca: string
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  doc: OrderConfirmation
  onChange: (updated: OrderConfirmation) => void
  /** @deprecated El PDF se genera internamente ahora (save + download en handleGeneratePDF) */
  onGeneratePDF?: () => void
  onSaveDraft: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function calcTotal(items: OrderConfirmationItem[]): number {
  return items.reduce((acc, it) => acc + it.total_usd, 0)
}

function buildSummary(doc: OrderConfirmation): string {
  const parts: string[] = []
  if (doc.items.length === 1) {
    parts.push(doc.items[0].description)
    if (doc.items[0].quantity_kg) parts.push(`${doc.items[0].quantity_kg} kg`)
  } else if (doc.items.length > 1) {
    const totalKg = doc.items.reduce((a, i) => a + i.quantity_kg, 0)
    parts.push(`${doc.items.length} nanolotes`)
    parts.push(`${totalKg.toFixed(1)} kg`)
  }
  if (doc.total_usd > 0) parts.push(`$${fmtUSD(doc.total_usd)} USD`)
  if (doc.incoterm) parts.push(doc.incoterm)
  if (doc.destination_country) parts.push(doc.destination_country)
  return parts.join(' · ')
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function OrderConfirmationDoc({ doc, onChange, onSaveDraft }: Props) {
  const [baches, setBaches] = useState<BacheOption[]>([])
  const [loadingBaches, setLoadingBaches] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBaches() {
      setLoadingBaches(true)
      try {
        const data = await batchGet(SHEET_2026_ID, [
          'CFF!A5:L200',
          'AF!A2:J200',
          'AS!B2:T200',
        ])

        // Baches con AF llenado (SCA en columna J)
        const afCodes = new Set(
          data['AF!A2:J200']
            .filter(r => r[0]?.trim() && r[0] !== '#N/A' && r[9] && !isNaN(parseFloat(r[9])))
            .map(r => r[0].trim())
        )

        // Mapa AS: code → { estado, sca }
        const asMap = new Map<string, { estado: string; sca: string }>()
        for (const r of data['AS!B2:T200']) {
          const batch = r[0]?.trim()
          if (!batch) continue
          asMap.set(batch, { estado: r[18] || '', sca: r[14] || '' })
        }

        const list: BacheOption[] = []
        for (const r of data['CFF!A5:L200']) {
          const code = r[3]?.trim()
          if (!code || code === '#') continue
          const as_data = asMap.get(code)
          if (!afCodes.has(code)) continue
          if (!as_data?.estado.toUpperCase().includes('APROBADO')) continue
          list.push({
            code,
            variety: r[8] || '',
            process: r[7] || '',
            kg_disp: parseFloat((r[9] || '0').replace(',', '.')),
            sca: as_data.sca,
          })
        }
        setBaches(list)
      } catch {
        // Si falla la carga (sin sesión o error de red) simplemente no hay opciones
        setBaches([])
      } finally {
        setLoadingBaches(false)
      }
    }
    void fetchBaches()
  }, [])

  function patch(updates: Partial<OrderConfirmation>) {
    onChange({ ...doc, ...updates })
  }

  function patchBuyer(field: keyof NonNullable<typeof doc.buyer>, value: string) {
    const buyerBase = doc.buyer ?? { company_name: '', contact_name: '', address: '', city: '', country: '', phone: '', email: '' }
    onChange({ ...doc, buyer: { ...buyerBase, [field]: value } })
  }

  function patchSeller(field: keyof NonNullable<typeof doc.seller>, value: string) {
    const sellerBase = doc.seller ?? { name: '', address: '', phone: '', email: '' }
    onChange({ ...doc, seller: { ...sellerBase, [field]: value } })
  }

  function patchItem(idx: number, field: keyof OrderConfirmationItem, value: string | number | null) {
    const items = doc.items.map((it, i) =>
      i === idx ? { ...it, [field]: value } : it
    )
    // Recalcular total global
    const total_usd = calcTotal(items)
    onChange({ ...doc, items, total_usd })
  }

  function addItem() {
    const newItem: OrderConfirmationItem = {
      bache_code: undefined,
      description: '',
      program: null,
      quantity_kg: 0,
      unit_price_per_lb_usd: 0,
      total_usd: 0,
    }
    const items = [...doc.items, newItem]
    onChange({ ...doc, items })
  }

  function removeItem(idx: number) {
    const items = doc.items.filter((_, i) => i !== idx)
    onChange({ ...doc, items, total_usd: calcTotal(items) })
  }

  async function handleGeneratePDF() {
    setSaving(true)
    setSaveError(null)
    try {
      // 1. Guardar a Supabase (buyer + OC + items)
      const savedDoc = await saveOrderConfirmationFull(doc)
      // Propagar el ID y número retornados al estado padre
      onChange(savedDoc)

      // 2. Generar y descargar el PDF con los datos guardados
      const filename = savedDoc.number
        ? `${savedDoc.number.replace(/[^a-zA-Z0-9-_]/g, '-')}.pdf`
        : 'order-confirmation.pdf'
      const blob = await pdf(<OrderConfirmationPDF doc={savedDoc} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error guardando o generando PDF')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ocd-split">
      {/* ── Formulario izquierda ── */}
      <div className="ocd-form">
        <div className="ocd-form-title">Order Confirmation</div>

        <div className="ocd-row-2">
          <div className="field">
            <label>Date</label>
            <input type="text" value={doc.date} onChange={e => patch({ date: e.target.value })} placeholder="MM/DD/YY" />
          </div>
          <div className="field">
            <label>Number</label>
            <input type="text" value={doc.number} onChange={e => patch({ number: e.target.value })} placeholder="OC-2026-001" />
          </div>
        </div>

        {/* Buyer */}
        <div className="ocd-group-title">Buyer</div>
        <div className="field">
          <label>Company</label>
          <input value={doc.buyer?.company_name ?? ''} onChange={e => patchBuyer('company_name', e.target.value)} placeholder="Leaves Coffee" />
        </div>
        <div className="ocd-row-2">
          <div className="field">
            <label>Contact name (Attn)</label>
            <input value={doc.buyer?.contact_name ?? ''} onChange={e => patchBuyer('contact_name', e.target.value)} placeholder="Miho Haru" />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={doc.buyer?.email ?? ''} onChange={e => patchBuyer('email', e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Address</label>
          <input value={doc.buyer?.address ?? ''} onChange={e => patchBuyer('address', e.target.value)} placeholder="1-8-8 Honjo" />
        </div>
        <div className="ocd-row-3">
          <div className="field">
            <label>City</label>
            <input value={doc.buyer?.city ?? ''} onChange={e => patchBuyer('city', e.target.value)} placeholder="Sumida City, Tokyo" />
          </div>
          <div className="field">
            <label>Country</label>
            <input value={doc.buyer?.country ?? ''} onChange={e => patchBuyer('country', e.target.value)} placeholder="JAPAN" />
          </div>
          <div className="field">
            <label>Postal</label>
            <input value={doc.buyer?.postal_code ?? ''} onChange={e => patchBuyer('postal_code', e.target.value)} placeholder="1300004" />
          </div>
        </div>
        <div className="field">
          <label>Phone</label>
          <input value={doc.buyer?.phone ?? ''} onChange={e => patchBuyer('phone', e.target.value)} placeholder="81 3 5637 8718" />
        </div>

        {/* Seller */}
        <div className="ocd-group-title">Seller</div>
        <div className="field">
          <label>Name</label>
          <input value={doc.seller?.name ?? ''} onChange={e => patchSeller('name', e.target.value)} />
        </div>
        <div className="field">
          <label>Address</label>
          <input value={doc.seller?.address ?? ''} onChange={e => patchSeller('address', e.target.value)} />
        </div>
        <div className="ocd-row-2">
          <div className="field">
            <label>Phone</label>
            <input value={doc.seller?.phone ?? ''} onChange={e => patchSeller('phone', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={doc.seller?.email ?? ''} onChange={e => patchSeller('email', e.target.value)} />
          </div>
        </div>

        {/* Items */}
        <div className="ocd-group-title">
          Items
          <button className="ocd-add-item" onClick={addItem} type="button">+ Add lot</button>
        </div>
        {doc.items.map((item, idx) => (
          <div key={idx} className="ocd-item-row">
            {/* Fila superior: selector bache + description + programa */}
            <div className="ocd-item-bache-row">
              <div>
                <span className="ocd-item-bache-label">Bache (CFF)</span>
                {loadingBaches ? (
                  <div className="ocd-item-loading">Cargando baches…</div>
                ) : (
                  <select
                    className="ocd-item-bache-select"
                    value={item.bache_code ?? ''}
                    aria-label="Seleccionar bache"
                    onChange={e => {
                      const code = e.target.value
                      const bache = baches.find(b => b.code === code)
                      if (bache) {
                        const items = doc.items.map((it, i) => {
                          if (i !== idx) return it
                          return {
                            ...it,
                            bache_code: code,
                            description: `Lot. ${code} ${bache.variety}`,
                            quantity_kg: it.quantity_kg === 0 ? bache.kg_disp : it.quantity_kg,
                          }
                        })
                        onChange({ ...doc, items, total_usd: calcTotal(items) })
                      } else {
                        // Deseleccionó el bache
                        const items = doc.items.map((it, i) =>
                          i === idx ? { ...it, bache_code: undefined } : it
                        )
                        onChange({ ...doc, items })
                      }
                    }}
                  >
                    <option value="">— Seleccionar bache —</option>
                    {baches.map(b => (
                      <option key={b.code} value={b.code}>
                        {b.code} · {b.variety} · {b.kg_disp.toFixed(1)}kg{b.sca ? ` · SCA ${b.sca}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Description</label>
                <input
                  value={item.description}
                  onChange={e => patchItem(idx, 'description', e.target.value)}
                  placeholder="Lot. 06 Sidra"
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Programa</label>
                <select
                  value={item.program ?? ''}
                  aria-label="Seleccionar programa"
                  onChange={e => patchItem(idx, 'program', (e.target.value as OrderConfirmationItem['program']) || null)}
                >
                  <option value="">— Sin programa —</option>
                  <option value="pulse">Pulse</option>
                  <option value="beat">Beat</option>
                  <option value="connect">Connect</option>
                  <option value="amistad">La Amistad</option>
                </select>
              </div>
            </div>
            {/* Fila inferior: numéricos */}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kg</label>
              <input type="number" min={0} step={0.5} value={item.quantity_kg || ''} onChange={e => patchItem(idx, 'quantity_kg', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>$/LB</label>
              <input type="number" min={0} step={0.01} value={item.unit_price_per_lb_usd || ''} onChange={e => patchItem(idx, 'unit_price_per_lb_usd', parseFloat(e.target.value) || 0)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Total USD</label>
              <input type="number" min={0} step={0.01} value={item.total_usd || ''} onChange={e => patchItem(idx, 'total_usd', parseFloat(e.target.value) || 0)} />
            </div>
            {doc.items.length > 1 && (
              <button className="ocd-remove-item" onClick={() => removeItem(idx)} type="button" aria-label="Eliminar línea">×</button>
            )}
          </div>
        ))}

        {/* Logística */}
        <div className="ocd-group-title">Logistics</div>
        <div className="ocd-row-2">
          <div className="field">
            <label>Origin country</label>
            <input value={doc.origin_country} onChange={e => patch({ origin_country: e.target.value })} placeholder="COLOMBIA" />
          </div>
          <div className="field">
            <label>Destination country</label>
            <input value={doc.destination_country} onChange={e => patch({ destination_country: e.target.value })} placeholder="JAPAN" />
          </div>
        </div>
        <div className="field">
          <label>Preparation / Varietal</label>
          <input value={doc.preparation_varietal} onChange={e => patch({ preparation_varietal: e.target.value })} placeholder="EP WITH A 5% TOLERANCE…" />
        </div>
        <div className="ocd-row-2">
          <div className="field">
            <label>Moisture level</label>
            <input value={doc.moisture_level} onChange={e => patch({ moisture_level: e.target.value })} placeholder="10.5 - 11.5%" />
          </div>
          <div className="field">
            <label>Incoterm</label>
            <select value={doc.incoterm} onChange={e => patch({ incoterm: e.target.value as OrderConfirmation['incoterm'] })}>
              <option value="DAP">DAP</option>
              <option value="FOB">FOB</option>
              <option value="CIF">CIF</option>
              <option value="EXW">EXW</option>
            </select>
          </div>
        </div>
        <div className="ocd-row-2">
          <div className="field">
            <label>Shipping date</label>
            <input value={doc.shipping_date} onChange={e => patch({ shipping_date: e.target.value })} placeholder="JUNE" />
          </div>
          <div className="field">
            <label>Arrival date</label>
            <input value={doc.arrival_date} onChange={e => patch({ arrival_date: e.target.value })} placeholder="TBC" />
          </div>
        </div>
        <div className="field">
          <label>Payment terms</label>
          <input value={doc.payment_terms} onChange={e => patch({ payment_terms: e.target.value })} placeholder="CAD - 15 days" />
        </div>
        <div className="field">
          <label>Status</label>
          <select value={doc.status} onChange={e => patch({ status: e.target.value as OrderConfirmation['status'] })}>
            <option value="draft">Borrador</option>
            <option value="sent">Enviado</option>
            <option value="signed">Firmado</option>
            <option value="shipped">Despachado</option>
            <option value="completed">Completado</option>
          </select>
        </div>

        {saveError && (
          <div className="ocd-save-error" role="alert">
            {saveError}
          </div>
        )}
        <div className="ocd-actions">
          <button className="btn btn-secondary" type="button" onClick={onSaveDraft}>Guardar borrador</button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={saving}
            onClick={() => void handleGeneratePDF()}
            aria-label="Guardar en Supabase y descargar PDF"
          >
            {saving ? 'Guardando…' : 'Generar PDF'}
          </button>
        </div>

        {/* ── Firma del cliente ────────────────────────────────────────────── */}
        <SignatureSection
          documentType="order_confirmation"
          documentId={doc.buyer_id ? doc.id : undefined}
          documentLabel={doc.number}
          documentSummary={buildSummary(doc)}
          signerHint={{
            signer_name: doc.buyer?.contact_name,
            signer_email: doc.buyer?.email,
            signer_role: 'Buyer',
          }}
        />
      </div>

      {/* ── Preview derecha ── */}
      <div className="ocd-preview">
        <div className="ocd-preview-label">Vista previa del documento</div>
        <OrderConfirmationPreviewDoc doc={doc} />
      </div>
    </div>
  )
}

// ─── Constantes de programa ───────────────────────────────────────────────────

const PROGRAM_COLORS: Record<NonNullable<OrderConfirmationItem['program']>, string> = {
  pulse: '#FF7A8A',
  beat: '#FF1A6E',
  connect: '#8A7BC4',
  amistad: '#8A9863',
}

const PROGRAM_NAMES: Record<NonNullable<OrderConfirmationItem['program']>, string> = {
  pulse: 'Pulse',
  beat: 'Beat',
  connect: 'Connect',
  amistad: 'La Amistad',
}

// ─── Preview visual del documento — pixel-perfect según PNG referencia ────────

function OrderConfirmationPreviewDoc({ doc }: { doc: OrderConfirmation }) {
  const grandTotal = doc.total_usd > 0
    ? doc.total_usd
    : calcTotal(doc.items)

  // Partir preparation_varietal en líneas para el multiline indent
  const prepLines = doc.preparation_varietal
    ? doc.preparation_varietal.split('\n')
    : []

  return (
    <div className="ocd-doc">

      {/* ── 1. Banda negra superior ── */}
      <div className="ocd-doc-black-band">
        <span className="ocd-doc-black-band-text">
          Thank You for being at the heart of this journey
        </span>
      </div>

      {/* ── 2. Bloque de logo ── */}
      <div className="ocd-doc-logo-block">
        <div className="ocd-doc-logo-subtitle">
          <span>LA PALMA</span>
          <span className="ocd-doc-logo-amp">&amp;</span>
          <span>EL TUCÁN</span>
        </div>
        <div className="ocd-doc-logo-main">
          <span className="ocd-doc-logo-main-from">From</span>
          <span className="ocd-doc-logo-main-the">The</span>
          <span className="ocd-doc-logo-main-heart">heart</span>
        </div>
      </div>

      {/* ── 3. Título ── */}
      <div className="ocd-doc-title-block">
        <div className="ocd-doc-title-text">Order Confirmation</div>
        {doc.date && (
          <div className="ocd-doc-title-date">Date: {doc.date}</div>
        )}
      </div>

      {/* ── 4. Mensaje introductorio ── */}
      <div className="ocd-doc-intro">
        <p>This is to confirm that we are in receipt of you order.</p>
        <p>
          We hereby confirm acceptance and have reserved the nano-lots and
          pico-lots of green specialty coffee detailed below with terms and
          conditions agreed.
        </p>
      </div>

      {/* ── 5. Cajas Buyer / Seller — una sola caja fucsia, 2 columnas ── */}
      <div className="ocd-doc-parties-outer">
        {/* Buyer */}
        <div className="ocd-doc-party-col">
          <div className="ocd-doc-party-col-label">Buyer:</div>
          <div className="ocd-doc-party-col-lines">
            {doc.buyer?.company_name && <div>{doc.buyer.company_name}</div>}
            {doc.buyer?.contact_name && <div>Attn: {doc.buyer.contact_name}</div>}
            {doc.buyer?.address && <div>Address: {doc.buyer.address},</div>}
            {(doc.buyer?.city || doc.buyer?.country) && (
              <div>
                {[doc.buyer?.city, doc.buyer?.country].filter(Boolean).join(', ')}
              </div>
            )}
            {doc.buyer?.postal_code && <div>{doc.buyer.postal_code}</div>}
            {doc.buyer?.phone && <div>Phone: {doc.buyer.phone}</div>}
            {doc.buyer?.email && <div>Mail: {doc.buyer.email}</div>}
          </div>
        </div>

        {/* Seller */}
        <div className="ocd-doc-party-col">
          <div className="ocd-doc-party-col-label">Seller</div>
          <div className="ocd-doc-party-col-lines">
            {doc.seller?.name && <div>{doc.seller.name}</div>}
            {doc.seller?.address && <div>{doc.seller.address}</div>}
            {doc.seller?.phone && <div>I: {doc.seller.phone}</div>}
            {doc.seller?.email && <div>E: {doc.seller.email}</div>}
          </div>
        </div>
      </div>

      {/* ── 6. Tabla de items ── */}
      <div className="ocd-doc-table-wrapper">
        <table className="ocd-doc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Programa</th>
              <th>Quantity in Kg</th>
              <th>Unit price x LBS</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((it, i) => (
              <tr key={i}>
                <td>{it.description || '—'}</td>
                <td>
                  {it.program ? (
                    <span
                      className="ocd-doc-program-text"
                      style={{ color: PROGRAM_COLORS[it.program] }}
                    >
                      {PROGRAM_NAMES[it.program]}
                    </span>
                  ) : (
                    <span style={{ color: '#aaa' }}>—</span>
                  )}
                </td>
                <td className="ocd-doc-num">
                  {it.quantity_kg > 0 ? it.quantity_kg.toFixed(1) : '—'}
                </td>
                <td className="ocd-doc-num">
                  {it.unit_price_per_lb_usd > 0
                    ? `$${fmtUSD(it.unit_price_per_lb_usd)}`
                    : '—'}
                </td>
                <td className="ocd-doc-num">
                  {it.total_usd > 0 ? `$${fmtUSD(it.total_usd)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              {/* 3 celdas vacías blancas (Description + Programa + Kg) */}
              <td></td>
              <td></td>
              <td></td>
              {/* Celda "Total" con fondo fucsia */}
              <td className="ocd-doc-tfoot-label-cell">Total</td>
              {/* Valor total */}
              <td className="ocd-doc-num ocd-doc-grand-total-cell">
                ${fmtUSD(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── 7. Specs ── */}
      <div className="ocd-doc-specs">
        {doc.origin_country && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">ORIGIN</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.origin_country}</span>
          </div>
        )}

        {prepLines.length > 0 && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">PREPARATION VARIETAL</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-multiline">
              {prepLines.map((line, idx) =>
                idx === 0 ? (
                  <span key={idx} className="ocd-doc-spec-value">{line}</span>
                ) : (
                  <span key={idx} className="ocd-doc-spec-multiline-continuation">
                    {line}
                  </span>
                )
              )}
            </span>
          </div>
        )}

        {doc.moisture_level && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">MOISTURE LEVEL</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.moisture_level}</span>
          </div>
        )}
        {doc.shipping_date && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">SHIPPING DATE</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.shipping_date}</span>
          </div>
        )}
        {doc.arrival_date && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">ARRIVAL DATE</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.arrival_date}</span>
          </div>
        )}
        {doc.incoterm && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">INCOTERM</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.incoterm}</span>
          </div>
        )}
        {doc.payment_terms && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">PAYMENT</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.payment_terms}</span>
          </div>
        )}
        {doc.destination_country && (
          <div className="ocd-doc-spec-row">
            <span className="ocd-doc-spec-key">DESTINATION</span>
            <span className="ocd-doc-spec-colon">:</span>
            <span className="ocd-doc-spec-value">{doc.destination_country}</span>
          </div>
        )}
      </div>

    </div>
  )
}
