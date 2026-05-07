import { type FormEvent, useEffect, useState } from 'react'
import { ShoppingBag, Loader2, RefreshCw, Search, X, AlertCircle, CheckCircle2, Send } from 'lucide-react'
import { batchGet, OFFERINGLIST_ID } from '../lib/sheets'
import { despacharNanolote, type DespachoResult } from '../lib/trazabilidad'
import { registrarEvento } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './Ventas.css'

interface Nanolote {
  fila: number
  code: string
  status: string
  variety: string
  process: string
  provider: string
  total_excelso: number
  total_salidas: number
  kg_disp: number
  tasting_score: string
  macroprofile: string
  profile: string
}

export default function Ventas() {
  const [items, setItems] = useState<Nanolote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Nanolote | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(OFFERINGLIST_ID, ['PT!A4:Y100'])
      const rows = data['PT!A4:Y100']
      const list: Nanolote[] = []
      // Header en R4 (índice 0). Datos desde R5 (índice 1)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const code = (row[2] || '').trim()
        if (!code || !code.startsWith('PTNL')) continue
        const total_excelso = parseFloat((row[9] || '0').replace(',', '.'))
        const total_salidas = parseFloat((row[10] || '0').replace(',', '.'))
        const kg_disp = total_excelso - total_salidas
        if (kg_disp <= 0) continue   // sin stock disponible
        list.push({
          fila: i + 4,  // R4 + offset
          code,
          status: row[3] || '',
          variety: row[5] || '',
          process: row[6] || '',
          provider: row[7] || '',
          total_excelso,
          total_salidas,
          kg_disp,
          tasting_score: row[16] || '',
          macroprofile: row[21] || '',
          profile: row[22] || '',
        })
      }
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando OfferingList')
    } finally {
      setLoading(false)
    }
  }

  const filtered = items.filter(it => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    return (
      it.code.toLowerCase().includes(q) ||
      it.variety.toLowerCase().includes(q) ||
      it.process.toLowerCase().includes(q) ||
      it.profile.toLowerCase().includes(q) ||
      it.macroprofile.toLowerCase().includes(q)
    )
  })

  return (
    <div className="ventas">
      <div className="vt-header">
        <div>
          <h1><ShoppingBag size={26} /> Ventas / Despachos</h1>
          <p className="vt-subtitle">
            Catálogo activo (OfferingList) — {items.length} nanolote{items.length !== 1 ? 's' : ''} disponible{items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="vt-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Buscar por código, variedad, proceso, perfil…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
      </div>

      {loading && <div className="vt-loading"><Loader2 className="spin" size={28} /></div>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="vt-empty card">
          {items.length === 0
            ? 'No hay nanolotes disponibles en OfferingList.'
            : 'Ningún nanolote coincide con la búsqueda.'}
        </div>
      )}

      <div className="vt-grid">
        {filtered.map(it => (
          <NanoloteCard key={it.code} n={it} onClick={() => setSeleccionado(it)} />
        ))}
      </div>

      {seleccionado && (
        <DespachoModal
          n={seleccionado}
          onClose={() => setSeleccionado(null)}
          onSuccess={() => {
            setSeleccionado(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

function NanoloteCard({ n, onClick }: { n: Nanolote; onClick: () => void }) {
  return (
    <button className="nanolote-card card" onClick={onClick}>
      <div className="nc-header">
        <div className="nc-code">{n.code}</div>
        {n.tasting_score && <span className="nc-score">SCA {n.tasting_score}</span>}
      </div>
      <div className="nc-vp">
        <strong>{n.variety}</strong>
        <span> · {n.process}</span>
      </div>
      <div className="nc-stock">
        <div className="nc-kg">
          <span className="nc-kg-num">{n.kg_disp.toFixed(1)}</span>
          <span className="nc-kg-unit">kg disp</span>
        </div>
        {n.total_salidas > 0 && (
          <small className="nc-vendido">{n.total_salidas.toFixed(1)} kg ya vendidos / {n.total_excelso.toFixed(1)} total</small>
        )}
      </div>
      {n.macroprofile && (
        <div className="nc-perfil">
          <em>{n.macroprofile}</em>
          {n.profile && <small>{n.profile}</small>}
        </div>
      )}
      <div className="nc-cta">
        <Send size={14} /> Despachar
      </div>
    </button>
  )
}

function DespachoModal({
  n,
  onClose,
  onSuccess,
}: {
  n: Nanolote
  onClose: () => void
  onSuccess: () => void
}) {
  const [cliente, setCliente] = useState('')
  const [kg, setKg] = useState<string>(n.kg_disp.toString())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<DespachoResult | null>(null)

  const kg_num = parseFloat(kg) || 0
  const tipo: 'parcial' | 'total' | 'invalido' =
    kg_num <= 0 ? 'invalido' :
    kg_num > n.kg_disp + 0.01 ? 'invalido' :
    Math.abs(kg_num - n.kg_disp) < 0.01 ? 'total' : 'parcial'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (tipo === 'invalido') return
    if (!cliente.trim()) {
      setError('Indica el cliente (o "interno", "muestra", etc.)')
      return
    }
    if (!confirm(
      tipo === 'total'
        ? `¿Despacho TOTAL del nanolote ${n.code} (${kg_num} kg) a "${cliente}"?\n\nEsto BORRA la fila de OfferingList.`
        : `¿Despacho PARCIAL de ${kg_num} kg de ${n.code} a "${cliente}"?\n\nQuedarán ${(n.kg_disp - kg_num).toFixed(2)} kg disponibles.`
    )) return

    setEnviando(true)
    setError(null)
    try {
      const result = await despacharNanolote(n.code, kg_num)
      registrarEvento({
        tipo: result.tipo === 'total' ? 'venta_total' : 'venta_parcial',
        bache: n.code,
        detalle: `${kg_num} kg → ${cliente} · OL en ${(result.ms_total / 1000).toFixed(2)}s`,
        despues: result.tipo === 'total' ? 'fila eliminada' : `${result.kg_disponibles_despues} kg restantes`,
        usuario: getStoredUser(),
      })
      setResultado(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error en el despacho')
    } finally {
      setEnviando(false)
    }
  }

  if (resultado) {
    return (
      <div className="vt-modal-overlay" onClick={onClose}>
        <div className="vt-modal vt-modal-success" onClick={e => e.stopPropagation()}>
          <CheckCircle2 size={48} />
          <h2>¡Despacho registrado!</h2>
          <p>
            {resultado.tipo === 'total'
              ? `Fila de ${n.code} eliminada de OfferingList.`
              : `Stock de ${n.code} actualizado: ${resultado.kg_disponibles_despues.toFixed(2)} kg restantes.`}
          </p>
          <div className="vt-result-meta">
            Aplicado en <strong>{(resultado.ms_total / 1000).toFixed(2)}s</strong>
          </div>
          <div className="vt-result-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Recuerda actualizar Seguimiento Inventarios</strong>
              <p>
                Cambia el estado del nanolote <code>{n.code}</code> a{' '}
                <strong>{resultado.tipo === 'total' ? 'DESPACHADO' : 'DESPACHADO PARCIAL'}</strong>
                {' '}manualmente en el archivo Excel <em>Seguimiento Inventarios Internos</em>
                {' '}(la app no puede editar archivos .xlsx directamente).
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={onSuccess}>
            Continuar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal" onClick={e => e.stopPropagation()}>
        <button className="vt-modal-close" onClick={onClose}>
          <X size={20} />
        </button>
        <h2>Despachar {n.code}</h2>
        <div className="vt-modal-info">
          <span><strong>{n.variety}</strong> · {n.process}</span>
          {n.tasting_score && <span>SCA {n.tasting_score}</span>}
          <span>{n.kg_disp.toFixed(1)} kg disponibles</span>
        </div>

        <form onSubmit={handleSubmit} className="vt-form">
          <div className="field">
            <label>Cliente / destino</label>
            <input
              type="text"
              value={cliente}
              onChange={e => setCliente(e.target.value)}
              placeholder="Nombre del cliente, mercado, muestra…"
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label>Kg a despachar</label>
            <div className="vt-kg-row">
              <input
                type="number"
                step="0.1"
                min="0"
                max={n.kg_disp}
                value={kg}
                onChange={e => setKg(e.target.value)}
                required
              />
              <button
                type="button"
                className="vt-quick-total"
                onClick={() => setKg(n.kg_disp.toString())}
                title={`Vender los ${n.kg_disp.toFixed(1)} kg disponibles`}
              >
                Todo ({n.kg_disp.toFixed(1)})
              </button>
            </div>
          </div>

          <div className={`vt-tipo-badge tipo-${tipo}`}>
            {tipo === 'total' && (
              <>
                <Send size={16} />
                <span>DESPACHO TOTAL — la fila se eliminará de OfferingList</span>
              </>
            )}
            {tipo === 'parcial' && (
              <>
                <Send size={16} />
                <span>DESPACHO PARCIAL — quedarán {(n.kg_disp - kg_num).toFixed(2)} kg en stock</span>
              </>
            )}
            {tipo === 'invalido' && (
              <>
                <AlertCircle size={16} />
                <span>
                  {kg_num <= 0
                    ? 'Indica una cantidad mayor a 0'
                    : `Solo hay ${n.kg_disp.toFixed(1)} kg disponibles`}
                </span>
              </>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="vt-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={enviando || tipo === 'invalido'}
            >
              {enviando
                ? <><Loader2 className="spin" size={18} /> Despachando…</>
                : <><Send size={18} /> Confirmar despacho</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
