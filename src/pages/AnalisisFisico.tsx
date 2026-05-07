import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { batchGet, writeRange, SHEET_2026_ID } from '../lib/sheets'
import { registrarEvento } from '../lib/eventos'
import { getStoredUser } from '../lib/auth'
import './AnalisisFisico.css'

// Mallas físicas (criba) — porcentaje retenido en cada tamiz
const MALLAS = [
  { key: 'm18',     label: 'Malla 18',  col: 'N' },
  { key: 'm17',     label: 'Malla 17',  col: 'O' },
  { key: 'm16',     label: 'Malla 16',  col: 'P' },
  { key: 'm15',     label: 'Malla 15',  col: 'Q' },
  { key: 'm14',     label: 'Malla 14',  col: 'R' },
  { key: 'm13',     label: 'Malla 13',  col: 'S' },
  { key: 'fondo',   label: 'Fondo',     col: 'T' },
] as const

type MallaKey = typeof MALLAS[number]['key']
type Mallas = Record<MallaKey, number>

// 19 defectos detallados — nombres EXACTOS del Sheet AF (cols AE-AW)
// Sí, "Decolordo" y "Ambar o mantequillo" repetido son tal cual en el Sheet
const DEFECTOS_DETALLADOS = [
  'Negro', 'Negro parcial', 'Vinagre', 'Vinagre parcial',
  'Cardenillo', 'Cristalizado', 'Decolordo veteado', 'Decolorado reposado',
  'Ambar o mantequillo', 'Sobresecado', 'Mordido o cortado', 'Broca',
  'Broca severa', 'Ambar o mantequillo (2)', 'Averanado', 'Inmaduro',
  'M. Extraña', 'Guayaba', 'FLOJO',
] as const

const COLORES = ['Verde-azulado', 'Verde', 'Verde-amarillento', 'Amarillento', 'Pálido']
const OLORES = ['Limpio', 'Limpio-fresco', 'Suave', 'Reposado', 'Defectuoso']

