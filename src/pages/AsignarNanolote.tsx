import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Coffee, Loader2, Plus, Mail } from 'lucide-react'
import { batchGet, writeRange, SHEET_2026_ID } from '../lib/sheets'
import './AsignarNanolote.css'

interface BacheEnMxv {
  fila: number
  batch: string
  variedad: string
  proceso: string
  kg_disp: string
  sca: string
  nanolote_actual?: string  // si ya está en un bloque
}

interface BloqueNanolote {
  fila_summary: number
  codigo_nanolote: string  // col A (verde, lo escribe catador)
  baches: BacheEnMxv[]
  excelso_kg: string
}

export default function AsignarNanolote() {
  const navigate = useNavigate()
  const [bloques, setBloques] = useState<BloqueNanolote[]>([])
  const [pendientes, setPendientes] = useState<BacheEnMxv[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, ['MX_V!A4:M50'])
      const rows = data['MX_V!A4:M50']
      const bloques_: BloqueNanolote[] = []
      const pendientes_: BacheEnMxv[] = []
      let bloqueActual: BloqueNanolote | null = null

      rows.forEach((row, idx) => {
        const fila = idx + 4
        const a = (row[0] || '').trim()
        const b = (row[1] || '').trim()
        const c = row[2] || ''
        const d = row[3] || ''
        const g = row[6] || ''
        const m = row[12] || ''
        const n = row[13] || ''  // SCA col N

        // Saltar header
        if (fila === 4) return

        // Nueva fila summary (col A con código nanolote, no header ni "Observaciones")
        if (a && a !== 'Observaciones' && !a.startsWith('#')) {
          if (bloqueActual) bloques_.push(bloqueActual)
          bloqueActual = {
            fila_summary: fila,
            codigo_nanolote: a,
            baches: [],
            excelso_kg: m,
          }
        }

        // Bache (col B con batch)
        if (b && b !== 'Batch' && !b.startsWith('#')) {
          const bache: BacheEnMxv = {
            fila, batch: b,
            variedad: c, proceso: d, kg_disp: g, sca: n,
          }
          if (bloqueActual) {
            bache.nanolote_actual = bloqueActual.codigo_nanolote
            bloqueActual.baches.push(bache)
          } else {
            pendientes_.push(bache)
          }
        }
      })

      if (bloqueActual) bloques_.push(bloqueActual)
      setBloques(bloques_)
      setPendientes(pendientes_)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }

  async function asignarCodigoNanolote(fila: number, codigo: string) {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await writeRange(SHEET_2026_ID, `MX_V!A${fila}`, [[codigo]])
      setSuccess(`Nanolote ${codigo} asignado en fila ${fila}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="asig-loading"><Loader2 className="spin" size={32} /></div>

  return (
    <div className="asignar-nanolote">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="asig-header">
        <div>
          <h1>Asignar Nanolote</h1>
          <p className="asig-subtitle">Vista catador · MX_V (LP&ET)</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <section className="card asig-info">
        <Mail size={18} className="asig-info-icon" />
        <div>
          <strong>Recordatorio:</strong> cuando un bloque tenga 2 o más baches con el mismo
          código de nanolote en col A, el sistema notificará a John por email para iniciar
          la combinación física.
        </div>
      </section>

      {pendientes.length > 0 && (
        <section className="card pendientes-card">
          <h2>
            <Coffee size={20} /> Baches pendientes de asignar
            <span className="badge badge-analisis">{pendientes.length}</span>
          </h2>
          <p className="card-hint">
            Estos baches fueron aprobados en AS pero aún no están asignados a un nanolote.
          </p>
          <div className="pendientes-list">
            {pendientes.map(b => (
              <div key={b.fila} className="pendiente-row">
                <div className="pendiente-num">{b.batch}</div>
                <div>{b.variedad}</div>
                <div className="pendiente-proceso">{b.proceso}</div>
                <div className="pendiente-kg">{b.kg_disp} kg</div>
                <div>SCA {b.sca}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bloques-section">
        <div className="bloques-header">
          <h2>Bloques de nanolote</h2>
          <small>Cada bloque ocupa 7 filas en MX_V (1 summary + 6 baches)</small>
        </div>

        {bloques.map((bloque, i) => (
          <div key={bloque.fila_summary} className="bloque-card card">
            <div className="bloque-summary">
              <div className="bloque-num">#{i + 1}</div>
              <div className="bloque-codigo-section">
                {bloque.codigo_nanolote ? (
                  <div className="bloque-codigo asignado">
                    <Coffee size={16} />
                    <strong>{bloque.codigo_nanolote}</strong>
                  </div>
                ) : (
                  <CodeInput
                    fila={bloque.fila_summary}
                    saving={saving}
                    onAssign={asignarCodigoNanolote}
                  />
                )}
              </div>
              <div className="bloque-stats">
                <div>
                  <strong>{bloque.baches.length}</strong> baches
                </div>
                <div>
                  <strong>{bloque.excelso_kg || '0'}</strong> kg almendra
                </div>
              </div>
            </div>

            <div className="bloque-baches">
              {bloque.baches.length > 0 ? (
                bloque.baches.map(b => (
                  <div key={b.fila} className="bloque-bache">
                    <span className="bache-num">{b.batch}</span>
                    <span className="bache-info">{b.variedad} · {b.proceso}</span>
                    <span className="bache-kg">{b.kg_disp} kg</span>
                    <span className="bache-sca">SCA {b.sca}</span>
                  </div>
                ))
              ) : (
                <div className="bloque-empty">Sin baches asignados</div>
              )}
            </div>
          </div>
        ))}

        {bloques.length === 0 && (
          <div className="card empty-state">
            <Coffee size={32} />
            <h3>Todavía no hay nanolotes</h3>
            <p>Los bloques se crean automáticamente cuando se aprueban baches en AS.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function CodeInput({ fila, saving, onAssign }: {
  fila: number; saving: boolean; onAssign: (fila: number, codigo: string) => void
}) {
  const [codigo, setCodigo] = useState('')
  const valid = /^PT[A-Z]{3}26\d{3}$/.test(codigo) // ej. PTNLG26001 / PTNLM26001

  return (
    <div className="bloque-codigo-input">
      <input
        type="text"
        placeholder="Ej. PTNLG26001"
        value={codigo}
        onChange={e => setCodigo(e.target.value.toUpperCase())}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={saving || !valid}
        onClick={() => onAssign(fila, codigo)}
      >
        {saving ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
        Asignar
      </button>
      {codigo && !valid && (
        <small className="codigo-hint">
          Formato: PTNL{'{V|G|M}'}26{'{NNN}'}
        </small>
      )}
    </div>
  )
}

