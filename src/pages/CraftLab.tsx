import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Sparkles, Loader2, RefreshCw, Plus, Search, X, Check,
  AlertCircle, FileText, Clock, CheckCircle2,
} from 'lucide-react'
import {
  asegurarPestanaCL, listarPeticionesCL, crearPeticionCL,
  actualizarPeticionCL, buscarMatchesEnStock,
  ESTADO_LABEL, type PeticionCL, type EstadoCL, type AreaCL, type MatchNanolote,
} from '../lib/craftlab'
import { PROCESOS, VARIEDADES } from '../lib/trazabilidad'
import { registrarEvento } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './CraftLab.css'

// Etapas del progreso lineal (dots)
const STAGES: { key: EstadoCL; label: string }[] = [
  { key: 'Solicitud',      label: 'Solicitud' },
  { key: 'Buscando',       label: 'Buscando' },
  { key: 'Asignada',       label: 'Asignada' },
  { key: 'En proceso',     label: 'En proceso' },
  { key: 'Lista despacho', label: 'Lista' },
  { key: 'Despachada',     label: 'Despachada' },
]

const stageIndex = (estado: EstadoCL): number => {
  const i = STAGES.findIndex(s => s.key === estado)
  return i < 0 ? 0 : i
}

const toneFromEstado = (estado: EstadoCL): 'tan' | 'navy' | 'green' | 'red' | 'gray' =>
  ESTADO_LABEL[estado]?.tone ?? 'navy'

const badgeClassFromEstado = (estado: EstadoCL): string => {
  if (estado === 'Despachada') return 'cl-badge--delivered'
  if (estado === 'Cancelada') return 'cl-badge--cancelled'
  if (estado === 'Lista despacho') return 'cl-badge--ready'
  return 'cl-badge--active'
}

