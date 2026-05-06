import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { batchGet, writeRange, SHEET_2026_ID } from '../lib/sheets'
import { calcularSCATotal, clasificarSCA } from '../lib/trazabilidad'
import { registrarEvento, type EventoTipo } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './AnalisisSensorial.css'

const ATRIBUTOS = [
  { key: 'fragancia',    label: 'Fragancia y Aroma', min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'sabor',        label: 'Sabor',             min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'residual',     label: 'Residual',          min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'acidez',       label: 'Acidez',            min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'balance',      label: 'Balance',           min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'cuerpo',       label: 'Cuerpo',            min: 6, max: 10, step: 0.25, default: 8.5 },
  { key: 'uniformidad',  label: 'Uniformidad',       min: 0, max: 10, step: 2,    default: 10 },
  { key: 'taza_limpia',  label: 'Taza Limpia',       min: 0, max: 10, step: 2,    default: 10 },
  { key: 'dulzor',       label: 'Dulzor',            min: 0, max: 10, step: 2,    default: 10 },
  { key: 'global',       label: 'Global',            min: 6, max: 10, step: 0.25, default: 8.5 },
] as const

type AtributoKey = typeof ATRIBUTOS[number]['key']
type Puntajes = Record<AtributoKey, number>

const PERFILES = [
  'CITRICO-DULCE', 'FLORAL', 'CHOCOLATE', 'TROPICAL', 'CARAMELO',
  'JAZMÍN-MANDARINA', 'BERRIES-VINO', 'NUEZ-MIEL', 'OTRO',
]

