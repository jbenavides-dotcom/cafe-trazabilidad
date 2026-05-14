/*
 * ══════════════════════════════════════════════════════════════════════════════
 * PANEL OPERARIO LP&ET — Pedidos CraftLab
 * Ruta: /pedidos-craftlab
 *
 * REQUISITO PREVIO (ejecutar UNA VEZ en Supabase SQL Editor):
 * ──────────────────────────────────────────────────────────
 *
 * -- Permite que cualquier usuario autenticado vea TODOS los pedidos (equipo LP&ET)
 * create policy "fb_orders_select_team" on public.fb_orders
 *   for select using (true);
 *
 * create policy "cl_orders_select_team" on public.cl_orders
 *   for select using (true);
 *
 * create policy "fb_orders_update_team" on public.fb_orders
 *   for update using (true);
 *
 * create policy "cl_orders_update_team" on public.cl_orders
 *   for update using (true);
 *
 * create policy "order_updates_insert_team" on public.order_updates
 *   for insert with check (true);
 *
 * create policy "order_updates_select_team" on public.order_updates
 *   for select using (true);
 *
 * create policy "order_tank_assignments_team" on public.order_tank_assignments
 *   for all using (true) with check (true);
 *
 * Si no ejecutas este SQL, las listas se verán vacías pero la app no romperá.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Package, Loader2, RefreshCw, X, ChevronDown,
  MessageSquarePlus, Truck, Beaker, Clock,
  CheckCircle2, AlertCircle, Send, Image,
  Activity, ThermometerSun, Droplets,
  Zap, Hash, Waves, Wind, FlaskConical,
} from 'lucide-react'
import {
  cargarTodosPedidos,
  cargarTodosLosTanques,
  cargarUpdates,
  cargarReadings,
  actualizarStatus,
  asignarTanque,
  insertarUpdate,
  STATUS_LABELS,
  STATUS_ORDER,
  type Pedido,
  type Tanque,
  type OrderUpdate,
  type OrderStatus,
  type SensorReading,
} from '../lib/pedidos-craftlab'
import { getStoredUser } from '../lib/auth'
import './PedidosCraftLab.css'

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

type FiltroStatus = 'all' | OrderStatus | 'cancelled'
type FiltroTipo   = 'all' | 'fb' | 'cl'

// ─── Helpers visuales ────────────────────────────────────────────────────────

function badgeClass(status: string): string {
  switch (status) {
    case 'pending':      return 'pcl-badge--pending'
    case 'confirmed':    return 'pcl-badge--confirmed'
    case 'fermentation': return 'pcl-badge--fermentation'
    case 'drying':       return 'pcl-badge--drying'
    case 'ready':        return 'pcl-badge--ready'
    case 'shipped':      return 'pcl-badge--shipped'
    case 'delivered':    return 'pcl-badge--delivered'
    case 'cancelled':    return 'pcl-badge--cancelled'
    default:             return 'pcl-badge--pending'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'pending':      return <Clock size={12} />
    case 'confirmed':    return <CheckCircle2 size={12} />
    case 'fermentation': return <Beaker size={12} />
    case 'drying':       return <Beaker size={12} />
    case 'ready':        return <CheckCircle2 size={12} />
    case 'shipped':      return <Truck size={12} />
    case 'delivered':    return <CheckCircle2 size={12} />
    default:             return <AlertCircle size={12} />
  }
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Sparkline SVG inline ─────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 28 - 1}`)
    .join(' ')
  return (
    <svg
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className="pcl-sparkline"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PedidosCraftLab() {
  const [pedidos,    setPedidos]    = useState<Pedido[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('all')
  const [filtroTipo,   setFiltroTipo]   = useState<FiltroTipo>('all')
  const [seleccionado, setSeleccionado] = useState<Pedido | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const lista = await cargarTodosPedidos()
      setPedidos(lista)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando pedidos')
    } finally {
      setLoading(false)
    }
  }

  const filtrados = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroStatus !== 'all' && p.status !== filtroStatus) return false
      if (filtroTipo   !== 'all' && p.type   !== filtroTipo)   return false
      return true
    })
  }, [pedidos, filtroStatus, filtroTipo])

  // Contadores por status para los tabs
  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const p of pedidos) {
      map[p.status] = (map[p.status] ?? 0) + 1
    }
    return map
  }, [pedidos])

  const stats = useMemo(() => ({
    total:     pedidos.length,
    activos:   pedidos.filter(p => !['delivered', 'cancelled'].includes(p.status)).length,
    listos:    pedidos.filter(p => p.status === 'ready').length,
    entregados:pedidos.filter(p => p.status === 'delivered').length,
  }), [pedidos])

  return (
    <div className="pcl">
      {/* Header */}
      <header className="pcl-header">
        <div className="pcl-kicker">
          <Package size={11} strokeWidth={2} /> Panel Operario · Pedidos CraftLab
        </div>
        <h1 className="pcl-title">
          Gestión de <em>pedidos</em>{' '}
          <span className="pcl-title-accent">LP&ET.</span>
        </h1>
        <p className="pcl-subtitle">
          Todos los pedidos Forward Booking y CraftLab. Asigna tanques, cambia estados y agrega updates.
        </p>
      </header>

      {/* Stats */}
      <div className="pcl-stats-row">
        <div className="pcl-stat pcl-stat--navy">
          <div className="pcl-stat-icon"><Package size={18} strokeWidth={1.75} /></div>
          <div className="pcl-stat-value">{stats.total}</div>
          <div className="pcl-stat-label">Total</div>
        </div>
        <div className="pcl-stat pcl-stat--amber">
          <div className="pcl-stat-icon"><Clock size={18} strokeWidth={1.75} /></div>
          <div className="pcl-stat-value">{stats.activos}</div>
          <div className="pcl-stat-label">Activos</div>
        </div>
        <div className="pcl-stat pcl-stat--green">
          <div className="pcl-stat-icon"><CheckCircle2 size={18} strokeWidth={1.75} /></div>
          <div className="pcl-stat-value">{stats.listos}</div>
          <div className="pcl-stat-label">Listos</div>
        </div>
        <div className="pcl-stat pcl-stat--delivered">
          <div className="pcl-stat-icon"><Truck size={18} strokeWidth={1.75} /></div>
          <div className="pcl-stat-value">{stats.entregados}</div>
          <div className="pcl-stat-label">Entregados</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="pcl-filters">
        <div className="pcl-filter-group">
          <span className="pcl-filter-label">Tipo</span>
          {(['all', 'fb', 'cl'] as FiltroTipo[]).map(t => (
            <button
              key={t}
              className={`pcl-filter-btn ${filtroTipo === t ? 'active' : ''}`}
              onClick={() => setFiltroTipo(t)}
            >
              {t === 'all' ? 'Todos' : t === 'fb' ? 'Forward Booking' : 'CraftLab'}
            </button>
          ))}
        </div>
        <div className="pcl-filter-group pcl-filter-group--status">
          <span className="pcl-filter-label">Estado</span>
          <button
            className={`pcl-filter-btn ${filtroStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFiltroStatus('all')}
          >
            Todos · {pedidos.length}
          </button>
          {STATUS_ORDER.map(s => {
            const n = counts[s] ?? 0
            if (n === 0 && filtroStatus !== s) return null
            return (
              <button
                key={s}
                className={`pcl-filter-btn ${filtroStatus === s ? 'active' : ''}`}
                onClick={() => setFiltroStatus(s as FiltroStatus)}
              >
                {STATUS_LABELS[s]} · {n}
              </button>
            )
          })}
        </div>
      </div>

      {/* Refresh */}
      <div className="pcl-toolbar">
        <span className="pcl-count">
          {filtrados.length} pedido{filtrados.length !== 1 ? 's' : ''}
          {filtroStatus !== 'all' || filtroTipo !== 'all' ? ' (filtrado)' : ''}
        </span>
        <button className="pcl-btn-refresh" onClick={load} aria-label="Actualizar">
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Estados */}
      {loading && (
        <div className="pcl-loading">
          <Loader2 className="spin" size={28} />
          <span>Cargando pedidos…</span>
        </div>
      )}

      {error && (
        <div className="pcl-error">
          <AlertCircle size={16} />
          <div>
            <strong>Error al cargar</strong>
            <p>{error}</p>
            <p className="pcl-error-hint">
              Verifica que las policies RLS de equipo estén activas en Supabase (ver comentario al inicio de este archivo).
            </p>
          </div>
        </div>
      )}

      {!loading && !error && filtrados.length === 0 && (
        <div className="pcl-empty">
          <Package size={36} strokeWidth={1.3} />
          {pedidos.length === 0 ? (
            <>
              <h3>Sin pedidos todavía</h3>
              <p>
                Cuando los clientes hagan pedidos en la app CraftLab aparecerán aquí.
                Si la lista está vacía con pedidos existentes, activa las policies RLS de equipo.
              </p>
            </>
          ) : (
            <p>Ningún pedido coincide con los filtros aplicados.</p>
          )}
        </div>
      )}

      {/* Tabla de pedidos */}
      {!loading && !error && filtrados.length > 0 && (
        <div className="pcl-table-wrapper">
          <table className="pcl-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Variedad</th>
                <th>Proceso</th>
                <th>Kg</th>
                <th>Estado</th>
                <th>Tanque</th>
                <th>Fecha</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr
                  key={`${p.type}-${p.id}`}
                  className="pcl-row"
                  onClick={() => setSeleccionado(p)}
                >
                  <td className="pcl-td-num">{i + 1}</td>
                  <td className="pcl-td-email">
                    <span title={p.user_email}>{p.user_email}</span>
                  </td>
                  <td>
                    <span className={`pcl-type-badge pcl-type-badge--${p.type}`}>
                      {p.type === 'fb' ? 'FB' : 'CL'}
                    </span>
                  </td>
                  <td className="pcl-td-variety">{p.variety}</td>
                  <td className="pcl-td-process">{p.process}</td>
                  <td className="pcl-td-kg">{p.total_kg > 0 ? `${p.total_kg} kg` : '—'}</td>
                  <td>
                    <span className={`pcl-badge ${badgeClass(p.status)}`}>
                      {statusIcon(p.status)}
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="pcl-td-tank">
                    {p.tank_name !== '—'
                      ? <span className="pcl-tank-chip">{p.tank_name}</span>
                      : <span className="pcl-tank-empty">sin asignar</span>}
                  </td>
                  <td className="pcl-td-date">{formatDate(p.created_at)}</td>
                  <td>
                    <button
                      className="pcl-btn-detail"
                      onClick={e => { e.stopPropagation(); setSeleccionado(p) }}
                      aria-label="Ver detalle"
                    >
                      Ver <ChevronDown size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal detalle */}
      {seleccionado && (
        <DetallePedidoModal
          pedido={seleccionado}
          onClose={() => setSeleccionado(null)}
          onUpdate={() => { setSeleccionado(null); void load() }}
        />
      )}
    </div>
  )
}

// ─── Modal de detalle ─────────────────────────────────────────────────────────

function DetallePedidoModal({
  pedido,
  onClose,
  onUpdate,
}: {
  pedido: Pedido
  onClose: () => void
  onUpdate: () => void
}) {
  const [tanques,   setTanques]   = useState<Tanque[]>([])
  const [updates,   setUpdates]   = useState<OrderUpdate[]>([])
  const [readings,  setReadings]  = useState<SensorReading[]>([])
  const [loadingT,  setLoadingT]  = useState(true)
  const [loadingU,  setLoadingU]  = useState(true)
  const [loadingR,  setLoadingR]  = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [success,   setSuccess]   = useState<string | null>(null)

  // Form asignar tanque (ya no es UUID manual — se clickea del selector)
  const [tanqueSeleccionado, setTanqueSeleccionado] = useState<string>(pedido.tank_id ?? '')

  // Form cambiar status
  const [nuevoStatus, setNuevoStatus] = useState(pedido.status)

  // Form agregar update
  const [updateStage,  setUpdateStage]  = useState('confirmed')
  const [updateMsg,    setUpdateMsg]    = useState('')
  const [updateImgUrl, setUpdateImgUrl] = useState('')

  useEffect(() => {
    void Promise.all([
      cargarTodosLosTanques().then(t => { setTanques(t); setLoadingT(false) }),
      cargarUpdates(pedido.type, pedido.id).then(u => { setUpdates(u); setLoadingU(false) }),
    ])
    // Si hay tanque asignado, cargar readings inmediatamente
    if (pedido.tank_id) {
      setLoadingR(true)
      cargarReadings(pedido.tank_id, 30)
        .then(r => setReadings(r))
        .catch(e => console.error('cargarReadings error:', e))
        .finally(() => setLoadingR(false))
    }
  }, [pedido.type, pedido.id, pedido.tank_id])

  function flash(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  // Acción 1: cambiar status
  async function handleCambiarStatus(e: FormEvent) {
    e.preventDefault()
    if (nuevoStatus === pedido.status) return
    setSaving(true); setError(null)
    try {
      await actualizarStatus(pedido.type, pedido.id, nuevoStatus)
      flash(`Estado cambiado a "${STATUS_LABELS[nuevoStatus] ?? nuevoStatus}"`)
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando estado')
    } finally {
      setSaving(false)
    }
  }

  // Acción 2: asignar tanque via order_tank_assignments
  async function handleAsignarTanque(tankId: string) {
    if (!tankId) { setError('Selecciona un tanque para asignar'); return }
    setSaving(true); setError(null)
    try {
      await asignarTanque(pedido.type, pedido.id, tankId)
      setTanqueSeleccionado(tankId)
      flash('Tanque asignado correctamente')
      // Recargar readings del tanque recién asignado
      setLoadingR(true)
      cargarReadings(tankId, 30)
        .then(r => setReadings(r))
        .catch(e => console.error('cargarReadings error:', e))
        .finally(() => setLoadingR(false))
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error asignando tanque')
    } finally {
      setSaving(false)
    }
  }

  // Acción 3: insertar update
  async function handleAgregarUpdate(e: FormEvent) {
    e.preventDefault()
    if (!updateMsg.trim()) { setError('Escribe un mensaje para el update'); return }
    const user = getStoredUser()
    setSaving(true); setError(null)
    try {
      await insertarUpdate({
        order_type: pedido.type,
        order_id:   pedido.id,
        stage:      updateStage,
        message:    updateMsg.trim(),
        image_url:  updateImgUrl.trim() || null,
        posted_by:  user?.email ?? 'equipo',
      })
      setUpdateMsg('')
      setUpdateImgUrl('')
      const fresh = await cargarUpdates(pedido.type, pedido.id)
      setUpdates(fresh)
      flash('Update registrado')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando update')
    } finally {
      setSaving(false)
    }
  }

  // Calcular last reading para display grande
  const lastReading = readings.length > 0 ? readings[readings.length - 1] : null
  const last10 = readings.slice(-10).reverse()

  // Extraer arrays de valores para sparklines (las 9 lecturas Tuya + brix legacy)
  const phValues       = readings.map(r => r.ph           ?? 0).filter(v => v > 0)
  const tempValues     = readings.map(r => r.temp_c       ?? 0).filter(v => v > 0)
  const orpValues      = readings.map(r => r.orp_mv       ?? 0).filter(v => v !== 0)
  const sgValues       = readings.map(r => r.sg           ?? 0).filter(v => v > 0)
  const tdsValues      = readings.map(r => r.tds_ppm      ?? 0).filter(v => v > 0)
  const ecValues       = readings.map(r => r.ec_us_cm     ?? 0).filter(v => v > 0)
  const salValues      = readings.map(r => r.salinity_ppm ?? 0).filter(v => v > 0)
  const cfValues       = readings.map(r => r.cf           ?? 0).filter(v => v > 0)
  const rhValues       = readings.map(r => r.rh_pct       ?? 0).filter(v => v > 0)

  // Tank name activo (puede ser del selector o del pedido)
  const activeTankName = tanques.find(t => t.id === (tanqueSeleccionado || pedido.tank_id))?.name

  return (
    <div
      className="pcl-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle pedido ${pedido.id}`}
    >
      <div className="pcl-modal" onClick={e => e.stopPropagation()}>
        {/* Header modal */}
        <div className="pcl-modal-header">
          <div className="pcl-modal-title-row">
            <span className={`pcl-type-badge pcl-type-badge--${pedido.type}`}>
              {pedido.type === 'fb' ? 'Forward Booking' : 'CraftLab'}
            </span>
            <span className={`pcl-badge ${badgeClass(pedido.status)}`}>
              {statusIcon(pedido.status)} {STATUS_LABELS[pedido.status] ?? pedido.status}
            </span>
          </div>
          <h2 className="pcl-modal-id">{pedido.id}</h2>
          <p className="pcl-modal-meta">
            {pedido.user_email} · {formatDate(pedido.created_at)}
          </p>
          <button
            className="pcl-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info básica */}
        <section className="pcl-modal-section">
          <h3>Detalles del pedido</h3>
          <div className="pcl-data-grid">
            <DataCell label="Variedad"    value={pedido.variety} />
            <DataCell label="Proceso"     value={pedido.process} />
            <DataCell label="Kg"          value={pedido.total_kg > 0 ? `${pedido.total_kg} kg` : '—'} />
            <DataCell label="Tanque"      value={activeTankName ?? pedido.tank_name} />
            {pedido.notes && <DataCell label="Notas" value={pedido.notes} span={2} />}
          </div>
        </section>

        {/* ── SECCIÓN ACCIONES ─────────────────────────────────────────────── */}

        {/* Acción 1: Cambiar estado */}
        <section className="pcl-modal-section">
          <h3>
            <CheckCircle2 size={14} strokeWidth={2} /> Cambiar estado
          </h3>
          <form onSubmit={handleCambiarStatus} className="pcl-action-form">
            <select
              value={nuevoStatus}
              onChange={e => setNuevoStatus(e.target.value)}
              className="pcl-select"
              aria-label="Nuevo estado"
            >
              {[...STATUS_ORDER, 'cancelled' as const].map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
              ))}
            </select>
            <button
              type="submit"
              className="pcl-btn pcl-btn--primary"
              disabled={saving || nuevoStatus === pedido.status}
            >
              {saving ? <Loader2 className="spin" size={14} /> : null}
              Aplicar estado
            </button>
          </form>
        </section>

        {/* Acción 2: Asignar tanque */}
        <section className="pcl-modal-section">
          <h3>
            <Beaker size={14} strokeWidth={2} /> Asignar tanque
          </h3>
          <p className="pcl-hint">
            Selecciona el tanque que fermentará este pedido. Se registra en{' '}
            <code>order_tank_assignments</code> y libera el anterior si hubiera uno activo.
          </p>
          {loadingT ? (
            <div className="pcl-mini-loading"><Loader2 className="spin" size={16} /> Cargando tanques…</div>
          ) : tanques.length === 0 ? (
            <p className="pcl-hint">No hay tanques registrados en la base de datos.</p>
          ) : (
            <div className="pcl-tanques-grid pcl-tanques-grid--open">
              {tanques.map(t => {
                const isActive = t.id === (tanqueSeleccionado || pedido.tank_id)
                const isBusy = t.status !== 'available' && !isActive
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={[
                      'pcl-tanque-chip',
                      isBusy   ? 'pcl-tanque-chip--busy'   : '',
                      isActive ? 'pcl-tanque-chip--active'  : '',
                    ].join(' ').trim()}
                    title={`${t.name} — ${t.status}${t.capacity_kg ? ` — ${t.capacity_kg} kg` : ''}`}
                    disabled={saving || isBusy}
                    onClick={() => void handleAsignarTanque(t.id)}
                    aria-label={`Asignar tanque ${t.name}`}
                  >
                    {t.name}
                    <small>{isActive ? 'asignado' : t.status}</small>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Acción 3: Agregar update */}
        <section className="pcl-modal-section">
          <h3>
            <MessageSquarePlus size={14} strokeWidth={2} /> Agregar update
          </h3>
          <form onSubmit={handleAgregarUpdate} className="pcl-update-form">
            <div className="pcl-update-row">
              <div className="pcl-field">
                <label htmlFor="update-stage">Etapa</label>
                <select
                  id="update-stage"
                  className="pcl-select"
                  value={updateStage}
                  onChange={e => setUpdateStage(e.target.value)}
                >
                  {[...STATUS_ORDER, 'cancelled' as const].map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>
              <div className="pcl-field pcl-field--grow">
                <label htmlFor="update-img">URL imagen (opcional)</label>
                <div className="pcl-img-row">
                  <Image size={14} className="pcl-img-icon" />
                  <input
                    id="update-img"
                    type="url"
                    className="pcl-input"
                    placeholder="https://…"
                    value={updateImgUrl}
                    onChange={e => setUpdateImgUrl(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="pcl-field">
              <label htmlFor="update-msg">Mensaje *</label>
              <textarea
                id="update-msg"
                className="pcl-textarea"
                rows={3}
                placeholder="Describe el avance, observación o acción realizada…"
                value={updateMsg}
                onChange={e => setUpdateMsg(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="pcl-btn pcl-btn--primary"
              disabled={saving || !updateMsg.trim()}
            >
              {saving
                ? <><Loader2 className="spin" size={14} /> Guardando…</>
                : <><Send size={14} /> Registrar update</>}
            </button>
          </form>
        </section>

        {/* ── SECCIÓN CÓMO VA EL PROCESO ───────────────────────────────────── */}

        <section className="pcl-modal-section">
          <h3>
            <Activity size={14} strokeWidth={2} /> Cómo va el proceso
          </h3>

          {/* Subsección A — Status history */}
          <div className="pcl-proceso-block">
            <div className="pcl-proceso-block-title">Estado actual</div>
            <div className="pcl-status-history">
              <span className={`pcl-badge ${badgeClass(pedido.status)}`}>
                {statusIcon(pedido.status)} {STATUS_LABELS[pedido.status] ?? pedido.status}
              </span>
              <p className="pcl-hint pcl-hint--inline">
                El histórico de cambios de estado estará disponible cuando agreguemos el trigger de auditoría.
              </p>
            </div>
          </div>

          {/* Subsección B — Curvas de fermentación */}
          <div className="pcl-proceso-block">
            <div className="pcl-proceso-block-title">
              Curvas de fermentación
              {activeTankName && (
                <span className="pcl-tank-chip pcl-tank-chip--sm">{activeTankName}</span>
              )}
            </div>

            {!pedido.tank_id && !tanqueSeleccionado ? (
              <div className="pcl-proceso-empty">
                <Beaker size={20} strokeWidth={1.4} />
                <span>Sin tanque asignado — asigna un tanque para ver las curvas de fermentación.</span>
              </div>
            ) : loadingR ? (
              <div className="pcl-mini-loading"><Loader2 className="spin" size={14} /> Cargando lecturas…</div>
            ) : readings.length === 0 ? (
              <div className="pcl-proceso-empty">
                <Activity size={20} strokeWidth={1.4} />
                <span>El tanque aún no tiene lecturas de sensor registradas.</span>
              </div>
            ) : (
              <>
                {/* Last reading — 9 datos del monitor Tuya */}
                {lastReading && (
                  <div className="pcl-last-reading pcl-last-reading--grid9">
                    <div className="pcl-reading-card pcl-reading-card--ph">
                      <div className="pcl-reading-icon"><Droplets size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.ph?.toFixed(2) ?? '—'}</div>
                      <div className="pcl-reading-label">pH</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--temp">
                      <div className="pcl-reading-icon"><ThermometerSun size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.temp_c?.toFixed(1) ?? '—'}</div>
                      <div className="pcl-reading-label">Temp °C</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--orp">
                      <div className="pcl-reading-icon"><Zap size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.orp_mv != null ? Math.round(lastReading.orp_mv) : '—'}</div>
                      <div className="pcl-reading-label">ORP mV</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--sg">
                      <div className="pcl-reading-icon"><FlaskConical size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.sg?.toFixed(3) ?? '—'}</div>
                      <div className="pcl-reading-label">Densidad SG</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--tds">
                      <div className="pcl-reading-icon"><Activity size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.tds_ppm != null ? Math.round(lastReading.tds_ppm) : '—'}</div>
                      <div className="pcl-reading-label">TDS ppm</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--ec">
                      <div className="pcl-reading-icon"><Zap size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.ec_us_cm != null ? Math.round(lastReading.ec_us_cm) : '—'}</div>
                      <div className="pcl-reading-label">EC µS/cm</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--sal">
                      <div className="pcl-reading-icon"><Waves size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.salinity_ppm != null ? Math.round(lastReading.salinity_ppm) : '—'}</div>
                      <div className="pcl-reading-label">Salinidad ppm</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--cf">
                      <div className="pcl-reading-icon"><Hash size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.cf?.toFixed(2) ?? '—'}</div>
                      <div className="pcl-reading-label">CF</div>
                    </div>
                    <div className="pcl-reading-card pcl-reading-card--rh">
                      <div className="pcl-reading-icon"><Wind size={14} /></div>
                      <div className="pcl-reading-value">{lastReading.rh_pct?.toFixed(1) ?? '—'}</div>
                      <div className="pcl-reading-label">Humedad %</div>
                    </div>
                  </div>
                )}

                {/* Sparklines — las 9 lecturas del monitor Tuya */}
                <div className="pcl-sparklines-row">
                  {phValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#A8327E' }}>pH</span>
                      <Sparkline values={phValues} color="#A8327E" />
                      <span className="pcl-sparkline-range">
                        {Math.min(...phValues).toFixed(2)} – {Math.max(...phValues).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {tempValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#C46A3C' }}>Temp</span>
                      <Sparkline values={tempValues} color="#C46A3C" />
                      <span className="pcl-sparkline-range">
                        {Math.min(...tempValues).toFixed(1)} – {Math.max(...tempValues).toFixed(1)} °C
                      </span>
                    </div>
                  )}
                  {orpValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#6B5B95' }}>ORP</span>
                      <Sparkline values={orpValues} color="#6B5B95" />
                      <span className="pcl-sparkline-range">
                        {Math.round(Math.min(...orpValues))} – {Math.round(Math.max(...orpValues))} mV
                      </span>
                    </div>
                  )}
                  {sgValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#8B6F47' }}>SG</span>
                      <Sparkline values={sgValues} color="#8B6F47" />
                      <span className="pcl-sparkline-range">
                        {Math.min(...sgValues).toFixed(3)} – {Math.max(...sgValues).toFixed(3)}
                      </span>
                    </div>
                  )}
                  {tdsValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#2E7D8C' }}>TDS</span>
                      <Sparkline values={tdsValues} color="#2E7D8C" />
                      <span className="pcl-sparkline-range">
                        {Math.round(Math.min(...tdsValues))} – {Math.round(Math.max(...tdsValues))} ppm
                      </span>
                    </div>
                  )}
                  {ecValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#1D6FA5' }}>EC</span>
                      <Sparkline values={ecValues} color="#1D6FA5" />
                      <span className="pcl-sparkline-range">
                        {Math.round(Math.min(...ecValues))} – {Math.round(Math.max(...ecValues))} µS/cm
                      </span>
                    </div>
                  )}
                  {salValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#5A8A8C' }}>Salinidad</span>
                      <Sparkline values={salValues} color="#5A8A8C" />
                      <span className="pcl-sparkline-range">
                        {Math.round(Math.min(...salValues))} – {Math.round(Math.max(...salValues))} ppm
                      </span>
                    </div>
                  )}
                  {cfValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#B89770' }}>CF</span>
                      <Sparkline values={cfValues} color="#B89770" />
                      <span className="pcl-sparkline-range">
                        {Math.min(...cfValues).toFixed(2)} – {Math.max(...cfValues).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {rhValues.length >= 2 && (
                    <div className="pcl-sparkline-block">
                      <span className="pcl-sparkline-label" style={{ color: '#6BA89A' }}>Humedad</span>
                      <Sparkline values={rhValues} color="#6BA89A" />
                      <span className="pcl-sparkline-range">
                        {Math.min(...rhValues).toFixed(1)} – {Math.max(...rhValues).toFixed(1)} %
                      </span>
                    </div>
                  )}
                </div>

                {/* Tabla últimas 10 lecturas — 9 datos Tuya */}
                <div className="pcl-readings-table-wrap">
                  <table className="pcl-readings-table">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>pH</th>
                        <th>°C</th>
                        <th>ORP</th>
                        <th>SG</th>
                        <th>TDS</th>
                        <th>EC</th>
                        <th>Sal.</th>
                        <th>CF</th>
                        <th>RH%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {last10.map(r => (
                        <tr key={r.id}>
                          <td>{formatDateTime(r.recorded_at)}</td>
                          <td>{r.ph?.toFixed(2) ?? '—'}</td>
                          <td>{r.temp_c?.toFixed(1) ?? '—'}</td>
                          <td>{r.orp_mv != null ? Math.round(r.orp_mv) : '—'}</td>
                          <td>{r.sg?.toFixed(3) ?? '—'}</td>
                          <td>{r.tds_ppm != null ? Math.round(r.tds_ppm) : '—'}</td>
                          <td>{r.ec_us_cm != null ? Math.round(r.ec_us_cm) : '—'}</td>
                          <td>{r.salinity_ppm != null ? Math.round(r.salinity_ppm) : '—'}</td>
                          <td>{r.cf?.toFixed(2) ?? '—'}</td>
                          <td>{r.rh_pct?.toFixed(1) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── HISTORIAL DE UPDATES ──────────────────────────────────────────── */}

        {(updates.length > 0 || loadingU) && (
          <section className="pcl-modal-section">
            <h3>Historial de updates</h3>
            {loadingU ? (
              <div className="pcl-mini-loading"><Loader2 className="spin" size={14} /> Cargando…</div>
            ) : (
              <div className="pcl-updates-list">
                {updates.map(u => (
                  <div key={u.id} className="pcl-update-item">
                    <div className="pcl-update-meta">
                      <span className={`pcl-badge ${badgeClass(u.stage)}`}>
                        {statusIcon(u.stage)} {STATUS_LABELS[u.stage] ?? u.stage}
                      </span>
                      <span className="pcl-update-who">{u.posted_by}</span>
                      <span className="pcl-update-date">{formatDate(u.created_at)}</span>
                    </div>
                    <p className="pcl-update-msg">{u.message}</p>
                    {u.image_url && (
                      <a
                        href={u.image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pcl-update-img-link"
                      >
                        <Image size={12} /> Ver imagen
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mensajes feedback */}
        {error && (
          <div className="pcl-error-inline" role="alert">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {success && (
          <div className="pcl-success-inline" role="status">
            <CheckCircle2 size={14} /> {success}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DataCell helper ──────────────────────────────────────────────────────────

function DataCell({
  label,
  value,
  span,
}: {
  label: string
  value?: string
  span?: number
}) {
  return (
    <div className={`pcl-data-cell ${span === 2 ? 'span-2' : ''}`}>
      <div className="pcl-data-label">{label}</div>
      <div className="pcl-data-value">{value || '—'}</div>
    </div>
  )
}
