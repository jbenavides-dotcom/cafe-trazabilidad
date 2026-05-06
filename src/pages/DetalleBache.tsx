import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Coffee, Loader2, CheckCircle2, Beaker, Send, RotateCcw, Clock } from 'lucide-react'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import { origenDeBache, cambiarEstadoBache, puedeRevertirseEstado } from '../lib/trazabilidad'
import { registrarEvento, eventosDeBache, tiempoRelativo, etiquetaTipo } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './DetalleBache.css'

interface BacheDetalle {
  fecha_entrada: string
  fecha_cosecha: string
  remision: string
  numero: string
  proveedor: string
  programa: string
  proceso: string
  variedad: string
  kg_ccf: string
  destino: string
  estado: string
  origen: string
  af: { codigo: string; humedad?: string; excelso?: string; responsable?: string } | null
  as: { sca?: string; estado?: string; perfil?: string; notas?: string; catador?: string } | null
  mxv: { nanolote?: string; combina_con?: string } | null
}

export default function DetalleBache() {
  const { numero } = useParams()
  const navigate = useNavigate()
  const [bache, setBache] = useState<BacheDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [duracionMs, setDuracionMs] = useState<number | null>(null)

  async function entregarAnalisis() {
    if (!bache) return
    if (!confirm(`¿Marcar el bache ${bache.numero} como «Entregado a Analisis»?\n\nEsto dispara la propagación a AF y AS y notifica a Sergio + Ismelda.`)) return
    const t0 = performance.now()
    setEnviando(true)
    setError(null)
    setDuracionMs(null)
    try {
      await cambiarEstadoBache(bache.numero, 'Entregado a Analisis')
      const ms = performance.now() - t0
      setDuracionMs(ms)
      registrarEvento({
        tipo: 'estado_cambiado',
        bache: bache.numero,
        antes: 'En Proceso',
        despues: 'Entregado a Analisis',
        detalle: `Cambio aplicado en ${(ms / 1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })
      setBache({ ...bache, estado: 'Entregado a Analisis' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cambiando estado')
    } finally {
      setEnviando(false)
    }
  }

  async function revertir() {
    if (!bache) return
    setEnviando(true)
    setError(null)
    setDuracionMs(null)
    try {
      const check = await puedeRevertirseEstado(bache.numero)
      if (!check.puede) {
        alert(`No se puede revertir: ${check.razon}.\n\nUna vez Sergio o Ismelda escriben en el análisis, el bache queda comprometido en esa etapa.`)
        return
      }
      if (!confirm(`¿Devolver el bache ${bache.numero} a «En Proceso»?\n\nNadie ha escrito en AF ni AS aún.`)) return
      const t0 = performance.now()
      await cambiarEstadoBache(bache.numero, 'En Proceso')
      const ms = performance.now() - t0
      setDuracionMs(ms)
      registrarEvento({
        tipo: 'estado_revertido',
        bache: bache.numero,
        antes: 'Entregado a Analisis',
        despues: 'En Proceso',
        detalle: `Reversión aplicada en ${(ms / 1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })
      setBache({ ...bache, estado: 'En Proceso' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error revirtiendo')
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => { void load() }, [numero])

  async function load() {
    if (!numero) return
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'CFF!A5:L200',
        'AF!A2:Z200',
        'AS!A2:T200',
        'MX_V!A4:X50',
      ])
      const cff = data['CFF!A5:L200'].find(r => r[3] === numero)
      if (!cff) throw new Error(`Bache ${numero} no encontrado en CFF`)

      // AF "llenado de verdad" = humedad (col J, índice 9) numérica
      // (el código aparece automático por fórmulas VLOOKUP cuando CFF cambia a "Entregado a Analisis")
      const af_row_raw = data['AF!A2:Z200'].find(r => r[0]?.trim() === numero)
      const af_row = af_row_raw && af_row_raw[9] && !isNaN(parseFloat(af_row_raw[9]))
        ? af_row_raw
        : undefined
      // AS "llenado de verdad" = primer puntaje (fragancia, col F, índice 5 desde A) numérico
      const as_row_raw = data['AS!A2:T200'].find(r => r[1]?.trim() === numero)
      const as_row = as_row_raw && as_row_raw[5] && !isNaN(parseFloat(as_row_raw[5]))
        ? as_row_raw
        : undefined
      const mxv_row = data['MX_V!A4:X50'].find(r => r[1]?.trim() === numero)

      // Determinar nanolote actual: buscar la fila summary del bloque que contiene este bache
      let nanolote_asignado: string | undefined
      if (mxv_row) {
        const idx = data['MX_V!A4:X50'].indexOf(mxv_row)
        // Buscar hacia arriba el primer summary
        for (let i = idx; i >= 0; i--) {
          const r = data['MX_V!A4:X50'][i]
          const a = (r[0] || '').trim()
          if (a && a !== 'Observaciones' && a !== 'Codigo NANOLOTE' && !a.startsWith('#')) {
            nanolote_asignado = a
            break
          }
        }
      }

      setBache({
        fecha_entrada: cff[0] || '',
        fecha_cosecha: cff[1] || '',
        remision: cff[2] || '',
        numero: cff[3] || '',
        proveedor: cff[4] || '',
        programa: cff[5] || '',
        proceso: cff[7] || '',
        variedad: cff[8] || '',
        kg_ccf: cff[9] || '',
        destino: cff[10] || '',
        estado: cff[11] || '',
        origen: origenDeBache(numero, cff[4] || ''),
        af: af_row ? {
          codigo: af_row[0] || '',
          humedad: af_row[9],
          excelso: af_row[28],
          responsable: af_row[5],
        } : null,
        as: as_row ? {
          sca: as_row[15],
          estado: as_row[19],
          perfil: as_row[17],
          notas: as_row[18],
          catador: as_row[4],
        } : null,
        mxv: mxv_row ? {
          nanolote: nanolote_asignado,
          combina_con: mxv_row[23],
        } : null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="dt-loading"><Loader2 className="spin" size={32} /></div>

  if (error || !bache) {
    return (
      <div className="dt-error card">
        <h2>No se pudo cargar</h2>
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/baches')}>Volver</button>
      </div>
    )
  }

  const stages: Stage[] = [
    {
      key: 'cff',
      label: 'CFF · Entrada',
      done: !!bache.numero,
      detail: `${bache.kg_ccf} kg cereza · ${bache.proveedor}`,
    },
    {
      key: 'analisis',
      label: 'Entregado a análisis',
      done: bache.estado === 'Entregado a Analisis' || !!bache.af,
      detail: bache.estado,
    },
    {
      key: 'af',
      label: 'AF · Análisis físico',
      done: !!bache.af,
      detail: bache.af ? `Humedad ${bache.af.humedad}% · Excelso ${bache.af.excelso}g` : '—',
    },
    {
      key: 'as',
      label: 'AS · Análisis sensorial',
      done: !!bache.as,
      detail: bache.as ? `SCA ${bache.as.sca} · ${bache.as.estado || 'pendiente'}` : '—',
      tone: bache.as?.estado === 'APROBADO' ? 'green' : bache.as?.estado === 'RECHAZADO' ? 'red' : undefined,
    },
    {
      key: 'mxv',
      label: 'MX_V · Asignado a nanolote',
      done: !!bache.mxv?.nanolote,
      detail: bache.mxv?.nanolote ?? '—',
    },
  ]

  return (
    <div className="detalle-bache">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="dt-header">
        <div>
          <h1>Bache <span className="dt-numero">{bache.numero}</span></h1>
          <p className="dt-subtitle">
            {bache.variedad} · {bache.proceso} · {bache.kg_ccf} kg ·
            <span className="dt-origen"> {bache.origen}</span>
          </p>
        </div>
        <span className={`badge ${bache.estado === 'Entregado a Analisis' ? 'badge-analisis' : 'badge-proceso'}`}>
          {bache.estado}
        </span>
      </div>

      {/* Timeline del bache */}
      <section className="card dt-timeline">
        <h2>Recorrido</h2>
        <div className="timeline">
          {stages.map((s, i) => (
            <TimelineStep key={s.key} step={s} last={i === stages.length - 1} />
          ))}
        </div>
      </section>

      {/* Datos CFF */}
      <section className="card">
        <h2>Datos de entrada (CFF)</h2>
        <DataGrid items={[
          { label: 'Fecha entrada',  value: bache.fecha_entrada },
          { label: 'Fecha cosecha',  value: bache.fecha_cosecha },
          { label: 'Remisión',       value: bache.remision },
          { label: 'Proveedor',      value: bache.proveedor },
          { label: 'Programa',       value: bache.programa },
          { label: 'Calidad',        value: 'A' },
          { label: 'Proceso',        value: bache.proceso },
          { label: 'Variedad',       value: bache.variedad },
          { label: 'KG CCF',         value: `${bache.kg_ccf} kg` },
          { label: 'Destino',        value: bache.destino },
        ]} />
      </section>

      {/* AF si existe */}
      {bache.af && (
        <section className="card">
          <h2><Beaker size={20} /> Análisis físico</h2>
          <DataGrid items={[
            { label: 'Humedad',      value: bache.af.humedad ? `${bache.af.humedad}%` : undefined },
            { label: 'Excelso',      value: bache.af.excelso ? `${bache.af.excelso} g` : undefined },
            { label: 'Responsable',  value: bache.af.responsable },
          ]} />
        </section>
      )}

      {/* AS si existe */}
      {bache.as && (
        <section className="card">
          <h2><FlaskConical size={20} /> Análisis sensorial</h2>
          <DataGrid items={[
            { label: 'SCA Total',    value: bache.as.sca, big: true },
            { label: 'Estado',       value: bache.as.estado },
            { label: 'Catador',      value: bache.as.catador },
            { label: 'Macro perfil', value: bache.as.perfil },
            { label: 'Notas',        value: bache.as.notas, span: 2 },
          ]} />
        </section>
      )}

      {/* MX_V si existe */}
      {bache.mxv?.nanolote && (
        <section className="card">
          <h2><Coffee size={20} /> Nanolote asignado</h2>
          <div className="dt-nanolote">
            <strong>{bache.mxv.nanolote}</strong>
            <small>El bache forma parte del bloque del nanolote {bache.mxv.nanolote} en MX_V</small>
          </div>
        </section>
      )}

      {/* Historial / tiempos */}
      <HistorialBache bache={bache.numero} duracionUltima={duracionMs} />

      {/* CTAs */}
      <div className="dt-actions">
        {bache.estado === 'En Proceso' && (
          <button
            className="btn btn-primary"
            onClick={entregarAnalisis}
            disabled={enviando}
          >
            {enviando
              ? <><Loader2 className="spin" size={18} /> Enviando…</>
              : <><Send size={18} /> Entregar a análisis</>}
          </button>
        )}
        {bache.estado === 'Entregado a Analisis' && !bache.af && !bache.as && (
          <button
            className="btn btn-secondary"
            onClick={revertir}
            disabled={enviando}
            title="Solo posible si nadie ha empezado AF ni AS"
          >
            {enviando
              ? <><Loader2 className="spin" size={18} /> Revirtiendo…</>
              : <><RotateCcw size={18} /> Devolver a «En Proceso»</>}
          </button>
        )}
        {bache.estado === 'Entregado a Analisis' && !bache.af && (
          <Link to={`/baches/${bache.numero}/fisico`} className="btn btn-primary">
            <Beaker size={18} /> Hacer análisis físico
          </Link>
        )}
        {bache.af && (
          <Link to={`/baches/${bache.numero}/fisico`} className="btn btn-secondary">
            <Beaker size={18} /> Editar análisis físico
          </Link>
        )}
        {bache.estado === 'Entregado a Analisis' && !bache.as && (
          <Link to={`/baches/${bache.numero}/sensorial`} className="btn btn-primary">
            <FlaskConical size={18} /> Hacer análisis sensorial
          </Link>
        )}
        {bache.as && !bache.as.estado && (
          <Link to={`/baches/${bache.numero}/sensorial`} className="btn btn-secondary">
            <FlaskConical size={18} /> Continuar análisis sensorial
          </Link>
        )}
        {bache.as?.estado === 'APROBADO' && !bache.mxv?.nanolote && (
          <Link to="/nanolotes" className="btn btn-primary">
            <Coffee size={18} /> Asignar a nanolote
          </Link>
        )}
      </div>
    </div>
  )
}

interface Stage {
  key: string
  label: string
  done: boolean
  detail: string
  tone?: 'green' | 'red'
}

function TimelineStep({ step, last }: { step: Stage; last: boolean }) {
  return (
    <div className={`timeline-step ${step.done ? 'done' : 'pending'} ${step.tone ?? ''} ${last ? 'last' : ''}`}>
      <div className="timeline-dot">
        {step.done ? <CheckCircle2 size={20} /> : <span className="dot-pending" />}
      </div>
      <div className="timeline-content">
        <div className="timeline-label">{step.label}</div>
        <div className="timeline-detail">{step.detail}</div>
      </div>
    </div>
  )
}

function DataGrid({ items }: { items: Array<{ label: string; value?: string; big?: boolean; span?: number }> }) {
  return (
    <div className="data-grid">
      {items.map((it, i) => (
        <div key={i} className={`data-cell ${it.big ? 'big' : ''} ${it.span ? `span-${it.span}` : ''}`}>
          <div className="data-label">{it.label}</div>
          <div className="data-value">{it.value || '—'}</div>
        </div>
      ))}
    </div>
  )
}

function HistorialBache({ bache, duracionUltima }: { bache: string; duracionUltima: number | null }) {
  const eventos = eventosDeBache(bache)
  if (eventos.length === 0 && duracionUltima === null) return null

  return (
    <section className="card dt-historial">
      <h2><Clock size={18} /> Historial</h2>
      {duracionUltima !== null && (
        <div className="dt-duracion-ultima">
          ⚡ Última acción aplicada en <strong>{(duracionUltima / 1000).toFixed(2)}s</strong>
        </div>
      )}
      {eventos.length > 0 && (
        <ul className="dt-eventos">
          {eventos.slice().reverse().map((e, i) => (
            <li key={i} className={`dt-evento ev-${e.tipo}`}>
              <div className="dt-evento-tipo">{etiquetaTipo(e.tipo)}</div>
              <div className="dt-evento-meta">
                <span className="dt-evento-tiempo">hace {tiempoRelativo(e.ts)}</span>
                <span className="dt-evento-usuario">· {e.usuario}</span>
                {e.detalle && <span className="dt-evento-detalle">· {e.detalle}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {eventos.length === 0 && duracionUltima === null && (
        <p className="dt-empty-hint">Aún no hay acciones registradas en este dispositivo para este bache.</p>
      )}
    </section>
  )
}
