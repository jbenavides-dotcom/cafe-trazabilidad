import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Coffee, Loader2, Plus, X, Mail, RefreshCw, Save } from 'lucide-react'
import { batchGet, writeRange, SHEET_2026_ID } from '../lib/sheets'
import './AsignarNanolote.css'

// MX_V: cada bloque ocupa 8 filas → summary + observaciones + 6 baches
//   R5 = summary 1 · R6 = "Observaciones" · R7-R12 = 6 baches · R13 = summary 2 ...
const MXV_SUMMARY_ROWS = [5, 13, 21, 29, 37, 45, 53, 61, 69, 77, 85, 93, 101, 109]
const HEADER_ROW = 4

interface Bloque {
  fila_summary: number
  codigo_nanolote: string  // col A (verde, lo escribe catador)
  baches: { fila: number; batch: string; variedad: string; proceso: string; sca: string }[]
  excelso_kg: string
  filas_disponibles: number[]  // filas dentro del bloque para meter más baches
}

interface BacheAprobado {
  numero: string
  variedad: string
  proceso: string
  sca: string
  ya_asignado: boolean
}

export default function AsignarNanolote() {
  const navigate = useNavigate()
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [aprobados, setAprobados] = useState<BacheAprobado[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalAgregarBache, setModalAgregarBache] = useState<Bloque | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'MX_V!A4:N120',
        'AS!B2:T200',
      ])
      const mxv = data['MX_V!A4:N120']
      const as_rows = data['AS!B2:T200']

      // Construir bloques iterando las filas summary conocidas
      const bloques_: Bloque[] = []
      const bachesAsignados = new Set<string>()

      for (let i = 0; i < MXV_SUMMARY_ROWS.length; i++) {
        const filaSum = MXV_SUMMARY_ROWS[i]
        const filaSumNext = MXV_SUMMARY_ROWS[i + 1] ?? filaSum + 8
        const idx = filaSum - HEADER_ROW
        if (idx < 0 || idx >= mxv.length) continue
        const summary_row = mxv[idx]
        const codigo = (summary_row[0] || '').trim()

        const baches_bloque: Bloque['baches'] = []
        const filas_disp: number[] = []
        // Baches del bloque: TODAS las filas entre la summary y la siguiente summary,
        // detectados por col B (Batch). Si col B vacía → fila disponible.
        // Excluimos la fila summary misma y la fila "Observaciones" (col A == "Observaciones")
        for (let f = filaSum + 1; f < filaSumNext; f++) {
          const idxB = f - HEADER_ROW
          if (idxB >= mxv.length) break
          const r = mxv[idxB]
          const colA = (r[0] || '').trim()
          const batch = (r[1] || '').trim()
          // Saltar fila explícita "Observaciones" (si existe)
          if (colA.toLowerCase() === 'observaciones') continue
          if (batch && !batch.startsWith('#') && batch !== 'Batch') {
            baches_bloque.push({
              fila: f,
              batch,
              variedad: r[2] || '',
              proceso: r[3] || '',
              sca: r[13] || '',
            })
            bachesAsignados.add(batch)
          } else {
            filas_disp.push(f)
          }
        }

        // Solo incluir bloque si tiene código o si tiene baches (raro pero por si acaso)
        // O si es la PRÓXIMA fila summary disponible (para ofrecer crear)
        bloques_.push({
          fila_summary: filaSum,
          codigo_nanolote: codigo,
          baches: baches_bloque,
          excelso_kg: summary_row[12] || '',
          filas_disponibles: filas_disp,
        })
      }

      // Baches aprobados en AS (col T = APROBADO, primer puntaje col F debe estar lleno)
      const aprobados_: BacheAprobado[] = as_rows
        .filter(r => r[0] && (r[18] || '').trim() === 'APROBADO' && r[4]) // batch + estado + fragancia
        .map(r => ({
          numero: r[0].trim(),
          variedad: r[2] || '',
          proceso: r[1] || '',
          sca: r[14] || '',
          ya_asignado: bachesAsignados.has(r[0].trim()),
        }))

      setBloques(bloques_)
      setAprobados(aprobados_)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  async function crearNanolote(codigo: string) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      // Buscar primera fila summary vacía
      const bloqueDisponible = bloques.find(b => !b.codigo_nanolote)
      if (!bloqueDisponible) {
        throw new Error(
          'No hay filas summary disponibles en MX_V. La plantilla está llena. ' +
          'Pídele a Felipe que extienda MX_V con más bloques (cada bloque = 8 filas).'
        )
      }
      await writeRange(SHEET_2026_ID, `MX_V!A${bloqueDisponible.fila_summary}`,
        [[codigo]])
      setSuccess(`Nanolote ${codigo} creado en fila ${bloqueDisponible.fila_summary}`)
      setModalNuevo(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando nanolote')
    } finally {
      setSaving(false)
    }
  }

  async function agregarBacheABloque(bloque: Bloque, batch: string) {
    if (bloque.filas_disponibles.length === 0) {
      setError(`El bloque ${bloque.codigo_nanolote} ya tiene 6 baches (máximo).`)
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const fila = bloque.filas_disponibles[0]
      await writeRange(SHEET_2026_ID, `MX_V!B${fila}`, [[batch]])
      setSuccess(`Bache ${batch} asignado al nanolote ${bloque.codigo_nanolote}`)
      setModalAgregarBache(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error asignando bache')
    } finally {
      setSaving(false)
    }
  }

  const aprobadosDisponibles = aprobados.filter(a => !a.ya_asignado)
  const bloquesActivos = bloques.filter(b => b.codigo_nanolote)
  const bloquesDisponibles = bloques.filter(b => !b.codigo_nanolote).length

  if (loading) return <div className="asig-loading"><Loader2 className="spin" size={32} /></div>

  return (
    <div className="asignar-nanolote">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="asig-header">
        <div>
          <h1>Nanolotes (MX_V)</h1>
          <p className="asig-subtitle">
            {bloquesActivos.length} nanolote{bloquesActivos.length !== 1 ? 's' : ''} ·
            {' '}{bloquesDisponibles} fila{bloquesDisponibles !== 1 ? 's' : ''} disponible{bloquesDisponibles !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="asig-actions">
          <button className="btn btn-secondary" onClick={load}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setModalNuevo(true)}
            disabled={bloquesDisponibles === 0}
          >
            <Plus size={18} /> Nuevo nanolote
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <section className="card asig-info">
        <Mail size={18} className="asig-info-icon" />
        <div>
          <strong>Cómo funciona:</strong> creas un nanolote (ej. <code>PTNLG26002</code>) y le asignas
          baches APROBADOS. Cuando un nanolote tiene 2 o más baches, está listo para que John haga la
          combinación física. La columna <code>NANOLOTE</code> de cada bache se autocompleta por fórmula.
        </div>
      </section>

      {/* Bloques activos */}
      {bloquesActivos.map(b => (
        <BloqueCard
          key={b.fila_summary}
          bloque={b}
          onAgregarBache={() => setModalAgregarBache(b)}
          aprobadosDisponibles={aprobadosDisponibles.length}
        />
      ))}

      {bloquesActivos.length === 0 && (
        <div className="card empty-state">
          <Coffee size={32} />
          <h3>Todavía no hay nanolotes</h3>
          <p>Crea el primer nanolote con el botón de arriba.</p>
        </div>
      )}

      {bloquesDisponibles === 0 && bloquesActivos.length > 0 && (
        <div className="asig-warning card">
          ⚠️ Plantilla MX_V llena. Pídele a Felipe extender con más filas si necesitas crear más nanolotes.
        </div>
      )}

      {modalNuevo && (
        <NuevoNanoloteModal
          onClose={() => setModalNuevo(false)}
          onCreate={crearNanolote}
          saving={saving}
        />
      )}

      {modalAgregarBache && (
        <AgregarBacheModal
          bloque={modalAgregarBache}
          aprobados={aprobadosDisponibles}
          onClose={() => setModalAgregarBache(null)}
          onAgregar={(batch) => agregarBacheABloque(modalAgregarBache, batch)}
          saving={saving}
        />
      )}
    </div>
  )
}