export default function AnalisisSensorial() {
  const { batch } = useParams()
  const navigate = useNavigate()
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: 'numeric' })

  const initial: Puntajes = ATRIBUTOS.reduce((acc, a) => ({ ...acc, [a.key]: a.default }), {} as Puntajes)
  const [puntajes, setPuntajes] = useState<Puntajes>(initial)
  const [meta, setMeta] = useState({
    fecha: today,
    catador: 'ISMELDA',
    perfil: 'CITRICO-DULCE',
    notas: '',
    observaciones: '',
  })
  const [variedad, setVariedad] = useState('')
  const [proceso, setProceso] = useState('')
  const [estado, setEstado] = useState<'APROBADO' | 'RECHAZADO' | ''>('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rowNum, setRowNum] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const sca_total = useMemo(() => calcularSCATotal(puntajes), [puntajes])
  const clasif = useMemo(() => clasificarSCA(sca_total), [sca_total])

  // Buscar el bache en AS para precargar la fila correcta
  useEffect(() => {
    if (!batch) return
    void load()
  }, [batch])

  async function load() {
    setLoading(true)
    try {
      const data = await batchGet(SHEET_2026_ID, ['AS!A2:T200'])
      const rows = data['AS!A2:T200']
      const idx = rows.findIndex(r => r[1]?.trim() === batch)
      if (idx >= 0) {
        setRowNum(idx + 2)
        const row = rows[idx]
        // Precargar si ya hay datos
        if (row[2]) setProceso(row[2])
        if (row[3]) setVariedad(row[3])
        if (row[4]) setMeta(m => ({ ...m, catador: row[4] }))
        if (row[15]) {
          // Ya hay puntajes — precargar
          const existing: Partial<Puntajes> = {}
          ATRIBUTOS.forEach((a, i) => {
            const v = row[5 + i]
            if (v) existing[a.key] = parseFloat(v)
          })
          setPuntajes(p => ({ ...p, ...existing }))
        }
        if (row[17]) setMeta(m => ({ ...m, perfil: row[17] }))
        if (row[18]) setMeta(m => ({ ...m, notas: row[18] }))
        if (row[19]) setEstado(row[19].trim() as 'APROBADO' | 'RECHAZADO')
      } else {
        // Bache no está aún en AS — buscar fila vacía
        const firstEmpty = rows.findIndex(r => !r[1] || r[1] === '#N/A')
        setRowNum(firstEmpty >= 0 ? firstEmpty + 2 : rows.length + 2)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  function setPuntaje(k: AtributoKey, v: number) {
    setPuntajes(p => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!batch || !rowNum) return
    const t0 = performance.now()
    setSaving(true)
    setError(null)
    try {
      // Solo escribimos cols A, E-T (NO C ni D que son fórmulas VLOOKUP)
      // Estructura cols: A=fecha, B=batch, C(F), D(F), E=catador, F-O=puntajes, P=SCA total, Q=obs, R=perfil, S=notas, T=estado
      const valores = [
        meta.fecha, batch,
        // C, D no se escriben (fórmula)
      ]
      // Escribimos A1:B1 primero
      await writeRange(SHEET_2026_ID, `AS!A${rowNum}:B${rowNum}`, [valores])

      // Luego E-T (16 cols)
      const ladoDerecho = [
        meta.catador,
        puntajes.fragancia, puntajes.sabor, puntajes.residual,
        puntajes.acidez, puntajes.balance, puntajes.cuerpo,
        puntajes.uniformidad, puntajes.taza_limpia, puntajes.dulzor,
        puntajes.global,
        sca_total,
        meta.observaciones,
        meta.perfil,
        meta.notas,
        estado,
      ]
      await writeRange(SHEET_2026_ID, `AS!E${rowNum}:T${rowNum}`, [ladoDerecho])

      const ms = performance.now() - t0
      const tipo: EventoTipo =
        estado === 'APROBADO'  ? 'as_aprobado'  :
        estado === 'RECHAZADO' ? 'as_rechazado' :
                                 'as_guardado'
      registrarEvento({
        tipo,
        bache: batch,
        despues: estado || undefined,
        detalle: `SCA ${sca_total} · ${meta.perfil} · guardado en ${(ms / 1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })

      setSuccess(true)
      setTimeout(() => navigate('/baches'), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="as-loading"><Loader2 className="spin" size={32} /></div>
  }

  return (
    <div className="analisis-sensorial">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="as-header">
        <div>
          <h1>Análisis Sensorial</h1>
          <p className="as-subtitle">Bache <strong>{batch}</strong> · {variedad} {proceso}</p>
        </div>
        <div className={`sca-display sca-${clasif.tone}`}>
          <div className="sca-value">{sca_total.toFixed(2)}</div>
          <div className="sca-label">SCA Total</div>
          <div className="sca-clasif">{clasif.label}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="as-form">
        <section className="card">
          <h2>Metadata</h2>
          <div className="form-row">
            <div className="field">
              <label>Fecha</label>
              <input
                type="text"
                value={meta.fecha}
                onChange={e => setMeta({ ...meta, fecha: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Catador</label>
              <input
                type="text"
                value={meta.catador}
                onChange={e => setMeta({ ...meta, catador: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Puntajes (10 atributos · escala 6–10)</h2>
          <div className="puntajes-grid">
            {ATRIBUTOS.map(a => (
              <div key={a.key} className="puntaje-card">
                <div className="puntaje-label">{a.label}</div>
                <div className="puntaje-input-row">
                  <input
                    type="range"
                    min={a.min}
                    max={a.max}
                    step={a.step}
                    value={puntajes[a.key]}
                    onChange={e => setPuntaje(a.key, parseFloat(e.target.value))}
                    className="puntaje-slider"
                  />
                  <input
                    type="number"
                    step={a.step}
                    min={a.min}
                    max={a.max}
                    value={puntajes[a.key]}
                    onChange={e => setPuntaje(a.key, parseFloat(e.target.value) || 0)}
                    className="puntaje-number"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Perfil</h2>
          <div className="form-row">
            <div className="field">
              <label>Macro Perfil</label>
              <select
                value={meta.perfil}
                onChange={e => setMeta({ ...meta, perfil: e.target.value })}
              >
                {PERFILES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Notas / Atributos</label>
            <textarea
              rows={2}
              value={meta.notas}
              onChange={e => setMeta({ ...meta, notas: e.target.value })}
              placeholder="ej. MANDARINA-AZUCARMORENA-LIMONARIA"
            />
          </div>
          <div className="field">
            <label>Observaciones del perfil</label>
            <textarea
              rows={2}
              value={meta.observaciones}
              onChange={e => setMeta({ ...meta, observaciones: e.target.value })}
            />
          </div>
        </section>

        <section className="card decision-card">
          <h2>Decisión</h2>
          <p className="decision-hint">
            Aprobar el bache para que el v3 lo escale a MX_V (LP&ET o Mejores Vecinos según origen).
          </p>
          <div className="decision-buttons">
            <button
              type="button"
              className={`decision-btn ${estado === 'APROBADO' ? 'active aprobado' : ''}`}
              onClick={() => setEstado('APROBADO')}
            >
              <CheckCircle2 size={20} />
              <span>APROBADO</span>
              <small>Pasa a MX_V</small>
            </button>
            <button
              type="button"
              className={`decision-btn ${estado === 'RECHAZADO' ? 'active rechazado' : ''}`}
              onClick={() => setEstado('RECHAZADO')}
            >
              <XCircle size={20} />
              <span>RECHAZADO</span>
              <small>No avanza en el flujo</small>
            </button>
          </div>
        </section>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">✓ Guardado. Volviendo a la lista…</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/baches')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !estado}>
            {saving
              ? <><Loader2 className="spin" size={18} /> Guardando…</>
              : <><Save size={18} /> Guardar análisis</>}
          </button>
        </div>
      </form>
    </div>
  )
}
