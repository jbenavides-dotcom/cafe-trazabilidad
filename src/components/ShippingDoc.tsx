import { useState, useEffect } from 'react'
import './ShippingDoc.css'
import type { ShippingInfo, ShippingParty, AirDocumentsChecklist, OrderConfirmation } from '../types/fichas'
import { ShippingDownloadButton } from './pdf/ShippingPDF'
import { getOrderConfirmations } from '../lib/fichas'

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  doc: ShippingInfo
  onChange: (updated: ShippingInfo) => void
  onSaveDraft: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

// ─── Componente ────────────────────────────────────────────────────────────────

export function ShippingDoc({ doc, onChange, onSaveDraft }: Props) {
  const [orderConfirmations, setOrderConfirmations] = useState<OrderConfirmation[]>([])

  useEffect(() => {
    void getOrderConfirmations().then(ocs => {
      // Filtrar el ejemplo hardcoded para no confundir al usuario
      setOrderConfirmations(ocs.filter(oc => oc.id !== 'example-leaves-coffee-2026'))
    })
  }, [])

  function patch(updates: Partial<ShippingInfo>) {
    onChange({ ...doc, ...updates })
  }

  function patchConsignee(field: keyof ShippingParty, value: string) {
    onChange({ ...doc, consignee: { ...doc.consignee, [field]: value } })
  }

  function patchNotify(field: keyof ShippingParty, value: string) {
    const notifyBase: ShippingParty = doc.notify ?? { name: '', address: '', phone: '', email: '' }
    onChange({ ...doc, notify: { ...notifyBase, [field]: value } })
  }

  function patchChecklist(field: keyof AirDocumentsChecklist, value: boolean) {
    const base: AirDocumentsChecklist = doc.documents_checklist ?? {
      invoice: false, packinglist: false, phytosanitary: false, cert_origin: false,
    }
    onChange({ ...doc, documents_checklist: { ...base, [field]: value } })
  }

  function handleLinkOC(confirmationId: string) {
    if (!confirmationId) {
      onChange({ ...doc, confirmation_id: undefined })
      return
    }
    const oc = orderConfirmations.find(o => o.id === confirmationId)
    if (!oc) return

    const addressParts = [oc.buyer?.address, oc.buyer?.city, oc.buyer?.postal_code].filter(
      (v): v is string => Boolean(v)
    )
    const consigneeAddress = addressParts.join(', ')

    const seaNotifyFields =
      doc.mode === 'sea'
        ? {
            notify: {
              name: oc.buyer?.contact_name ?? '',
              address: [oc.buyer?.address, oc.buyer?.city].filter(Boolean).join(', '),
              phone: oc.buyer?.phone ?? '',
              email: oc.buyer?.email ?? '',
            },
          }
        : {}

    onChange({
      ...doc,
      confirmation_id: confirmationId,
      buyer_ref: oc.number,
      consignee: {
        name: oc.buyer?.company_name ?? '',
        address: consigneeAddress,
        phone: oc.buyer?.phone ?? '',
        email: oc.buyer?.email ?? '',
        country: oc.buyer?.country ?? '',
      },
      ...seaNotifyFields,
    })
  }

  const isSea = doc.mode === 'sea'
  const modeLabel = isSea ? 'Shipping Information (Maritimo)' : 'Air Shipping Information (Aereo)'

  return (
    <div className="sd-split">
      {/* ── Formulario ── */}
      <div className="sd-form">
        <div className="sd-form-title">{modeLabel}</div>

        {/* ── Vincular a Order Confirmation ── */}
        <div className="sd-link-oc">
          <label htmlFor="sd-oc-select">Vincular a OC</label>
          <select
            id="sd-oc-select"
            value={doc.confirmation_id ?? ''}
            onChange={e => handleLinkOC(e.target.value)}
            aria-label="Vincular a Order Confirmation existente"
          >
            <option value="">— Sin vincular —</option>
            {orderConfirmations.map(oc => (
              <option key={oc.id} value={oc.id}>
                {oc.number} · {oc.buyer?.company_name || 'Sin nombre'} · {oc.destination_country}
              </option>
            ))}
          </select>
          {doc.confirmation_id && (
            <button
              type="button"
              className="btn-link"
              onClick={() => handleLinkOC('')}
              aria-label="Desvincular Order Confirmation"
            >
              Desvincular
            </button>
          )}
        </div>

        {/* Date siempre visible. Contract number solo en sea */}
        {isSea ? (
          <div className="sd-row-2">
            <FieldInput label="Date" value={doc.date} onChange={v => patch({ date: v })} placeholder="MM/DD/YY" />
            <FieldInput label="Contract number" value={doc.contract_number} onChange={v => patch({ contract_number: v })} placeholder="SC-2026-001" />
          </div>
        ) : (
          <FieldInput label="Date" value={doc.date} onChange={v => patch({ date: v })} placeholder="MM/DD/YY" />
        )}

        {isSea ? (
          /* ── FORMULARIO MARITIMO ── */
          <>
            <div className="sd-row-2">
              <FieldInput label="Buyer ref" value={doc.buyer_ref} onChange={v => patch({ buyer_ref: v })} />
              <FieldInput label="Seller ref" value={doc.seller_ref} onChange={v => patch({ seller_ref: v })} />
            </div>
            <FieldInput label="Shipment line" value={doc.shipment_line ?? ''} onChange={v => patch({ shipment_line: v })} placeholder="Ej. Hapag-Lloyd" />
            <div className="sd-row-2">
              <FieldInput label="Loading port" value={doc.loading_port ?? ''} onChange={v => patch({ loading_port: v })} placeholder="Cartagena, Colombia" />
              <FieldInput label="Destination port" value={doc.destination_port ?? ''} onChange={v => patch({ destination_port: v })} placeholder="Tokyo, Japan" />
            </div>

            <div className="sd-group-title">Documents required</div>
            <div className="field">
              <label>Description (libre)</label>
              <textarea
                rows={3}
                value={doc.documents_required_text ?? ''}
                onChange={e => patch({ documents_required_text: e.target.value })}
                placeholder="Original Bill of Lading x3, Commercial Invoice x3..."
                style={{ resize: 'vertical', padding: '0.6rem 0.8rem', border: '1px solid var(--color-gray-medium)', borderRadius: 'var(--radius-md)' }}
              />
            </div>

            <div className="sd-group-title">Consignee</div>
            <FieldInput label="Name" value={doc.consignee.name} onChange={v => patchConsignee('name', v)} />
            <FieldInput label="Address" value={doc.consignee.address} onChange={v => patchConsignee('address', v)} />
            <div className="sd-row-2">
              <FieldInput label="Country" value={doc.consignee.country ?? ''} onChange={v => patchConsignee('country', v)} />
              <FieldInput label="Phone" value={doc.consignee.phone} onChange={v => patchConsignee('phone', v)} />
            </div>
            <FieldInput label="Email" type="email" value={doc.consignee.email} onChange={v => patchConsignee('email', v)} />

            <div className="sd-group-title">Notify party</div>
            <FieldInput label="Name" value={doc.notify?.name ?? ''} onChange={v => patchNotify('name', v)} />
            <FieldInput label="Address" value={doc.notify?.address ?? ''} onChange={v => patchNotify('address', v)} />
            <div className="sd-row-2">
              <FieldInput label="Phone" value={doc.notify?.phone ?? ''} onChange={v => patchNotify('phone', v)} />
              <FieldInput label="Email" type="email" value={doc.notify?.email ?? ''} onChange={v => patchNotify('email', v)} />
            </div>
          </>
        ) : (
          /* ── FORMULARIO AEREO ── */
          <>
            <FieldInput label="Contact person" value={doc.contact_person ?? ''} onChange={v => patch({ contact_person: v })} />
            <div className="sd-row-2">
              <FieldInput label="Buyer ref" value={doc.buyer_ref} onChange={v => patch({ buyer_ref: v })} />
              <FieldInput label="Seller ref" value={doc.seller_ref} onChange={v => patch({ seller_ref: v })} />
            </div>

            <div className="sd-group-title">Consignee</div>
            <FieldInput label="Name" value={doc.consignee.name} onChange={v => patchConsignee('name', v)} />
            <div className="sd-row-2">
              <FieldInput label="Address" value={doc.consignee.address} onChange={v => patchConsignee('address', v)} />
              <FieldInput label="Country" value={doc.consignee.country ?? ''} onChange={v => patchConsignee('country', v)} />
            </div>
            <div className="sd-row-2">
              <FieldInput label="Phone" value={doc.consignee.phone} onChange={v => patchConsignee('phone', v)} />
              <FieldInput label="Email" type="email" value={doc.consignee.email} onChange={v => patchConsignee('email', v)} />
            </div>

            <div className="sd-group-title">Documents required</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {(
                [
                  { key: 'invoice', label: 'Invoice' },
                  { key: 'packinglist', label: 'Packing List' },
                  { key: 'phytosanitary', label: 'Phytosanitary Certificate' },
                  { key: 'cert_origin', label: 'Certificate of Origin' },
                ] as { key: keyof AirDocumentsChecklist; label: string }[]
              ).map(({ key, label }) => {
                const currentVal = doc.documents_checklist?.[key] ?? null
                return (
                  <div key={key} className="sd-air-check-row">
                    <span>{label}</span>
                    <div className="sd-yes-no-group">
                      <button
                        type="button"
                        className={`sd-yes-no-btn${currentVal === true ? ' selected-yes' : ''}`}
                        onClick={() => patchChecklist(key, true)}
                        aria-label={`${label} - Yes`}
                      >
                        YES
                      </button>
                      <button
                        type="button"
                        className={`sd-yes-no-btn${currentVal === false && doc.documents_checklist !== undefined ? ' selected-no' : ''}`}
                        onClick={() => patchChecklist(key, false)}
                        aria-label={`${label} - No`}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="sd-group-title">
          {isSea ? 'Special requirements' : 'Special Documents / Requirements / Other Instructions'}
        </div>
        <div className="field">
          <label>Instructions / Notes</label>
          <textarea
            rows={4}
            value={doc.special_requirements}
            onChange={e => patch({ special_requirements: e.target.value })}
            placeholder={isSea ? 'Other instructions, special requirements...' : 'Special documents, other instructions...'}
            style={{ resize: 'vertical', padding: '0.6rem 0.8rem', border: '1px solid var(--color-gray-medium)', borderRadius: 'var(--radius-md)' }}
          />
        </div>

        <div className="sd-actions">
          <button className="btn btn-secondary" type="button" onClick={onSaveDraft}>Guardar borrador</button>
          <ShippingDownloadButton doc={doc} className="btn btn-primary" />
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="sd-preview">
        <div className="sd-preview-label">Vista previa del documento</div>
        <ShippingPreviewDoc doc={doc} />
      </div>
    </div>
  )
}

// ─── Preview visual pixel-perfect segun PDF original ─────────────────────────

const AIR_DOCS: { key: keyof AirDocumentsChecklist; label: string }[] = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'packinglist', label: 'Packinglist' },
  { key: 'phytosanitary', label: 'Phytosanitary Certificate' },
  { key: 'cert_origin', label: 'Certificate of origin' },
]

function ShippingPreviewDoc({ doc }: { doc: ShippingInfo }) {
  const isSea = doc.mode === 'sea'
  const checklist = doc.documents_checklist

  // Renderiza lineas rosadas para texto libre
  function TextLines({ text, count = 4 }: { text?: string; count?: number }) {
    const lines = (text ?? '').split('\n')
    const padded = Array.from({ length: count }, (_, i) => lines[i] ?? '')
    return (
      <div className="sd-doc-text-lines">
        {padded.map((line, i) => (
          <div key={i} className="sd-doc-text-line">{line || ' '}</div>
        ))}
      </div>
    )
  }

  function PartyCol({ title: colTitle, party }: { title: string; party: Partial<ShippingParty> }) {
    return (
      <div className="sd-doc-party-col">
        <div className="sd-doc-party-col-label">{colTitle}</div>
        <div className="sd-doc-party-field-row">
          <span className="sd-doc-party-field-label">Name</span>
          <span className="sd-doc-party-field-box">{party.name || ' '}</span>
        </div>
        <div className="sd-doc-party-field-row">
          <span className="sd-doc-party-field-label">Address</span>
          <span className="sd-doc-party-field-box">{party.address || ' '}</span>
        </div>
        <div className="sd-doc-party-field-row">
          <span className="sd-doc-party-field-label">Phone</span>
          <span className="sd-doc-party-field-box">{party.phone || ' '}</span>
        </div>
        <div className="sd-doc-party-field-row">
          <span className="sd-doc-party-field-label">Email</span>
          <span className="sd-doc-party-field-box">{party.email || ' '}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-doc">

      {/* ── MITAD SUPERIOR FUCSIA ── */}
      <div className="sd-doc-top">

        {/* Date arriba-izquierda */}
        <div className="sd-doc-date-row">
          <span className="sd-doc-field-label-white">Date</span>
          <span className="sd-doc-field-box-white">{doc.date || ' '}</span>
        </div>

        {isSea ? (
          /* SEA: titulo 1 linea + Contract Number S/C */
          <div className="sd-doc-title-block">
            <div className="sd-doc-title-text">Shipping Information</div>
            <div className="sd-doc-contract-row">
              Contract Number S/C: {doc.contract_number || '____________'}
            </div>
          </div>
        ) : (
          /* AIR: titulo en 2 lineas separadas */
          <div className="sd-doc-title-block">
            <div className="sd-doc-title-air">
              <span className="sd-doc-title-air-line1">Air Shipping</span>
              <span className="sd-doc-title-air-line2">Information</span>
            </div>
          </div>
        )}

        {/* Contact Person solo air con underline larga */}
        {!isSea && (
          <div className="sd-doc-contact-person">
            <span className="sd-doc-contact-person-label">Contact Person</span>
            <span className="sd-doc-contact-person-line">{doc.contact_person || ''}</span>
          </div>
        )}

        {/* Buyer Ref */}
        <div className="sd-doc-top-field-row">
          <span className="sd-doc-field-label-white">Buyer Ref</span>
          <span className="sd-doc-field-box-white">{doc.buyer_ref || ' '}</span>
        </div>

        {/* Seller Ref */}
        <div className="sd-doc-top-field-row">
          <span className="sd-doc-field-label-white">Seller Ref</span>
          <span className="sd-doc-field-box-white">{doc.seller_ref || ' '}</span>
        </div>

        {isSea ? (
          /* SEA: Shipment Line + Loading/Destination ports */
          <>
            <div className="sd-doc-top-field-row">
              <span className="sd-doc-field-label-white">Shipment Line</span>
              <span className="sd-doc-field-box-white">{doc.shipment_line || ' '}</span>
            </div>
            <div className="sd-doc-top-ports-row">
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Loading Port</span>
                <span className="sd-doc-field-box-white">{doc.loading_port || ' '}</span>
              </div>
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Destination Port</span>
                <span className="sd-doc-field-box-white">{doc.destination_port || ' '}</span>
              </div>
            </div>
          </>
        ) : (
          /* AIR: Consignee Name + Address/Country + Phone/Email en la parte superior */
          <>
            <div className="sd-doc-top-field-row">
              <span className="sd-doc-field-label-white">Consignee</span>
              <span className="sd-doc-field-box-white">{doc.consignee.name || ' '}</span>
            </div>
            <div className="sd-doc-top-ports-row">
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Address</span>
                <span className="sd-doc-field-box-white">{doc.consignee.address || ' '}</span>
              </div>
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Country</span>
                <span className="sd-doc-field-box-white">{doc.consignee.country || ' '}</span>
              </div>
            </div>
            <div className="sd-doc-top-ports-row">
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Phone</span>
                <span className="sd-doc-field-box-white">{doc.consignee.phone || ' '}</span>
              </div>
              <div className="sd-doc-top-field-row sd-doc-top-port-item">
                <span className="sd-doc-field-label-white">Email</span>
                <span className="sd-doc-field-box-white">{doc.consignee.email || ' '}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── MITAD INFERIOR CREMA ── */}
      <div className="sd-doc-bottom">

        {/* Documents required */}
        <div className="sd-doc-section-label-pink">Documents required:</div>

        {isSea ? (
          <TextLines text={doc.documents_required_text} count={4} />
        ) : (
          /* AIR: tabla 3 columnas con checkboxes Yes / No */
          <table className="sd-doc-docs-table">
            <thead>
              <tr>
                <th>Documents required</th>
                <th>Yes</th>
                <th>No</th>
              </tr>
            </thead>
            <tbody>
              {AIR_DOCS.map(({ key, label }, idx) => {
                const isYes = checklist?.[key] === true
                const isNo = checklist !== undefined && checklist[key] === false
                const rowClass = idx % 2 === 0 ? 'sd-doc-docs-row-medium' : 'sd-doc-docs-row-light'
                return (
                  <tr key={key} className={rowClass}>
                    <td>{label}</td>
                    <td>
                      <span className={`sd-doc-docs-checkbox${isYes ? ' sd-doc-docs-checkbox-checked' : ''}`}>
                        {isYes ? '✓' : ''}
                      </span>
                    </td>
                    <td>
                      <span className={`sd-doc-docs-checkbox${isNo ? ' sd-doc-docs-checkbox-checked' : ''}`}>
                        {isNo ? '✓' : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Consignee + Notify: sea 2 cols, air omitido (ya esta en top) */}
        {isSea && (
          <div className="sd-doc-parties-row">
            <PartyCol title="Consignee" party={doc.consignee} />
            <PartyCol
              title="Notify"
              party={doc.notify ?? { name: '', address: '', phone: '', email: '' }}
            />
          </div>
        )}

        {/* Special Requirements */}
        <div className="sd-doc-section-label-pink">
          {isSea ? 'Special Requirements:' : 'Special Documents/ Requirements/ Other Instructions:'}
        </div>
        <TextLines text={doc.special_requirements} count={4} />

      </div>

      {/* ── FOOTER ── */}
      <div className="sd-doc-footer-logo">
        <div className="sd-doc-footer-subtitle">LA PALMA &amp; EL TUCAN</div>
        <div className="sd-doc-footer-main">
          <span className="sd-doc-footer-from">From</span>
          <span className="sd-doc-footer-the">The</span>
          <span className="sd-doc-footer-heart">heart</span>
        </div>
      </div>

    </div>
  )
}