function BloqueCard({
  bloque, onAgregarBache, aprobadosDisponibles,
}: { bloque: Bloque; onAgregarBache: () => void; aprobadosDisponibles: number }) {
  const lleno = bloque.filas_disponibles.length === 0

  return (
    <div className="bloque-card card">
      <div className="bloque-summary">
        <div className="bloque-codigo asignado">
          <Coffee size={16} />
          <strong>{bloque.codigo_nanolote}</strong>
        </div>
        <div className="bloque-stats">
          <span><strong>{bloque.baches.length}</strong> baches</span>
          {bloque.excelso_kg && <span><strong>{bloque.excelso_kg}</strong> kg almendra</span>}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onAgregarBache}
          disabled={lleno || aprobadosDisponibles === 0}
          title={
            lleno ? 'Bloque lleno (no quedan filas disponibles)' :
            aprobadosDisponibles === 0 ? 'No hay baches APROBADOS sin asignar' :
            'Asignar un bache aprobado a este nanolote'
          }
        >
          <Plus size={14} /> Agregar bache
        </button>
      </div>

      <div className="bloque-baches">
        {bloque.baches.length > 0 ? (
          bloque.baches.map(b => (
            <div key={b.fila} className="bloque-bache">
              <span className="bache-num">{b.batch}</span>
              <span className="bache-info">{b.variedad} · {b.proceso}</span>
              <span className="bache-sca">SCA {b.sca}</span>
            </div>
          ))
        ) : (
          <div className="bloque-empty">
            Sin baches aún. Asigna el primer bache aprobado.
          </div>
        )}
      </div>
    </div>
  )
}