export default function AnalisisFisico() {
  const { batch } = useParams()
  const navigate = useNavigate()
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: 'numeric' })

  // Datos primarios (cols escribibles)
  const [meta, setMeta] = useState({
    fecha: today,
    responsable: 'SERGIO',
    olor: 'Limpio',
    color: 'Verde-azulado',
    observaciones: '',   // AD — Observaciones
  })
  const [pesos, setPesos] = useState({
    muestra_g: 0,        // G — Muestra (gr)
    almendra_g: 0,       // H — Almendra (gr)
    merma_pct: 0,        // I — Merma %
    humedad_pct: 11.0,   // J — Humedad C.V %
    caracol_g: 0,        // M — Caracol (grs)
    excelso_final: 0,    // AC — EXCELSO FINAL (gr)
  })
  const [mallas, setMallas] = useState<Mallas>(
    MALLAS.reduce((a, m) => ({ ...a, [m.key]: 0 }), {} as Mallas),
  )
  const [defectosPrimarios, setDefectosPrimarios] = useState({
    defectos_i: 0,      // U — Defectos I grupo (grs)
    defectos_ii: 0,     // V — Defectos II grupo (grs)
    broca_leve: 0,      // W — Broca leve (gr)
    broca_severa: 0,    // X — Broca severa (gr)
  })
  const [defectosDetallados, setDefectosDetallados] = useState<number[]>(
    Array(DEFECTOS_DETALLADOS.length).fill(0),
  )
  const [showDetalles, setShowDetalles] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [variedad, setVariedad] = useState('')
  const [proceso, setProceso] = useState('')
  const [rowNum, setRowNum] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Sumatoria mallas en gramos (debería igualar el peso de muestra)
  const totalMallas = useMemo(
    () => Object.values(mallas).reduce((a, b) => a + b, 0),
    [mallas],
  )
  const muestraEsperada = pesos.muestra_g || 0
  const mallasOK = muestraEsperada > 0 && Math.abs(totalMallas - muestraEsperada) < 0.5
  const sliderMax = Math.max(200, Math.ceil(muestraEsperada * 1.2))

  useEffect(() => {
    if (!batch) return
    void load()
  }, [batch])

  async function load() {
    setLoading(true)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'AF!A1:BZ1',         // headers (R1)
        'AF!A2:BZ200',       // data
      ])
      setHeaders(data['AF!A1:BZ1']?.[0] ?? [])
      const rows = data['AF!A2:BZ200']
      const idx = rows.findIndex(r => r[0]?.trim() === batch)
      if (idx >= 0) {
        setRowNum(idx + 2)
        const row = rows[idx]
        // Precargar fórmulas calculadas (read-only)
        if (row[2]) setProceso(row[2])
        if (row[3]) setVariedad(row[3])
        // Precargar campos editables si ya tienen datos
        if (row[1])  setMeta(m => ({ ...m, fecha: row[1] }))
        if (row[5])  setMeta(m => ({ ...m, responsable: row[5] }))
        if (row[10]) setMeta(m => ({ ...m, olor: row[10] }))
        if (row[11]) setMeta(m => ({ ...m, color: row[11] }))
        if (row[29]) setMeta(m => ({ ...m, observaciones: row[29] })) // AD
        setPesos({
          muestra_g:     parseFloat(row[6])  || 0,  // G
          almendra_g:    parseFloat(row[7])  || 0,  // H
          merma_pct:     parseFloat(row[8])  || 0,  // I
          humedad_pct:   parseFloat(row[9])  || 11.0, // J
          caracol_g:     parseFloat(row[12]) || 0,  // M
          excelso_final: parseFloat(row[28]) || 0,  // AC
        })
        const m: Mallas = { ...mallas }
        MALLAS.forEach((mm, i) => {
          const v = parseFloat(row[13 + i])  // N=13 ... T=19
          if (!isNaN(v)) m[mm.key] = v
        })
        setMallas(m)
        setDefectosPrimarios({
          defectos_i:   parseFloat(row[20]) || 0,  // U
          defectos_ii:  parseFloat(row[21]) || 0,  // V
          broca_leve:   parseFloat(row[22]) || 0,  // W
          broca_severa: parseFloat(row[23]) || 0,  // X
        })
        // Defectos detallados (cols AE-AW = índices 30-48)
        const det = row.slice(30, 30 + DEFECTOS_DETALLADOS.length).map(v => parseFloat(v) || 0)
        if (det.some(v => v > 0)) {
          setDefectosDetallados([
            ...det,
            ...Array(Math.max(0, DEFECTOS_DETALLADOS.length - det.length)).fill(0),
          ].slice(0, DEFECTOS_DETALLADOS.length))
        }
      } else {
        // Bache no está en AF — buscar primera fila vacía
        const firstEmpty = rows.findIndex(r => !r[0] || r[0] === '#N/A')
        setRowNum(firstEmpty >= 0 ? firstEmpty + 2 : rows.length + 2)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  function setMalla(k: MallaKey, v: number) {
    setMallas(p => ({ ...p, [k]: v }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!batch || !rowNum) return
    const t0 = performance.now()
    setSaving(true)
    setError(null)
    try {
      // ⚠️ FÓRMULAS PROTEGIDAS (no escribir nunca):
      //   C = VLOOKUP proceso, D = VLOOKUP variedad, E = FR calculado
      // Escritura segmentada (saltando fórmulas)

      // 1) A=código + B=fecha
      await writeRange(SHEET_2026_ID, `AF!A${rowNum}:B${rowNum}`,
        [[batch, meta.fecha]])

      // 2) F-M (responsable, muestra, almendra, merma, humedad, olor, color, caracol)
      //    Saltamos C, D, E que son fórmulas
      await writeRange(SHEET_2026_ID, `AF!F${rowNum}:M${rowNum}`, [[
        meta.responsable,
        pesos.muestra_g,
        pesos.almendra_g,
        pesos.merma_pct,
        pesos.humedad_pct,
        meta.olor,
        meta.color,
        pesos.caracol_g,
      ]])

      // 3) N-T (7 mallas en gramos)
      await writeRange(SHEET_2026_ID, `AF!N${rowNum}:T${rowNum}`,
        [MALLAS.map(m => mallas[m.key])])

      // 4) U-X (defectos I, II, broca leve, broca severa)
      await writeRange(SHEET_2026_ID, `AF!U${rowNum}:X${rowNum}`, [[
        defectosPrimarios.defectos_i,
        defectosPrimarios.defectos_ii,
        defectosPrimarios.broca_leve,
        defectosPrimarios.broca_severa,
      ]])
      // Y, Z, AA, AB son fórmulas (% defectos, % broca, % mallas) — NO TOCAR

      // 5) AC = Excelso final + AD = Observaciones
      await writeRange(SHEET_2026_ID, `AF!AC${rowNum}:AD${rowNum}`,
        [[pesos.excelso_final, meta.observaciones]])

      // 6) AE-AW (19 defectos detallados) — solo si hay alguno > 0
      if (defectosDetallados.some(v => v > 0)) {
        await writeRange(SHEET_2026_ID, `AF!AE${rowNum}:AW${rowNum}`,
          [defectosDetallados])
      }

      const ms = performance.now() - t0
      registrarEvento({
        tipo: 'af_guardado',
        bache: batch,
        detalle: `Humedad ${pesos.humedad_pct}% · Excelso ${pesos.excelso_final}g · guardado en ${(ms / 1000).toFixed(2)}s`,
        usuario: getStoredUser(),
      })

      setSuccess(true)
      setTimeout(() => navigate(`/baches/${batch}`), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="af-loading"><Loader2 className="spin" size={32} /></div>
  }

  return (
    <div className="analisis-fisico">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="af-header">
        <div>
          <h1>Análisis Físico</h1>
          <p className="af-subtitle">
            Bache <strong>{batch}</strong>
            {variedad && <> · {variedad}</>}
            {proceso && <> · {proceso}</>}
          </p>
        </div>
        <div className={`mallas-display ${mallasOK ? 'ok' : ''}`}>
          <div className="mallas-value">{totalMallas.toFixed(1)} g</div>
          <div className="mallas-label">Σ mallas</div>
          <div className="mallas-hint">
            {muestraEsperada === 0
              ? 'ingresa muestra (g) primero'
              : mallasOK
              ? `✓ coincide con muestra (${muestraEsperada} g)`
              : `debe sumar ${muestraEsperada} g (muestra)`}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="af-form">
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
              <label>Responsable</label>
              <input
                type="text"
                value={meta.responsable}
                onChange={e => setMeta({ ...meta, responsable: e.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Pesos y rendimiento</h2>
          <div className="form-row">
            <div className="field">
              <label>Muestra (g)</label>
              <input
                type="number" step="0.1" min="0"
                value={pesos.muestra_g || ''}
                onChange={e => setPesos({ ...pesos, muestra_g: parseFloat(e.target.value) || 0 })}
                placeholder="100"
              />
              <small className="field-hint">Gramos de muestra evaluados</small>
            </div>
            <div className="field">
              <label>Almendra (g)</label>
              <input
                type="number" step="0.1" min="0"
                value={pesos.almendra_g || ''}
                onChange={e => setPesos({ ...pesos, almendra_g: parseFloat(e.target.value) || 0 })}
                placeholder="50"
              />
              <small className="field-hint">Almendra verde post-trilla</small>
            </div>
            <div className="field">
              <label>Merma (%)</label>
              <input
                type="number" step="0.01" min="0" max="100"
                value={pesos.merma_pct || ''}
                onChange={e => setPesos({ ...pesos, merma_pct: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Humedad C.V (%)</label>
              <input
                type="number" step="0.1" min="0" max="20"
                value={pesos.humedad_pct || ''}
                onChange={e => setPesos({ ...pesos, humedad_pct: parseFloat(e.target.value) || 0 })}
              />
              <small className="field-hint">Ideal 10–12%</small>
            </div>
            <div className="field">
              <label>Caracol (g)</label>
              <input
                type="number" step="0.1" min="0"
                value={pesos.caracol_g || ''}
                onChange={e => setPesos({ ...pesos, caracol_g: parseFloat(e.target.value) || 0 })}
              />
              <small className="field-hint">Granos malformados (caracol)</small>
            </div>
            <div className="field">
              <label>Excelso final (g)</label>
              <input
                type="number" step="0.1" min="0"
                value={pesos.excelso_final || ''}
                onChange={e => setPesos({ ...pesos, excelso_final: parseFloat(e.target.value) || 0 })}
              />
              <small className="field-hint">Almendra ofertable</small>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Mallas (criba) <span className="card-hint">gramos retenidos en cada tamiz · Σ debe coincidir con el peso de muestra</span></h2>
          <div className="mallas-grid">
            {MALLAS.map(m => (
              <div key={m.key} className="malla-card">
                <div className="malla-label">{m.label}</div>
                <div className="malla-input-row">
                  <input
                    type="range"
                    min={0} max={sliderMax} step={0.5}
                    value={Math.min(mallas[m.key], sliderMax)}
                    onChange={e => setMalla(m.key, parseFloat(e.target.value))}
                    className="malla-slider"
                  />
                  <input
                    type="number" step={0.1} min={0}
                    value={mallas[m.key]}
                    onChange={e => setMalla(m.key, parseFloat(e.target.value) || 0)}
                    className="malla-number"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Aspecto</h2>
          <div className="form-row">
            <div className="field">
              <label>Olor</label>
              <select
                value={meta.olor}
                onChange={e => setMeta({ ...meta, olor: e.target.value })}
              >
                {OLORES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Color</label>
              <select
                value={meta.color}
                onChange={e => setMeta({ ...meta, color: e.target.value })}
              >
                {COLORES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Defectos primarios</h2>
          <div className="form-row">
            <div className="field">
              <label>Defectos I (primarios)</label>
              <input
                type="number" step="1" min="0"
                value={defectosPrimarios.defectos_i || ''}
                onChange={e => setDefectosPrimarios({ ...defectosPrimarios, defectos_i: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="field">
              <label>Defectos II (secundarios)</label>
              <input
                type="number" step="1" min="0"
                value={defectosPrimarios.defectos_ii || ''}
                onChange={e => setDefectosPrimarios({ ...defectosPrimarios, defectos_ii: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>Broca leve (g)</label>
              <input
                type="number" step="0.01" min="0"
                value={defectosPrimarios.broca_leve || ''}
                onChange={e => setDefectosPrimarios({ ...defectosPrimarios, broca_leve: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="field">
              <label>Broca severa (g)</label>
              <input
                type="number" step="0.01" min="0"
                value={defectosPrimarios.broca_severa || ''}
                onChange={e => setDefectosPrimarios({ ...defectosPrimarios, broca_severa: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <small className="field-hint">
            Los % de Defectos Grupo 1, Grupo 2, Broca y Mallas se calculan automáticamente en el Sheet (cols Y, Z, AA, AB).
          </small>
        </section>

        <section className="card">
          <h2>Observaciones</h2>
          <div className="field">
            <textarea
              rows={3}
              value={meta.observaciones}
              onChange={e => setMeta({ ...meta, observaciones: e.target.value })}
              placeholder="Notas libres sobre el análisis físico (col AD)…"
            />
          </div>
        </section>

        <section className="card">
          <button
            type="button"
            className="defectos-toggle"
            onClick={() => setShowDetalles(!showDetalles)}
          >
            <h2>Defectos detallados (19 tipos)</h2>
            {showDetalles ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {showDetalles && (
            <div className="defectos-grid">
              {DEFECTOS_DETALLADOS.map((d, i) => (
                <div key={d} className="defecto-card">
                  <label className="defecto-label">{d}</label>
                  <input
                    type="number" step="1" min="0"
                    value={defectosDetallados[i] || ''}
                    onChange={e => {
                      const next = [...defectosDetallados]
                      next[i] = parseFloat(e.target.value) || 0
                      setDefectosDetallados(next)
                    }}
                    className="defecto-input"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Header debug — útil para ajustar columnas si hay desfase */}
        {headers.length > 0 && (
          <details className="af-debug">
            <summary>Headers de AF detectados ({headers.length} cols)</summary>
            <ol>{headers.map((h, i) => <li key={i}><code>{String.fromCharCode(65 + (i < 26 ? i : 0)) + (i >= 26 ? String.fromCharCode(65 + i - 26) : '')}</code> {h}</li>)}</ol>
          </details>
        )}

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">✓ Guardado. Volviendo al detalle…</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(`/baches/${batch}`)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving
              ? <><Loader2 className="spin" size={18} /> Guardando…</>
              : <><Save size={18} /> Guardar análisis físico</>}
          </button>
        </div>
      </form>
    </div>
  )
}
