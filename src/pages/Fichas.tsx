import { useEffect, useState, useCallback } from 'react'
import {
  FileText,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Trash2,
  Ship,
  PlaneTakeoff,
  FilePlus,
  AlertCircle,
  MapPin,
} from 'lucide-react'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import {
  PROGRAM_TEMPLATES,
  getProgramTemplates,
  getOfferings,
  saveOffering,
  getOrderConfirmations,
  saveOrderConfirmation,
  deleteOrderConfirmation,
  getShippings,
  saveShipping,
  deleteShipping,
  getTrips,
  saveTrip,
  deleteTrip,
  newTripToOrigin,
  migrateLocalStorageToSupabase,
  LEAVES_COFFEE_EXAMPLE,
  newOrderConfirmation,
  newShippingInfo,
} from '../lib/fichas'
import type {
  Offering,
  OfferingRecipient,
  OfferingSample,
  ProgramTemplate,
  OrderConfirmation,
  ShippingInfo,
  TripToOrigin,
} from '../types/fichas'
import { OfferingPreview } from '../components/OfferingPreview'
import { OfferingDownloadButton } from '../components/pdf/OfferingPDF'
import { OrderConfirmationDoc } from '../components/OrderConfirmationDoc'
import { ShippingDoc } from '../components/ShippingDoc'
import { TripToOriginDoc } from '../components/TripToOriginDoc'
import './Fichas.css'

type TabId = 'plantillas' | 'offerings' | 'embudo' | 'documentos'

const FUNNEL_STAGES: OfferingRecipient['funnel_stage'][] = [
  'queued',
  'sent',
  'opened',
  'viewed',
  'responded',
  'negotiating',
  'won',
  'lost',
]

const STAGE_LABELS: Record<OfferingRecipient['funnel_stage'], string> = {
  queued: 'Queued',
  sent: 'Sent',
  opened: 'Opened',
  viewed: 'Viewed',
  responded: 'Responded',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
}

// ─── Bache tipo local (fuente: CFF + AF + AS del Sheet 2026) ──────────────────
interface BacheRow {
  code: string
  fecha: string
  proveedor: string
  variedad: string
  proceso: string
  kg: number
  sca: string
  perfil?: string
  notas?: string
}

// ─── Recipient form row ────────────────────────────────────────────────────────
interface RecipientDraft {
  id: string
  email: string
  name: string
  company: string
  country: string
}

function emptyRecipient(): RecipientDraft {
  return { id: crypto.randomUUID(), email: '', name: '', company: '', country: '' }
}

// ─── Wizard state ──────────────────────────────────────────────────────────────
interface WizardState {
  step: 1 | 2 | 3
  template: ProgramTemplate['code'] | null
  title: string
  cover_message: string
  selectedCodes: string[]
  recipients: RecipientDraft[]
  loadingBaches: boolean
  baches: BacheRow[]
  loadError: string | null
  validationError: string | null
  createdOffering: Offering | null
}