function NuevoNanoloteModal({ onClose, onCreate, saving }: {
  onClose: () => void
  onCreate: (codigo: string) => void
  saving: boolean
}) {
  const [codigo, setCodigo] = useState('PTNL')
  const valid = /^PT[A-Z]{3}26\d{3}$/.test(codigo)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (valid) onCreate(codigo)
  }

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal" onClick={e => e.stopPropagation()}>
        <button className="vt-modal-close" onClick={onClose}><X size={20} /></button>
        <h2>Crear nuevo nanolote</h2>

        <form onSubmit={handleSubmit} className="asig-form">
          <div className="field">
            <label>Código del nanolote</label>
            <input
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="PTNLG26002"
              autoFocus
              required
            />
            <small className="field-hint">
              Formato: <code>PT</code> + categoría (<code>NL</code>=nanolote · <code>ML</code>=microlote)
              {' '}+ variedad (<code>G</code>esha · <code>S</code>idra · <code>A</code>marillo · <code>J</code>ava · <code>M</code>okka)
              {' '}+ <code>26</code> + número (3 dígitos)
            </small>
          </div>

          <div className="codigo-preview">
            {valid ? (
              <span className="ok">✓ Formato válido</span>
            ) : codigo.length > 4 ? (
              <span className="invalid">Formato inválido. Ej: PTNLG26002, PTNLS26015</span>
            ) : null}
          </div>

          <div className="vt-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
              {saving
                ? <><Loader2 className="spin" size={16} /> Creando…</>
                : <><Save size={16} /> Crear nanolote</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AgregarBacheModal({
  bloque, aprobados, onClose, onAgregar, saving,
}: {
  bloque: Bloque
  aprobados: BacheAprobado[]
  onClose: () => void
  onAgregar: (batch: string) => void
  saving: boolean
}) {
  const [seleccionado, setSeleccionado] = useState('')

  return (
    <div className="vt-modal-overlay" onClick={onClose}>
      <div className="vt-modal" onClick={e => e.stopPropagation()}>
        <button className="vt-modal-close" onClick={onClose}><X size={20} /></button>
        <h2>Asignar bache a {bloque.codigo_nanolote}</h2>
        <p className="asig-modal-hint">
          Selecciona uno de los baches APROBADOS sin asignar. Solo escribimos en la columna <code>Batch</code>;
          variedad/proceso/SCA se autocompletan por fórmula.
        </p>

        {aprobados.length === 0 ? (
          <div className="asig-empty-aprobados">
            No hay baches aprobados disponibles. Primero hay que aprobar baches en Análisis Sensorial.
          </div>
        ) : (
          <>
            <div className="aprobados-list">
              {aprobados.map(a => (
                <label
                  key={a.numero}
                  className={`aprobado-row ${seleccionado === a.numero ? 'sel' : ''}`}
                >
                  <input
                    type="radio"
                    name="bache"
                    value={a.numero}
                    checked={seleccionado === a.numero}
                    onChange={e => setSeleccionado(e.target.value)}
                  />
                  <div className="aprobado-info">
                    <strong>{a.numero}</strong>
                    <small>{a.variedad} · {a.proceso}</small>
                  </div>
                  <span className="aprobado-sca">SCA {a.sca}</span>
                </label>
              ))}
            </div>

            <div className="vt-modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!seleccionado || saving}
                onClick={() => onAgregar(seleccionado)}
              >
                {saving
                  ? <><Loader2 className="spin" size={16} /> Asignando…</>
                  : <><Save size={16} /> Asignar bache</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
