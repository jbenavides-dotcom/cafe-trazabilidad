import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, RefreshCw, Beaker, FlaskConical, ChevronRight, CheckCircle2 } from 'lucide-react'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import { origenDeBache } from '../lib/trazabilidad'
import './AnalisisLista.css'

type Tipo = 'fisico' | 'sensorial'

interface Item {
  numero: string
  variedad: string
  proceso: string
  proveedor: string
  origen: string
  kg: string
  estado: string
  af_done: boolean
  as_estado: string  // '' | 'APROBADO' | 'RECHAZADO' | (algo escrito sin estado)
  sca: string
}

interface Props { tipo: Tipo }

export default function AnalisisLista({ tipo }: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verTodos, setVerTodos] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'CFF!A5:L200',
        'AF!A2:Z200',
        'AS!B2:T200',
      ])
      const cff = data['CFF!A5:L200']
      const af = data['AF!A2:Z200']
      const asRows = data['AS!B2:T200']

      // Set de códigos con AF llenado (col J Humedad como proxy de "tiene datos")
      const afDone = new Set(
        af.filter(r => r[0]?.trim() && r[0] !== '#N/A' && r[9])
          .map(r => r[0].trim())
      )

      // Map de AS por bache → estado + sca
      const asMap = new Map<string, { estado: string; sca: string }>()
      for (const r of asRows) {
        const batch = r[0]?.trim()
        if (!batch) continue
        asMap.set(batch, { estado: (r[18] || '').trim(), sca: r[14] || '' })
      }

      const list: Item[] = cff
        .filter(r => r[3] && r[3] !== '#')
        .map(r => {
          const numero = r[3] || ''
          const proveedor = r[4] || ''
          const as_data = asMap.get(numero)
          return {
            numero,
            proveedor,
            variedad: r[8] || '',
            proceso: r[7] || '',
            kg: r[9] || '',
            estado: r[11] || '',
            origen: origenDeBache(numero, proveedor),
            af_done: afDone.has(numero),
            as_estado: as_data?.estado || '',
            sca: as_data?.sca || '',
          }
        })
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  // Filtros según tipo
  const pendientes = items.filter(it => {
    if (tipo === 'fisico') {
      // Pendiente: estado "Entregado a Analisis" y aún no tiene AF
      return it.estado === 'Entregado a Analisis' && !it.af_done
    } else {
      // Pendiente: tiene AF pero no tiene estado AS APROBADO/RECHAZADO
      return it.af_done && it.as_estado !== 'APROBADO' && it.as_estado !== 'RECHAZADO'
    }
  })

  const completados = items.filter(it => {
    if (tipo === 'fisico') return it.af_done
    return it.as_estado === 'APROBADO' || it.as_estado === 'RECHAZADO'
  })

  const config = tipo === 'fisico'
    ? {
        title: 'Análisis Físico',
        subtitle: 'Humedad, mallas (criba), defectos, excelso final',
        Icon: Beaker,
        toneClass: 'tone-fisico',
        rutaPendiente: (b: string) => `/baches/${b}/fisico`,
        rutaCompletado: (b: string) => `/baches/${b}`,
        emptyMsg: 'No hay baches pendientes de análisis físico. Cambia un bache a «Entregado a Analisis» en CFF para que aparezca aquí.',
        ctaPendiente: 'Hacer análisis físico',
        ctaCompletado: 'Ver ficha',
      }
    : {
        title: 'Análisis Sensorial',
        subtitle: '10 atributos SCA, perfil, decisión APROBADO/RECHAZADO',
        Icon: FlaskConical,
        toneClass: 'tone-sensorial',
        rutaPendiente: (b: string) => `/baches/${b}/sensorial`,
        rutaCompletado: (b: string) => `/baches/${b}`,
        emptyMsg: 'No hay baches pendientes de análisis sensorial. Primero hay que completar el análisis físico.',
        ctaPendiente: 'Catar bache',
        ctaCompletado: 'Ver ficha',
      }

  const lista = verTodos ? items : pendientes
  const Icon = config.Icon

  return (
    <div className={`analisis-lista ${config.toneClass}`}>
      <div className="al-header">
        <div>
          <h1><Icon size={26} /> {config.title}</h1>
          <p className="al-subtitle">{config.subtitle}</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <div className="al-stats card">
        <div className="al-stat">
          <div className="al-stat-num">{pendientes.length}</div>
          <div className="al-stat-label">Pendientes</div>
        </div>
        <div className="al-stat">
          <div className="al-stat-num">{completados.length}</div>
          <div className="al-stat-label">Completados</div>
        </div>
        <div className="al-stat">
          <div className="al-stat-num">{items.length}</div>
          <div className="al-stat-label">Total CFF</div>
        </div>
      </div>

      <div className="al-tabs">
        <button
          className={`al-tab ${!verTodos ? 'active' : ''}`}
          onClick={() => setVerTodos(false)}
        >Pendientes ({pendientes.length})</button>
        <button
          className={`al-tab ${verTodos ? 'active' : ''}`}
          onClick={() => setVerTodos(true)}
        >Todos los baches ({items.length})</button>
      </div>

      {loading && <div className="al-loading"><Loader2 className="spin" size={28} /></div>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && lista.length === 0 && !verTodos && (
        <div className="al-empty card">
          <CheckCircle2 size={32} />
          <p>{config.emptyMsg}</p>
        </div>
      )}

      {!loading && !error && lista.length > 0 && (
        <div className="al-rows">
          {lista.map(it => {
            const completado = tipo === 'fisico' ? it.af_done : (it.as_estado === 'APROBADO' || it.as_estado === 'RECHAZADO')
            const ruta = completado ? config.rutaCompletado(it.numero) : config.rutaPendiente(it.numero)
            return (
              <Link
                key={it.numero}
                to={ruta}
                className={`al-row card ${completado ? 'completado' : ''}`}
              >
                <div className="al-row-numero">
                  <strong>{it.numero}</strong>
                  <small>{it.origen}</small>
                </div>
                <div className="al-row-vp">
                  <strong>{it.variedad}</strong>
                  <small>{it.proceso}</small>
                </div>
                <div className="al-row-kg">
                  <strong>{it.kg}</strong>
                  <small>kg cereza</small>
                </div>
                <div className="al-row-status">
                  {tipo === 'fisico' && (it.af_done
                    ? <span className="badge badge-aprobado">AF ✓</span>
                    : <span className="badge badge-analisis">Pendiente</span>)}
                  {tipo === 'sensorial' && (
                    it.as_estado === 'APROBADO' ? <span className="badge badge-aprobado">APR · {it.sca}</span> :
                    it.as_estado === 'RECHAZADO' ? <span className="badge badge-rechazado">RECH</span> :
                    it.af_done ? <span className="badge badge-analisis">Listo para catar</span> :
                    <span className="badge badge-proceso">Espera AF</span>
                  )}
                </div>
                <div className="al-row-cta">
                  <span>{completado ? config.ctaCompletado : config.ctaPendiente}</span>
                  <ChevronRight size={18} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