function initWizard(): WizardState {
  return {
    step: 1,
    template: null,
    title: '',
    cover_message: '',
    selectedCodes: [],
    recipients: [emptyRecipient()],
    loadingBaches: false,
    baches: [],
    loadError: null,
    validationError: null,
    createdOffering: null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(dateStr: string): number {
  const ms = Date.now() - new Date(dateStr).getTime()
  return Math.floor(ms / 86_400_000)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

function statusLabel(status: Offering['status']): string {
  const map: Record<Offering['status'], string> = {
    draft: 'Borrador',
    sent: 'Enviado',
    viewed: 'Visto',
    responded: 'Respondido',
    expired: 'Expirado',
  }
  return map[status]
}

// ─── Banner de estado Supabase ────────────────────────────────────────────────
function SupabaseBanner({ migratedCount }: { migratedCount: number | null }) {
  if (migratedCount === null) return null
  if (migratedCount > 0) {
    return (
      <div className="ft-supabase-banner ft-supabase-banner--ok">
        <CheckCircle2 size={14} />
        {migratedCount} offering(s) migrado(s) a Supabase desde localStorage.
      </div>
    )
  }
  return null
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Fichas() {
  const [activeTab, setActiveTab] = useState<TabId>('plantillas')
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [selectedOffering, setSelectedOffering] = useState<Offering | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [templates, setTemplates] = useState<ProgramTemplate[]>(PROGRAM_TEMPLATES)
  const [migratedCount, setMigratedCount] = useState<number | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  // Carga inicial: templates + offerings + migración automática
  useEffect(() => {
    async function init() {
      setLoadingData(true)
      try {
        const [tpls, ofs, migrated] = await Promise.all([
          getProgramTemplates(),
          getOfferings(),
          migrateLocalStorageToSupabase(),
        ])
        setTemplates(tpls)
        // Si hubo migración, recargar offerings (ahora vienen de Supabase)
        if (migrated > 0) {
          const freshOfs = await getOfferings()
          setOfferings(freshOfs)
          setMigratedCount(migrated)
        } else {
          setOfferings(ofs)
        }
      } finally {
        setLoadingData(false)
      }
    }
    void init()
  }, [])

  const handleOfferingSaved = useCallback(async (o: Offering) => {
    await saveOffering(o)
    const updated = await getOfferings()
    setOfferings(updated)
  }, [])

  return (
    <div className="fichas">
      <div className="ft-header">
        <div>
          <h1><FileText size={26} /> Fichas técnicas</h1>
          <p className="ft-subtitle">Programas de café · Offerings · Embudo de ventas · Documentos comerciales</p>
        </div>
      </div>

      <SupabaseBanner migratedCount={migratedCount} />

      <div className="ft-tabs">
        {([
          { id: 'plantillas' as TabId, label: 'Plantillas' },
          { id: 'offerings' as TabId, label: `Offerings (${offerings.length})` },
          { id: 'embudo' as TabId, label: 'Embudo' },
          { id: 'documentos' as TabId, label: 'Documentos' },
        ] as const).map(({ id, label }) => (
          <button
            key={id}
            className={`ft-tab${activeTab === id ? ' active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loadingData && (
        <div className="ft-loading">
          <Loader2 className="spin" size={24} />
          <span>Cargando datos…</span>
        </div>
      )}

      {!loadingData && activeTab === 'plantillas' && (
        <TabPlantillas templates={templates} />
      )}

      {!loadingData && activeTab === 'offerings' && (
        <TabOfferings
          offerings={offerings}
          templates={templates}
          onNuevo={() => setShowWizard(true)}
          onSelect={setSelectedOffering}
        />
      )}

      {!loadingData && activeTab === 'embudo' && (
        <TabEmbudo offerings={offerings} templates={templates} />
      )}

      {!loadingData && activeTab === 'documentos' && <TabDocumentos />}

      {selectedOffering && (
        <OfferingDetail
          offering={selectedOffering}
          templates={templates}
          onClose={() => setSelectedOffering(null)}
        />
      )}

      {showWizard && (
        <WizardNuevoOffering
          templates={templates}
          onClose={() => setShowWizard(false)}
          onSave={async (o) => {
            await handleOfferingSaved(o)
            setShowWizard(false)
            setActiveTab('offerings')
          }}
        />
      )}
    </div>
  )
}

// ─── Tab 1: Plantillas ─────────────────────────────────────────────────────────
function TabPlantillas({ templates }: { templates: ProgramTemplate[] }) {
  return (
    <div className="ft-plantillas-grid">
      {templates.map(t => (
        <div
          key={t.code}
          className="ft-plantilla-card"
          style={{ borderLeftColor: t.color_hex }}
        >
          <div className="ft-plantilla-name" style={{ color: t.color_hex }}>
            {t.name}
          </div>
          <div className="ft-plantilla-tagline">{t.tagline}</div>
          <div className="ft-plantilla-desc">{t.description_long}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Tab 2: Offerings ──────────────────────────────────────────────────────────
function TabOfferings({
  offerings,
  templates,
  onNuevo,
  onSelect,
}: {
  offerings: Offering[]
  templates: ProgramTemplate[]
  onNuevo: () => void
  onSelect: (o: Offering) => void
}) {
  return (
    <>
      <div className="ft-offerings-header">
        <button className="btn btn-primary" onClick={onNuevo}>
          <Plus size={16} /> Nuevo offering
        </button>
      </div>

      {offerings.length === 0 ? (
        <div className="ft-offerings-empty card">
          No hay offerings creados. Haz clic en "+ Nuevo offering" para comenzar.
        </div>
      ) : (
        <table className="ft-offerings-table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Plantilla</th>
              <th>Muestras</th>
              <th>Status</th>
              <th>Creado</th>
              <th>Destinatarios</th>
            </tr>
          </thead>
          <tbody>
            {offerings.map(o => {
              const tpl = templates.find(t => t.code === o.template_code)
              return (
                <tr key={o.id} onClick={() => onSelect(o)}>
                  <td>{o.title}</td>
                  <td>
                    {tpl && (
                      <span
                        className="ft-template-badge"
                        style={{ backgroundColor: tpl.color_hex }}
                      >
                        {tpl.name}
                      </span>
                    )}
                  </td>
                  <td>{o.samples.length}</td>
                  <td>
                    <span className={`ft-status-badge ft-status-${o.status}`}>
                      {statusLabel(o.status)}
                    </span>
                  </td>
                  <td>{formatDate(o.created_at)}</td>
                  <td>{o.recipients.length}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}

// ─── Offering detail panel ─────────────────────────────────────────────────────
function OfferingDetail({
  offering,
  templates,
  onClose,
}: {
  offering: Offering
  templates: ProgramTemplate[]
  onClose: () => void
}) {
  const tpl = templates.find(t => t.code === offering.template_code)
  const shareLink = `${window.location.origin}/offering/${offering.access_token}`

  return (
    <div className="ft-detail-overlay" onClick={onClose}>
      <div className="ft-detail-panel ft-detail-split" onClick={e => e.stopPropagation()}>
        <button className="ft-detail-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className="ft-detail-left">
          <h2>{offering.title}</h2>

          <div className="ft-detail-meta">
            {tpl && (
              <span
                className="ft-template-badge"
                style={{ backgroundColor: tpl.color_hex }}
              >
                {tpl.name}
              </span>
            )}
            <span className={`ft-status-badge ft-status-${offering.status}`}>
              {statusLabel(offering.status)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-gray-medium)' }}>
              Creado {formatDate(offering.created_at)}
            </span>
          </div>

          {offering.cover_message && (
            <div className="ft-detail-message">{offering.cover_message}</div>
          )}

          <div className="ft-detail-section-title">
            Destinatarios ({offering.recipients.length})
          </div>
          <table className="ft-recipients-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>País</th>
                <th>Stage</th>
                <th>Vistas</th>
              </tr>
            </thead>
            <tbody>
              {offering.recipients.map(r => (
                <tr key={r.email}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-gray-medium)' }}>{r.email}</div>
                  </td>
                  <td>{r.company ?? '—'}</td>
                  <td>{r.country ?? '—'}</td>
                  <td>
                    <span className="ft-status-badge" style={{ fontSize: '0.68rem' }}>
                      {STAGE_LABELS[r.funnel_stage]}
                    </span>
                  </td>
                  <td>
                    <span className={`ft-tracking-pill${r.view_count > 0 ? ' views-gt0' : ''}`}>
                      {r.view_count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ft-detail-link">
            <strong>Link a compartir:</strong> {shareLink}
          </div>

          <div style={{ marginTop: '1rem' }}>
            <OfferingDownloadButton
              offering={offering}
              className="btn btn-primary"
            >
              Generar PDF
            </OfferingDownloadButton>
          </div>
        </div>

        <div className="ft-detail-right">
          <OfferingPreview
            templateCode={offering.template_code}
            title={offering.title}
            coverMessage={offering.cover_message}
            samples={offering.samples}
            recipients={offering.recipients.map(r => ({
              name: r.name,
              email: r.email,
              company: r.company,
              country: r.country,
            }))}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Tab 3: Embudo ─────────────────────────────────────────────────────────────
function TabEmbudo({
  offerings,
  templates,
}: {
  offerings: Offering[]
  templates: ProgramTemplate[]
}) {
  const allRecipients = offerings.flatMap(o =>
    o.recipients.map(r => ({ offering: o, recipient: r }))
  )

  if (allRecipients.length === 0) {
    return (
      <div className="ft-kanban-empty card">
        No hay destinatarios en ningún offering. Crea un offering con destinatarios para ver el embudo.
      </div>
    )
  }

  return (
    <div className="ft-kanban">
      <div className="ft-kanban-board">
        {FUNNEL_STAGES.map(stage => {
          const cards = allRecipients.filter(x => x.recipient.funnel_stage === stage)
          return (
            <div key={stage} className="ft-kanban-col">
              <div className={`ft-kanban-col-header ft-col-${stage}`}>
                <span>{STAGE_LABELS[stage]}</span>
                <span>{cards.length}</span>
              </div>
              <div className="ft-kanban-col-cards">
                {cards.length === 0 ? (
                  <div className="ft-kanban-empty-col">—</div>
                ) : (
                  cards.map(({ offering, recipient }) => {
                    const tpl = templates.find(t => t.code === offering.template_code)
                    const days = daysAgo(offering.created_at)
                    return (
                      <div
                        key={`${offering.id}-${recipient.email}`}
                        className="ft-kanban-card"
                        style={{ borderLeftColor: tpl?.color_hex ?? 'var(--color-tan)' }}
                      >
                        <div className="ft-kanban-card-name">{recipient.name}</div>
                        {recipient.company && (
                          <div className="ft-kanban-card-company">{recipient.company}</div>
                        )}
                        <div className="ft-kanban-card-offering">{offering.title}</div>
                        <div className="ft-kanban-card-days">
                          {days === 0 ? 'Hoy' : `${days}d en este stage`}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab 4: Documentos comerciales ────────────────────────────────────────────

type DocSubTab = 'orders' | 'sea' | 'air' | 'trips'

function TabDocumentos() {
  const [subTab, setSubTab] = useState<DocSubTab>('orders')
  const [orders, setOrders] = useState<OrderConfirmation[]>([])
  const [shippings, setShippings] = useState<ShippingInfo[]>([])
  const [trips, setTrips] = useState<TripToOrigin[]>([])
  const [activeOrderId, setActiveOrderId] = useState<string>('')
  const [activeShippingId, setActiveShippingId] = useState<string | null>(null)
  const [activeTripId, setActiveTripId] = useState<string | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [supabaseWarning, setSupabaseWarning] = useState(false)

  useEffect(() => {
    async function loadDocs() {
      setLoadingDocs(true)
      try {
        const [ords, ships, trps] = await Promise.all([
          getOrderConfirmations(),
          getShippings(),
          getTrips(),
        ])
        setOrders(ords)
        setShippings(ships)
        setTrips(trps)
        setActiveOrderId(ords[0]?.id ?? '')
      } catch {
        setSupabaseWarning(true)
      } finally {
        setLoadingDocs(false)
      }
    }
    void loadDocs()
  }, [])

  const activeOrder = orders.find(o => o.id === activeOrderId) ?? null
  const seaDocs = shippings.filter(s => s.mode === 'sea')
  const airDocs = shippings.filter(s => s.mode === 'air')
  const activeShippings = subTab === 'sea' ? seaDocs : airDocs
  const activeShipping = activeShippings.find(s => s.id === activeShippingId) ?? null
  const activeTrip = trips.find(t => t.id === activeTripId) ?? null

  function handleOrderChange(updated: OrderConfirmation) {
    setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
  }

  async function handleOrderSave() {
    if (!activeOrder) return
    await saveOrderConfirmation(activeOrder)
    alert('Borrador guardado.')
  }

  async function handleNewOrder() {
    const doc = newOrderConfirmation()
    await saveOrderConfirmation(doc)
    const updated = await getOrderConfirmations()
    setOrders(updated)
    setActiveOrderId(doc.id)
  }

  async function handleDeleteOrder(id: string) {
    if (id === LEAVES_COFFEE_EXAMPLE.id) {
      alert('El ejemplo precargado no se puede eliminar.')
      return
    }
    if (!window.confirm('¿Eliminar este documento?')) return
    await deleteOrderConfirmation(id)
    const updated = await getOrderConfirmations()
    setOrders(updated)
    setActiveOrderId(updated[0]?.id ?? '')
  }

  function handleShippingChange(updated: ShippingInfo) {
    setShippings(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  async function handleShippingSave() {
    if (!activeShipping) return
    await saveShipping(activeShipping)
    alert('Borrador guardado.')
  }


  async function handleNewShipping(mode: 'sea' | 'air') {
    const doc = newShippingInfo(mode)
    await saveShipping(doc)
    const updated = await getShippings()
    setShippings(updated)
    setActiveShippingId(doc.id)
  }

  async function handleDeleteShipping(id: string) {
    if (!window.confirm('¿Eliminar este documento?')) return
    await deleteShipping(id)
    const updated = await getShippings()
    setShippings(updated)
    setActiveShippingId(null)
  }

  function handleTripChange(updated: TripToOrigin) {
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  async function handleTripSave() {
    if (!activeTrip) return
    await saveTrip(activeTrip)
    alert('Borrador guardado.')
  }

  async function handleNewTrip() {
    const doc = newTripToOrigin()
    await saveTrip(doc)
    const updated = await getTrips()
    setTrips(updated)
    setActiveTripId(doc.id)
  }

  async function handleDeleteTrip(id: string) {
    if (!window.confirm('¿Eliminar este itinerario?')) return
    await deleteTrip(id)
    const updated = await getTrips()
    setTrips(updated)
    setActiveTripId(null)
  }

  if (loadingDocs) {
    return (
      <div className="ft-loading">
        <Loader2 className="spin" size={24} />
        <span>Cargando documentos…</span>
      </div>
    )
  }

  return (
    <div className="ft-docs">
      {supabaseWarning && (
        <div className="ft-supabase-banner ft-supabase-banner--warn">
          <AlertCircle size={14} />
          Supabase no disponible — mostrando datos locales. Ejecuta el SQL para conectar.
        </div>
      )}

      {/* Sub-tabs */}
      <div className="ft-docs-subtabs">
        <button
          className={`ft-docs-subtab${subTab === 'orders' ? ' active' : ''}`}
          onClick={() => setSubTab('orders')}
        >
          <FilePlus size={14} /> Order Confirmation
        </button>
        <button
          className={`ft-docs-subtab${subTab === 'sea' ? ' active' : ''}`}
          onClick={() => setSubTab('sea')}
        >
          <Ship size={14} /> Shipping (Marítimo)
        </button>
        <button
          className={`ft-docs-subtab${subTab === 'air' ? ' active' : ''}`}
          onClick={() => setSubTab('air')}
        >
          <PlaneTakeoff size={14} /> Shipping (Aéreo)
        </button>
        <button
          className={`ft-docs-subtab${subTab === 'trips' ? ' active' : ''}`}
          onClick={() => setSubTab('trips')}
        >
          <MapPin size={14} /> Trip to Origin
        </button>
      </div>

      {/* Order Confirmations */}
      {subTab === 'orders' && (
        <div className="ft-docs-section">
          <div className="ft-docs-sidebar">
            <button className="btn btn-primary ft-docs-new-btn" onClick={() => void handleNewOrder()}>
              <Plus size={14} /> Nuevo
            </button>
            <div className="ft-docs-list">
              {orders.map(o => (
                <div
                  key={o.id}
                  className={`ft-docs-list-item${o.id === activeOrderId ? ' active' : ''}`}
                  onClick={() => setActiveOrderId(o.id)}
                >
                  <div className="ft-docs-list-title">
                    {o.buyer?.company_name || 'Sin nombre'}
                  </div>
                  <div className="ft-docs-list-meta">
                    {o.number || '—'} · {o.date}
                  </div>
                  <div className="ft-docs-list-status">
                    <span className={`ft-status-badge ft-status-${o.status}`}>
                      {o.status}
                    </span>
                    {o.id !== LEAVES_COFFEE_EXAMPLE.id && (
                      <button
                        className="ft-docs-list-delete"
                        onClick={e => { e.stopPropagation(); void handleDeleteOrder(o.id) }}
                        aria-label="Eliminar"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ft-docs-main">
            {activeOrder ? (
              <OrderConfirmationDoc
                doc={activeOrder}
                onChange={handleOrderChange}
                onGeneratePDF={() => { /* manejado dentro del componente */ }}
                onSaveDraft={() => void handleOrderSave()}
              />
            ) : (
              <div className="ft-docs-empty card">
                Selecciona un documento o crea uno nuevo.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Shipping */}
      {(subTab === 'sea' || subTab === 'air') && (
        <div className="ft-docs-section">
          <div className="ft-docs-sidebar">
            <button
              className="btn btn-primary ft-docs-new-btn"
              onClick={() => void handleNewShipping(subTab)}
            >
              <Plus size={14} /> Nuevo
            </button>
            <div className="ft-docs-list">
              {activeShippings.length === 0 && (
                <div className="ft-docs-list-empty">
                  No hay documentos. Crea uno nuevo.
                </div>
              )}
              {activeShippings.map(s => (
                <div
                  key={s.id}
                  className={`ft-docs-list-item${s.id === activeShippingId ? ' active' : ''}`}
                  onClick={() => setActiveShippingId(s.id)}
                >
                  <div className="ft-docs-list-title">
                    {s.consignee.name || 'Sin destinatario'}
                  </div>
                  <div className="ft-docs-list-meta">
                    {s.contract_number || '—'} · {s.date}
                  </div>
                  <div className="ft-docs-list-status">
                    <button
                      className="ft-docs-list-delete"
                      onClick={e => { e.stopPropagation(); void handleDeleteShipping(s.id) }}
                      aria-label="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ft-docs-main">
            {activeShipping ? (
              <ShippingDoc
                doc={activeShipping}
                onChange={handleShippingChange}
                onSaveDraft={() => void handleShippingSave()}
              />
            ) : (
              <div className="ft-docs-empty card">
                Selecciona un documento o crea uno nuevo.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trip to Origin */}
      {subTab === 'trips' && (
        <div className="ft-docs-section">
          <div className="ft-docs-sidebar">
            <button
              className="btn btn-primary ft-docs-new-btn"
              onClick={() => void handleNewTrip()}
            >
              <Plus size={14} /> Nuevo
            </button>
            <div className="ft-docs-list">
              {trips.length === 0 && (
                <div className="ft-docs-list-empty">
                  No hay itinerarios. Crea uno nuevo.
                </div>
              )}
              {trips.map(t => (
                <div
                  key={t.id}
                  className={`ft-docs-list-item${t.id === activeTripId ? ' active' : ''}`}
                  onClick={() => setActiveTripId(t.id)}
                >
                  <div className="ft-docs-list-title">
                    {t.client_name || 'Sin nombre'}
                  </div>
                  <div className="ft-docs-list-meta">
                    {t.trip_date || '—'}
                  </div>
                  <div className="ft-docs-list-status">
                    <span className={`ft-status-badge ft-status-${t.status}`}>
                      {t.status}
                    </span>
                    <button
                      className="ft-docs-list-delete"
                      onClick={e => { e.stopPropagation(); void handleDeleteTrip(t.id) }}
                      aria-label="Eliminar itinerario"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ft-docs-main">
            {activeTrip ? (
              <TripToOriginDoc
                doc={activeTrip}
                onChange={handleTripChange}
                onSaveDraft={() => void handleTripSave()}
              />
            ) : (
              <div className="ft-docs-empty card">
                Selecciona un itinerario o crea uno nuevo.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wizard Nuevo Offering ─────────────────────────────────────────────────────
function WizardNuevoOffering({
  templates,
  onClose,
  onSave,
}: {
  templates: ProgramTemplate[]
  onClose: () => void
  onSave: (o: Offering) => Promise<void>
}) {
  const [w, setW] = useState<WizardState>(initWizard)

  function patch(updates: Partial<WizardState>) {
    setW(prev => ({ ...prev, ...updates, validationError: null }))
  }

  async function loadBaches() {
    patch({ loadingBaches: true, loadError: null })
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'CFF!A5:L200',
        'AF!A2:J200',
        'AS!B2:T200',
      ])

      const afCodes = new Set(
        data['AF!A2:J200']
          .filter(r => r[0]?.trim() && r[0] !== '#N/A' && r[9] && !isNaN(parseFloat(r[9])))
          .map(r => r[0].trim())
      )

      const asMap = new Map<string, { estado: string; sca: string; perfil: string; notas: string }>()
      for (const r of data['AS!B2:T200']) {
        const batch = r[0]?.trim()
        if (!batch) continue
        asMap.set(batch, {
          estado: r[18] || '',
          sca: r[14] || '',
          perfil: r[16] || '',
          notas: r[17] || '',
        })
      }

      const cff = data['CFF!A5:L200']
      const list: BacheRow[] = []
      for (const r of cff) {
        const code = r[3]?.trim()
        if (!code || code === '#') continue
        const as_data = asMap.get(code)
        const as_estado = as_data?.estado ?? ''
        if (!afCodes.has(code)) continue
        if (!as_estado.toUpperCase().includes('APROBADO')) continue
        const kg = parseFloat((r[9] || '0').replace(',', '.'))
        list.push({
          code,
          fecha: r[0] || '',
          proveedor: r[4] || '',
          variedad: r[8] || '',
          proceso: r[7] || '',
          kg,
          sca: as_data?.sca ?? '',
          perfil: as_data?.perfil || undefined,
          notas: as_data?.notas || undefined,
        })
      }
      patch({ baches: list, loadingBaches: false })
    } catch (e) {
      patch({
        loadError: e instanceof Error ? e.message : 'Error cargando baches',
        loadingBaches: false,
      })
    }
  }

  function goToStep2() {
    if (!w.template) { patch({ validationError: 'Selecciona una plantilla.' }); return }
    if (!w.title.trim()) { patch({ validationError: 'El título es obligatorio.' }); return }
    patch({ step: 2 })
    if (w.baches.length === 0) void loadBaches()
  }

  function goToStep3() {
    if (w.selectedCodes.length < 4) { patch({ validationError: 'Selecciona al menos 4 baches.' }); return }
    if (w.selectedCodes.length > 8) { patch({ validationError: 'Máximo 8 baches.' }); return }
    patch({ step: 3 })
  }

  function toggleCode(code: string) {
    const next = w.selectedCodes.includes(code)
      ? w.selectedCodes.filter(c => c !== code)
      : [...w.selectedCodes, code]
    patch({ selectedCodes: next })
  }

  function updateRecipient(id: string, field: keyof RecipientDraft, value: string) {
    setW(prev => ({
      ...prev,
      validationError: null,
      recipients: prev.recipients.map(r => r.id === id ? { ...r, [field]: value } : r),
    }))
  }

  function addRecipient() {
    setW(prev => ({ ...prev, recipients: [...prev.recipients, emptyRecipient()] }))
  }

  function removeRecipient(id: string) {
    setW(prev => ({ ...prev, recipients: prev.recipients.filter(r => r.id !== id) }))
  }

  function buildPreviewSamples(): OfferingSample[] {
    return w.selectedCodes.map((code, idx) => {
      const b = w.baches.find(bache => bache.code === code)
      return {
        sample_order: idx + 1,
        bache_code: code,
        variety: b?.variedad ?? '',
        process: b?.proceso ?? '',
        tasting_notes: b?.perfil ?? '',
        availability_kg: b?.kg ?? 0,
        price_usd_per_lb: 0,
        tasting_score: b?.sca || undefined,
        macroprofile: b?.perfil || undefined,
        profile: b?.notas || undefined,
      }
    })
  }

  async function handleSave() {
    const validRecipients = w.recipients.filter(r => r.email.trim() && r.name.trim())
    if (validRecipients.length === 0) {
      patch({ validationError: 'Agrega al menos un destinatario con nombre y email.' })
      return
    }

    const samples: OfferingSample[] = w.selectedCodes.map((code, idx) => {
      const b = w.baches.find(bache => bache.code === code)
      return {
        sample_order: idx + 1,
        bache_code: code,
        variety: b?.variedad ?? '',
        process: b?.proceso ?? '',
        tasting_notes: b?.perfil ?? '',
        availability_kg: b?.kg ?? 0,
        price_usd_per_lb: 0,
        tasting_score: b?.sca || undefined,
        macroprofile: b?.perfil || undefined,
        profile: b?.notas || undefined,
      }
    })

    const recipients: OfferingRecipient[] = validRecipients.map(r => ({
      email: r.email.trim(),
      name: r.name.trim(),
      company: r.company.trim() || undefined,
      country: r.country.trim() || undefined,
      funnel_stage: 'queued',
      view_count: 0,
    }))

    const offering: Offering = {
      id: crypto.randomUUID(),
      template_code: w.template!,
      title: w.title.trim(),
      cover_message: w.cover_message.trim(),
      access_token: crypto.randomUUID(),
      samples,
      recipients,
      status: 'draft',
      created_at: new Date().toISOString(),
    }

    patch({ createdOffering: offering, step: 3 })
    await onSave(offering)
    setW(prev => ({ ...prev, createdOffering: offering }))
  }

  if (w.createdOffering) {
    const shareLink = `${window.location.origin}/offering/${w.createdOffering.access_token}`
    return (
      <div className="ft-wizard-overlay" onClick={onClose}>
        <div className="ft-wizard" onClick={e => e.stopPropagation()}>
          <button className="ft-wizard-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
          <div className="ft-wizard-success">
            <CheckCircle2 size={52} />
            <h2>Offering creado</h2>
            <p>El offering <strong>{w.createdOffering.title}</strong> fue guardado.</p>
            <div className="ft-share-link">
              <strong>Link a compartir:</strong><br />
              {shareLink}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <OfferingDownloadButton
                offering={w.createdOffering}
                className="btn btn-secondary"
              >
                Generar PDF
              </OfferingDownloadButton>
              <button className="btn btn-primary" onClick={onClose}>Listo</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const stepDone = (n: number) => w.step > n
  const stepActive = (n: number) => w.step === n
  const previewSamples = buildPreviewSamples()
  const previewRecipients = w.recipients
    .filter(r => r.name || r.email)
    .map(r => ({ name: r.name, email: r.email, company: r.company || undefined, country: r.country || undefined }))

  return (
    <div className="ft-wizard-overlay" onClick={onClose}>
      <div className="ft-wizard ft-wizard-wide" onClick={e => e.stopPropagation()}>
        <button className="ft-wizard-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>

        <div className="ft-wizard-split">
          <div className="ft-wizard-left">
            {/* Stepper */}
            <div className="ft-wizard-stepper" aria-label="Progreso del wizard">
              {[1, 2, 3].map((n, i) => (
                <span key={n} style={{ display: 'contents' }}>
                  {i > 0 && <div className={`ft-step-line${stepDone(n - 1) ? ' done' : ''}`} />}
                  <div className={`ft-step-dot${stepActive(n) ? ' active' : ''}${stepDone(n) ? ' done' : ''}`}>
                    {stepDone(n) ? '✓' : n}
                  </div>
                </span>
              ))}
            </div>

            {/* Paso 1 */}
            {w.step === 1 && (
              <>
                <h2>Paso 1 — Plantilla y título</h2>
                <div className="ft-template-selector">
                  {templates.map(tpl => (
                    <button
                      key={tpl.code}
                      className={`ft-template-opt${w.template === tpl.code ? ' selected' : ''}`}
                      style={{ color: tpl.color_hex, borderColor: w.template === tpl.code ? tpl.color_hex : undefined }}
                      onClick={() => patch({ template: tpl.code })}
                    >
                      <span className="ft-template-opt-name">{tpl.name}</span>
                      <span className="ft-template-opt-tagline">{tpl.tagline}</span>
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label htmlFor="ft-title">Título del offering</label>
                  <input
                    id="ft-title"
                    type="text"
                    placeholder="Ej. Spring 2026 — Gesha Selection"
                    value={w.title}
                    onChange={e => patch({ title: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label htmlFor="ft-cover">Mensaje personalizado (opcional)</label>
                  <textarea
                    id="ft-cover"
                    rows={3}
                    placeholder="Nota de introducción para el cliente…"
                    value={w.cover_message}
                    onChange={e => patch({ cover_message: e.target.value })}
                    style={{ resize: 'vertical', padding: '0.75rem 1rem', border: '1px solid var(--color-gray-medium)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                {w.validationError && <div className="ft-validation-error">{w.validationError}</div>}
                <div className="ft-wizard-actions">
                  <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
                  <button className="btn btn-primary" onClick={goToStep2}>
                    Siguiente <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

            {/* Paso 2 */}
            {w.step === 2 && (
              <>
                <h2>Paso 2 — Seleccionar baches (4-8 muestras)</h2>
                {w.loadingBaches && <div className="ft-nanolotes-loading"><Loader2 className="spin" size={28} /></div>}
                {w.loadError && <div className="ft-nanolotes-error">{w.loadError}</div>}
                {!w.loadingBaches && !w.loadError && (
                  <>
                    <div className="ft-nanolotes-count">
                      <strong>{w.selectedCodes.length}</strong> / 8 seleccionados
                      &nbsp;·&nbsp;{w.baches.length} baches APROBADOS
                    </div>
                    <div className="ft-nanolotes-grid">
                      {w.baches.map(b => {
                        const checked = w.selectedCodes.includes(b.code)
                        const atLimit = !checked && w.selectedCodes.length >= 8
                        return (
                          <label
                            key={b.code}
                            className={`ft-nanolote-opt${checked ? ' selected' : ''}`}
                            style={{ opacity: atLimit ? 0.45 : 1 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={atLimit}
                              onChange={() => toggleCode(b.code)}
                            />
                            <div>
                              <div className="ft-nanolote-opt-code">{b.code}</div>
                              <div className="ft-nanolote-opt-info">{b.variedad} · {b.proceso}</div>
                              <div className="ft-nanolote-opt-info">
                                {b.kg.toFixed(1)} kg{b.sca ? ` · SCA ${b.sca}` : ''}
                              </div>
                              {b.perfil && <div className="ft-nanolote-opt-perfil">{b.perfil}</div>}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </>
                )}
                {w.validationError && <div className="ft-validation-error">{w.validationError}</div>}
                <div className="ft-wizard-actions">
                  <button className="btn btn-secondary" onClick={() => patch({ step: 1 })}>
                    <ChevronLeft size={16} /> Atrás
                  </button>
                  <button className="btn btn-primary" onClick={goToStep3} disabled={w.loadingBaches}>
                    Siguiente <ChevronRight size={16} />
                  </button>
                </div>
              </>
            )}

            {/* Paso 3 */}
            {w.step === 3 && (
              <>
                <h2>Paso 3 — Destinatarios</h2>
                <div className="ft-recipients-list">
                  {w.recipients.map(r => (
                    <div key={r.id} className="ft-recipient-row">
                      <input type="text" placeholder="Nombre *" value={r.name} onChange={e => updateRecipient(r.id, 'name', e.target.value)} aria-label="Nombre" />
                      <input type="email" placeholder="Email *" value={r.email} onChange={e => updateRecipient(r.id, 'email', e.target.value)} aria-label="Email" />
                      <input type="text" placeholder="Empresa" value={r.company} onChange={e => updateRecipient(r.id, 'company', e.target.value)} aria-label="Empresa" />
                      <input type="text" placeholder="País" value={r.country} onChange={e => updateRecipient(r.id, 'country', e.target.value)} aria-label="País" />
                      <button className="ft-recipient-remove" onClick={() => removeRecipient(r.id)} aria-label="Eliminar" disabled={w.recipients.length === 1}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="ft-add-recipient" onClick={addRecipient}>
                  <UserPlus size={14} /> Agregar destinatario
                </button>
                {w.validationError && <div className="ft-validation-error">{w.validationError}</div>}
                <div className="ft-wizard-actions">
                  <button className="btn btn-secondary" onClick={() => patch({ step: 2 })}>
                    <ChevronLeft size={16} /> Atrás
                  </button>
                  <button className="btn btn-primary" onClick={() => void handleSave()}>
                    <CheckCircle2 size={16} /> Crear offering
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="ft-wizard-right">
            <OfferingPreview
              templateCode={w.template}
              title={w.title}
              coverMessage={w.cover_message}
              samples={previewSamples}
              recipients={previewRecipients}
              minSamples={4}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