export default function CraftLab() {
  const [peticiones, setPeticiones] = useState<PeticionCL[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pestanaCreada, setPestanaCreada] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoCL>('todos')
  const [modalNueva, setModalNueva] = useState(false)
  const [seleccionada, setSeleccionada] = useState<PeticionCL | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { creada } = await asegurarPestanaCL()
      if (creada) setPestanaCreada(true)
      const list = await listarPeticionesCL()
      setPeticiones(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return peticiones.filter(p => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false
      if (!q) return true
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.cliente.toLowerCase().includes(q) ||
        p.variedad.toLowerCase().includes(q) ||
        p.proceso.toLowerCase().includes(q) ||
        p.contacto.toLowerCase().includes(q)
      )
    })
  }, [peticiones, busqueda, filtroEstado])

  const stats = useMemo(() => ({
    total: peticiones.length,
    activas: peticiones.filter(p =>
      p.estado !== 'Despachada' && p.estado !== 'Cancelada').length,
    despachadas: peticiones.filter(p => p.estado === 'Despachada').length,
  }), [peticiones])

  return (
    <div className="craftlab">
      {/* Header editorial */}
      <header className="cl-header">
        <div className="cl-kicker">
          <Sparkles size={11} strokeWidth={2} /> CraftLab · Custom requests
        </div>
        <h1 className="cl-title">
          Café <em>hecho a la medida</em> para <span className="cl-title-accent">cada cliente.</span>
        </h1>
        <p className="cl-subtitle">
          Cuando un cliente pide café customizado, búscalo en stock o produce un bache nuevo.
        </p>
      </header>

      {pestanaCreada && (
        <div className="cl-banner">
          ✓ Pestaña <code>CL_PETICIONES</code> creada en el Sheet 2026 sin afectar otras hojas.
        </div>
      )}

      {/* Stats */}
      <div className="cl-stats-row">
        <div className="cl-stat cl-stat--pink">
          <div className="cl-stat-icon"><FileText size={18} strokeWidth={1.75} /></div>
          <div className="cl-stat-value">{stats.total}</div>
          <div className="cl-stat-label">Total</div>
        </div>
        <div className="cl-stat cl-stat--amber">
          <div className="cl-stat-icon"><Clock size={18} strokeWidth={1.75} /></div>
          <div className="cl-stat-value">{stats.activas}</div>
          <div className="cl-stat-label">Activas</div>
        </div>
        <div className="cl-stat cl-stat--green">
          <div className="cl-stat-icon"><CheckCircle2 size={18} strokeWidth={1.75} /></div>
          <div className="cl-stat-value">{stats.despachadas}</div>
          <div className="cl-stat-label">Despachadas</div>
        </div>
      </div>

      {/* Action row */}
      <div className="cl-action-row">
        <button className="cl-btn-new" onClick={() => setModalNueva(true)}>
          <Plus size={16} strokeWidth={2.25} /> Nueva petición
        </button>
        <div className="cl-search">
          <Search size={15} strokeWidth={1.75} />
          <input
            type="search"
            placeholder="Buscar por código, cliente, variedad…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <button className="cl-btn-refresh" onClick={load} title="Actualizar">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="cl-tabs">
        <button
          className={`cl-tab ${filtroEstado === 'todos' ? 'cl-tab--active' : ''}`}
          onClick={() => setFiltroEstado('todos')}
        >Todas · {peticiones.length}</button>
        {(['Solicitud', 'Buscando', 'Asignada', 'En proceso', 'Lista despacho', 'Despachada'] as EstadoCL[]).map(est => {
          const count = peticiones.filter(p => p.estado === est).length
          if (count === 0 && filtroEstado !== est) return null
          return (
            <button
              key={est}
              className={`cl-tab ${filtroEstado === est ? 'cl-tab--active' : ''}`}
              onClick={() => setFiltroEstado(est)}
            >{ESTADO_LABEL[est].label} · {count}</button>
          )
        })}
      </div>

      {loading && <div className="cl-loading"><Loader2 className="spin" size={28} /></div>}
      {error && <div className="cl-error">{error}</div>}

      {!loading && !error && filtradas.length === 0 && (
        <div className="cl-empty">
          <Sparkles size={32} strokeWidth={1.5} />
          {peticiones.length === 0 ? (
            <>
              <h3>Sin peticiones todavía</h3>
              <p>Cuando llegue la primera petición de café customizado, créala con "+ Nueva petición".</p>
            </>
          ) : (
            <p>Ninguna petición coincide con los filtros aplicados.</p>
          )}
        </div>
      )}

      {!loading && !error && filtradas.length > 0 && (
        <div className="cl-grid-wrapper">
          <div className="cl-grid">
            {filtradas.map(p => (
              <PeticionCard key={p.codigo} p={p} onClick={() => setSeleccionada(p)} />
            ))}
          </div>
        </div>
      )}

      {modalNueva && (
        <NuevaPeticionModal
          onClose={() => setModalNueva(false)}
          onSuccess={() => { setModalNueva(false); void load() }}
        />
      )}

      {seleccionada && (
        <DetallePeticionModal
          peticion={seleccionada}
          onClose={() => setSeleccionada(null)}
          onUpdate={() => { setSeleccionada(null); void load() }}
        />
      )}
    </div>
  )
}

function PeticionCard({ p, onClick }: { p: PeticionCL; onClick: () => void }) {
  const tone = toneFromEstado(p.estado)
  const badgeClass = badgeClassFromEstado(p.estado)
  const idx = stageIndex(p.estado)

  return (
    <button className={`cl-card tone-${tone}`} onClick={onClick}>
      <div className="cl-card-hero">
        <span className="cl-card-codigo">{p.codigo}</span>
        <span className={`cl-card-status ${badgeClass}`}>
          {ESTADO_LABEL[p.estado]?.label}
        </span>
        <div className="cl-card-weight">
          {p.kg}<small>kg</small>
        </div>
      </div>
      <div className="cl-card-body">
        <h4 className="cl-card-variety">
          {p.variedad || 'Cualquier variedad'}
        </h4>
        <p className="cl-card-process">
          {p.proceso || 'Cualquier proceso'} {p.sca_min ? `· SCA ≥ ${p.sca_min}` : ''}
        </p>

        {/* Progress dots */}
        <div className="cl-progress">
          {STAGES.map((s, i) => {
            const done = i < idx
            const active = i === idx && p.estado !== 'Cancelada'
            const showLine = i < STAGES.length - 1
            return (
              <>
                <div
                  key={`stage-${s.key}`}
                  className={`cl-progress-stage ${done ? 'is-done' : ''} ${active ? 'is-active' : ''}`}
                >
                  <div className={`cl-progress-dot ${done ? 'cl-progress-dot--done' : ''} ${active ? 'cl-progress-dot--active' : ''}`}>
                    {done && <Check size={9} strokeWidth={3} />}
                  </div>
                </div>
                {showLine && (
                  <div
                    key={`line-${s.key}`}
                    className={`cl-progress-line ${i < idx ? 'cl-progress-line--filled' : ''}`}
                  />
                )}
              </>
            )
          })}
        </div>

        <div className="cl-card-cliente">
          Cliente: <strong>{p.cliente || '—'}</strong>
          {p.bache_nanolote && <> · {p.bache_nanolote}</>}
        </div>
      </div>
    </button>
  )
}

function NuevaPeticionModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    cliente: '',
    contacto: '',
    variedad: '',
    proceso: '',
    kg: '',
    sca_min: '',
    perfil: '',
    precio_usd: '',
    fecha_entrega: '',
    area: 'Calidad' as AreaCL,
    notas: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.cliente.trim()) { setError('Indica el cliente'); return }
    setSaving(true)
    setError(null)
    try {
      const { codigo } = await crearPeticionCL({
        cliente: form.cliente,
        contacto: form.contacto,
        variedad: form.variedad,
        proceso: form.proceso,
        kg: parseFloat(form.kg) || 0,
        sca_min: parseFloat(form.sca_min) || 0,
        perfil: form.perfil,
        precio_usd: parseFloat(form.precio_usd) || 0,
        fecha_entrega: form.fecha_entrega,
        area: form.area,
        notas: form.notas,
      })
      registrarEvento({
        tipo: 'estado_cambiado',
        bache: codigo,
        despues: 'Solicitud',
        detalle: `Cliente ${form.cliente} · ${form.kg} kg`,
        usuario: getStoredUser(),
      })
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando petición')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={e => e.stopPropagation()}>
        <button className="cl-modal-close" onClick={onClose}><X size={16} /></button>
        <h2>Nueva petición</h2>
        <p className="cl-subtitle" style={{ marginBottom: 0 }}>
          Registra los datos del pedido custom y avisará a Calidad/Producción.
        </p>

        <form onSubmit={handleSubmit} className="cl-form">
          <h3>Cliente</h3>
          <div className="form-row">
            <div className="field">
              <label>Cliente *</label>
              <input
                type="text" required autoFocus
                value={form.cliente}
                onChange={e => update('cliente', e.target.value)}
                placeholder="Nombre / empresa"
              />
            </div>
            <div className="field">
              <label>Contacto</label>
              <input
                type="text"
                value={form.contacto}
                onChange={e => update('contacto', e.target.value)}
                placeholder="email / WhatsApp"
              />
            </div>
          </div>

          <h3>Café que pide</h3>
          <div className="form-row">
            <div className="field">
              <label>Variedad</label>
              <select value={form.variedad} onChange={e => update('variedad', e.target.value)}>
                <option value="">Cualquiera</option>
                {VARIEDADES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Proceso</label>
              <select value={form.proceso} onChange={e => update('proceso', e.target.value)}>
                <option value="">Cualquiera</option>
                {PROCESOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Kg solicitados</label>
              <input
                type="number" step="0.1" min="0"
                value={form.kg}
                onChange={e => update('kg', e.target.value)}
              />
            </div>
            <div className="field">
              <label>SCA mínimo</label>
              <input
                type="number" step="0.25" min="80" max="100"
                value={form.sca_min}
                onChange={e => update('sca_min', e.target.value)}
                placeholder="ej. 87"
              />
            </div>
          </div>
          <div className="field">
            <label>Perfil deseado</label>
            <textarea
              rows={2}
              value={form.perfil}
              onChange={e => update('perfil', e.target.value)}
              placeholder="ej. cítrico-floral, notas de jazmín…"
            />
          </div>

          <h3>Comercial</h3>
          <div className="form-row">
            <div className="field">
              <label>Precio acordado USD</label>
              <input
                type="number" step="0.01" min="0"
                value={form.precio_usd}
                onChange={e => update('precio_usd', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Fecha entrega</label>
              <input
                type="date"
                value={form.fecha_entrega}
                onChange={e => update('fecha_entrega', e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Área encargada</label>
              <select value={form.area} onChange={e => update('area', e.target.value as AreaCL)}>
                <option value="Calidad">Calidad</option>
                <option value="Producción">Producción</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notas internas</label>
            <textarea
              rows={2}
              value={form.notas}
              onChange={e => update('notas', e.target.value)}
              placeholder="Observaciones del equipo, contexto del pedido…"
            />
          </div>

          {error && <div className="cl-error">{error}</div>}

          <div className="cl-modal-actions">
            <button type="button" className="cl-btn cl-btn--secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="cl-btn cl-btn--primary" disabled={saving}>
              {saving
                ? <><Loader2 className="spin" size={14} /> Creando…</>
                : <>Crear petición</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetallePeticionModal({ peticion, onClose, onUpdate }: {
  peticion: PeticionCL
  onClose: () => void
  onUpdate: () => void
}) {
  const [matches, setMatches] = useState<MatchNanolote[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buscarMatches() {
    setBuscando(true); setError(null)
    try {
      const m = await buscarMatchesEnStock({
        variedad: peticion.variedad || undefined,
        proceso: peticion.proceso || undefined,
        sca_min: peticion.sca_min || undefined,
      })
      setMatches(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error buscando')
    } finally {
      setBuscando(false)
    }
  }

  async function asignarNanolote(codigoNanolote: string, origen: 'stock_existente' | 'produccion_nueva') {
    if (!confirm(`¿Asignar ${codigoNanolote} a ${peticion.codigo}?`)) return
    setActualizando(true); setError(null)
    try {
      await actualizarPeticionCL(peticion.fila, {
        estado: 'Asignada',
        bache_nanolote: codigoNanolote,
        origen,
        fecha_asignacion: new Date().toLocaleDateString('es-CO'),
      })
      registrarEvento({
        tipo: 'estado_cambiado', bache: peticion.codigo,
        antes: peticion.estado, despues: 'Asignada',
        detalle: `Asignado ${codigoNanolote} (${origen})`,
        usuario: getStoredUser(),
      })
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setActualizando(false)
    }
  }

  async function cambiarEstado(nuevo: EstadoCL) {
    if (!confirm(`¿Cambiar estado a "${nuevo}"?`)) return
    setActualizando(true); setError(null)
    try {
      const cambios: Parameters<typeof actualizarPeticionCL>[1] = { estado: nuevo }
      if (nuevo === 'Despachada') {
        cambios.fecha_despacho = new Date().toLocaleDateString('es-CO')
      }
      await actualizarPeticionCL(peticion.fila, cambios)
      registrarEvento({
        tipo: 'estado_cambiado', bache: peticion.codigo,
        antes: peticion.estado, despues: nuevo,
        usuario: getStoredUser(),
      })
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setActualizando(false)
    }
  }

  const badgeClass = badgeClassFromEstado(peticion.estado)

  return (
    <div className="cl-modal-overlay" onClick={onClose}>
      <div className="cl-modal cl-modal-detalle" onClick={e => e.stopPropagation()}>
        <button className="cl-modal-close" onClick={onClose}><X size={16} /></button>
        <h2>{peticion.codigo}</h2>
        <div className="cl-detalle-meta">
          <span className={`cl-card-status ${badgeClass}`} style={{ position: 'static' }}>
            {ESTADO_LABEL[peticion.estado]?.label}
          </span>
          <span>· Solicitada {peticion.fecha_solicitud}</span>
          {peticion.area && <span>· {peticion.area}</span>}
        </div>

        <section className="cl-detalle-section">
          <h3>Cliente</h3>
          <div className="cl-data-grid">
            <DataCell label="Cliente" value={peticion.cliente} />
            <DataCell label="Contacto" value={peticion.contacto} />
            <DataCell label="Fecha entrega" value={peticion.fecha_entrega} />
            <DataCell label="Precio acordado" value={peticion.precio_usd ? `${peticion.precio_usd} USD` : ''} />
          </div>
        </section>

        <section className="cl-detalle-section">
          <h3>Café que pidió</h3>
          <div className="cl-data-grid">
            <DataCell label="Variedad" value={peticion.variedad || 'Cualquiera'} />
            <DataCell label="Proceso" value={peticion.proceso || 'Cualquiera'} />
            <DataCell label="Kg" value={`${peticion.kg} kg`} />
            <DataCell label="SCA mínimo" value={peticion.sca_min ? String(peticion.sca_min) : '—'} />
            {peticion.perfil && <DataCell label="Perfil" value={peticion.perfil} span={2} />}
            {peticion.notas && <DataCell label="Notas internas" value={peticion.notas} span={2} />}
          </div>
        </section>

        {peticion.bache_nanolote && (
          <section className="cl-detalle-section">
            <h3>Asignación</h3>
            <div className="cl-data-grid">
              <DataCell label="Bache/Nanolote" value={peticion.bache_nanolote} big />
              <DataCell label="Origen" value={
                peticion.origen === 'stock_existente' ? 'Stock existente'
                : peticion.origen === 'produccion_nueva' ? 'Producción nueva'
                : '—'
              } />
              <DataCell label="Fecha asignación" value={peticion.fecha_asignacion} />
              <DataCell label="Fecha despacho" value={peticion.fecha_despacho} />
            </div>
          </section>
        )}

        {(peticion.estado === 'Solicitud' || peticion.estado === 'Buscando') && !peticion.bache_nanolote && (
          <section className="cl-detalle-section">
            <h3>Buscar café</h3>
            <p className="cl-subtitle" style={{ marginBottom: 12 }}>
              Revisa si tenemos en stock un nanolote que cumpla las características pedidas.
            </p>
            <div className="cl-acciones-buscar">
              <button className="cl-btn cl-btn--primary" onClick={buscarMatches} disabled={buscando}>
                {buscando
                  ? <><Loader2 className="spin" size={14} /> Buscando…</>
                  : <><Search size={14} /> Buscar match en stock</>}
              </button>
              <button
                className="cl-btn cl-btn--secondary"
                onClick={() => {
                  const codigo = prompt('Crear bache nuevo CL — ¿qué código? (ej. 020-26CL)')
                  if (codigo?.trim()) void asignarNanolote(codigo.trim(), 'produccion_nueva')
                }}
                disabled={actualizando}
              >Crear bache nuevo CL</button>
            </div>

            {matches !== null && (
              <div className="cl-matches">
                {matches.length === 0 ? (
                  <div className="cl-empty-matches">
                    <AlertCircle size={16} />
                    No hay nanolotes en stock que cumplan los criterios. Conviene producir nuevo.
                  </div>
                ) : (
                  <>
                    <div className="cl-matches-title">{matches.length} match{matches.length > 1 ? 'es' : ''} en stock:</div>
                    {matches.map(m => (
                      <div key={m.codigo} className="cl-match-row">
                        <div>
                          <strong>{m.codigo}</strong>
                          <small>{m.variedad} · {m.proceso} · SCA {m.sca}</small>
                        </div>
                        <span className="cl-match-kg">{m.kg_excelso} kg</span>
                        <button
                          className="cl-btn cl-btn--primary cl-btn--sm"
                          onClick={() => asignarNanolote(m.codigo, 'stock_existente')}
                          disabled={actualizando}
                        >Asignar</button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {peticion.estado === 'Asignada' && (
          <section className="cl-detalle-section">
            <h3>Avanzar estado</h3>
            <div className="cl-estado-actions">
              <button className="cl-btn cl-btn--primary" onClick={() => cambiarEstado('En proceso')} disabled={actualizando}>En proceso</button>
              <button className="cl-btn cl-btn--secondary" onClick={() => cambiarEstado('Lista despacho')} disabled={actualizando}>Lista para despachar</button>
            </div>
          </section>
        )}

        {peticion.estado === 'En proceso' && (
          <section className="cl-detalle-section">
            <h3>Avanzar estado</h3>
            <button className="cl-btn cl-btn--primary" onClick={() => cambiarEstado('Lista despacho')} disabled={actualizando}>Lista para despachar</button>
          </section>
        )}

        {peticion.estado === 'Lista despacho' && (
          <section className="cl-detalle-section">
            <h3>Despachar al cliente</h3>
            <button className="cl-btn cl-btn--primary" onClick={() => cambiarEstado('Despachada')} disabled={actualizando}>
              <CheckCircle2 size={14} /> Confirmar despacho a {peticion.cliente}
            </button>
          </section>
        )}

        {(peticion.estado !== 'Despachada' && peticion.estado !== 'Cancelada') && (
          <div className="cl-cancel">
            <button onClick={() => cambiarEstado('Cancelada')} disabled={actualizando}>
              Cancelar petición
            </button>
          </div>
        )}

        {error && <div className="cl-error">{error}</div>}
      </div>
    </div>
  )
}

function DataCell({ label, value, big, span }: { label: string; value?: string; big?: boolean; span?: number }) {
  return (
    <div className={`cl-data-cell ${big ? 'big' : ''} ${span === 2 ? 'span-2' : ''}`}>
      <div className="cl-data-label">{label}</div>
      <div className="cl-data-value">{value || '—'}</div>
    </div>
  )
}
