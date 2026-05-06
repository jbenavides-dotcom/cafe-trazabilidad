import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Loader2, RefreshCw, Send, Check, Search, RotateCcw } from 'lucide-react'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import { origenDeBache, cambiarEstadoBache, puedeRevertirseEstado } from '../lib/trazabilidad'
import { registrarEvento } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './ListaBaches.css'

interface Row {
  fecha: string
  numero: string
  proveedor: string
  proceso: string
  variedad: string
  kg: string
  estado: string
  origen: string
  af: boolean
  as_estado: string
  sca: string
}

export default function ListaBaches() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [enviadoOk, setEnviadoOk] = useState<string | null>(null)

  async function entregarAnalisis(numero: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!confirm(`¿Marcar el bache ${numero} como «Entregado a Analisis»?\n\nEsto dispara la propagación a AF y AS y notifica a Sergio + Ismelda.`)) return
    const t0 = performance.now()
    setEnviando(numero)
    setError(null)
    try {
      await cambiarEstadoBache(numero, 'Entregado a Analisis')
      const ms = performance.now() - t0
      registrarEvento({
        tipo: 'estado_cambiado',
        bache: numero,
        antes: 'En Proceso',
        despues: 'Entregado a Analisis',
        detalle: `Cambio aplicado en ${(ms/1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })
      setRows(prev => prev.map(r =>
        r.numero === numero ? { ...r, estado: 'Entregado a Analisis' } : r
      ))
      setEnviadoOk(numero)
      setTimeout(() => setEnviadoOk(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cambiando estado')
    } finally {
      setEnviando(null)
    }
  }

  async function revertirEstado(numero: string, e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setEnviando(numero)
    setError(null)
    try {
      const check = await puedeRevertirseEstado(numero)
      if (!check.puede) {
        alert(`No se puede revertir: ${check.razon}.\n\nUna vez Sergio o Ismelda escriben en el análisis, el bache queda comprometido en esa etapa.`)
        return
      }
      if (!confirm(`¿Devolver el bache ${numero} a «En Proceso»?\n\nNadie ha escrito en AF ni AS aún.`)) return
      const t0 = performance.now()
      await cambiarEstadoBache(numero, 'En Proceso')
      const ms = performance.now() - t0
      registrarEvento({
        tipo: 'estado_revertido',
        bache: numero,
        antes: 'Entregado a Analisis',
        despues: 'En Proceso',
        detalle: `Reversión aplicada en ${(ms/1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })
      setRows(prev => prev.map(r =>
        r.numero === numero ? { ...r, estado: 'En Proceso' } : r
      ))
      setEnviadoOk(numero)
      setTimeout(() => setEnviadoOk(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error revirtiendo estado')
    } finally {
      setEnviando(null)
    }
  }

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'CFF!A5:L200',
        'AF!A2:J200',  // hasta J para detectar humedad llena (no solo el código propagado por fórmula)
        'AS!B2:T200',
      ])
      const cff = data['CFF!A5:L200']
      // AF "llenado" = código presente Y humedad (col J, índice 9) numérica
      // (el código por sí solo aparece por fórmulas, no significa que Sergio escribió)
      const afCodes = new Set(
        data['AF!A2:J200']
          .filter(r => r[0]?.trim() && r[0] !== '#N/A' && r[9] && !isNaN(parseFloat(r[9])))
          .map(r => r[0].trim())
      )
      const asMap = new Map<string, { estado: string; sca: string }>()
      for (const r of data['AS!B2:T200']) {
        const batch = r[0]?.trim()
        if (!batch) continue
        asMap.set(batch, { estado: r[18] || '', sca: r[14] || '' })
      }

      const list: Row[] = cff
        .filter(r => r[3] && r[3] !== '#')
        .map(r => {
          const numero = r[3] || ''
          const proveedor = r[4] || ''
          const as_data = asMap.get(numero)
          return {
            fecha: r[0] || '',
            numero,
            proveedor,
            proceso: r[7] || '',
            variedad: r[8] || '',
            kg: r[9] || '',
            estado: r[11] || '',
            origen: origenDeBache(numero, proveedor),
            af: afCodes.has(numero),
            as_estado: as_data?.estado || '',
            sca: as_data?.sca || '',
          }
        })

      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return rows.filter(r => {
      if (filter !== 'todos' && r.estado !== filter) return false
      if (!q) return true
      return (
        r.numero.toLowerCase().includes(q) ||
        r.variedad.toLowerCase().includes(q) ||
        r.proceso.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q) ||
        r.origen.toLowerCase().includes(q)
      )
    })
  }, [rows, filter, busqueda])

  return (
    <div className="lista-baches">
      <div className="lista-header">
        <div>
          <h1>Baches</h1>
          <p className="lista-subtitle">{rows.length} baches registrados en CFF</p>
        </div>
        <div className="lista-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <Link to="/baches/nuevo" className="btn btn-primary">
            <Plus size={18} /> Nuevo
          </Link>
        </div>
      </div>

      <div className="lista-toolbar">
        <div className="lista-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Buscar por #bache, variedad, proceso, proveedor…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="lista-filters">
          <button
            className={`filter-chip ${filter === 'todos' ? 'active' : ''}`}
            onClick={() => setFilter('todos')}
          >Todos ({rows.length})</button>
          <button
            className={`filter-chip ${filter === 'En Proceso' ? 'active' : ''}`}
            onClick={() => setFilter('En Proceso')}
          >En proceso ({rows.filter(r => r.estado === 'En Proceso').length})</button>
          <button
            className={`filter-chip ${filter === 'Entregado a Analisis' ? 'active' : ''}`}
            onClick={() => setFilter('Entregado a Analisis')}
          >Entregado análisis ({rows.filter(r => r.estado === 'Entregado a Analisis').length})</button>
        </div>
      </div>

      {loading && (
        <div className="lista-loading">
          <Loader2 className="spin" size={28} />
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <div className="lista-table card">
          <div className="lista-row lista-row-header">
            <div>#</div>
            <div>Variedad / Proceso</div>
            <div>Kg</div>
            <div>Origen</div>
            <div>Estado</div>
            <div>AF</div>
            <div>AS</div>
            <div>SCA</div>
            <div></div>
          </div>
          {filtered.map(r => (
            <div
              key={r.numero}
              className="lista-row lista-row-clickable"
              onClick={() => navigate(`/baches/${r.numero}`)}
              role="button"
              tabIndex={0}
            >
              <div className="lista-numero">{r.numero}</div>
              <div>
                <strong>{r.variedad}</strong>
                <br /><small>{r.proceso}</small>
              </div>
              <div>{r.kg}</div>
              <div><small>{r.origen}</small></div>
              <div>
                <span className={`badge ${r.estado === 'Entregado a Analisis' ? 'badge-analisis' : 'badge-proceso'}`}>
                  {r.estado}
                </span>
              </div>
              <div>{r.af ? '✓' : '—'}</div>
              <div>
                {r.as_estado === 'APROBADO' && <span className="badge badge-aprobado">APR</span>}
                {r.as_estado === 'RECHAZADO' && <span className="badge badge-rechazado">RECH</span>}
                {!r.as_estado && '—'}
              </div>
              <div>{r.sca || '—'}</div>
              <div className="lista-action">
                {enviadoOk === r.numero ? (
                  <span className="action-ok"><Check size={14} /> Listo</span>
                ) : r.estado === 'En Proceso' ? (
                  <button
                    className="btn-entregar"
                    onClick={e => entregarAnalisis(r.numero, e)}
                    disabled={enviando === r.numero}
                    title="Marcar como «Entregado a Analisis» (dispara AF y AS)"
                  >
                    {enviando === r.numero
                      ? <Loader2 size={14} className="spin" />
                      : <><Send size={14} /> Entregar</>}
                  </button>
                ) : r.estado === 'Entregado a Analisis' && !r.af && !r.as_estado ? (
                  <button
                    className="btn-revertir"
                    onClick={e => revertirEstado(r.numero, e)}
                    disabled={enviando === r.numero}
                    title="Devolver a «En Proceso» (solo si nadie ha empezado AF ni AS)"
                  >
                    {enviando === r.numero
                      ? <Loader2 size={14} className="spin" />
                      : <><RotateCcw size={14} /> Devolver</>}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="lista-empty">No hay baches con ese filtro</div>
          )}
        </div>
      )}
    </div>
  )
}
