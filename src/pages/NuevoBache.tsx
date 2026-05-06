import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { appendRow, SHEET_2026_ID } from '../lib/sheets'
import { PROCESOS, VARIEDADES, type Bache } from '../lib/trazabilidad'
import './NuevoBache.css'

export default function NuevoBache() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState<Partial<Bache>>({
    fecha_entrada: today,
    fecha_cosecha: today,
    programa: 'VARIETALES',
    calidad_ccf: 'A',
    proceso: 'Natural',
    variedad: 'Geisha',
    destino: 'PT_EQ',
    estado: 'En Proceso',
  })

  function update<K extends keyof Bache>(key: K, value: Bache[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const required: (keyof Bache)[] = ['numero_bache', 'kg_ccf', 'proveedor', 'remision']
      for (const k of required) {
        if (!form[k]) throw new Error(`Falta: ${k}`)
      }

      // Orden CFF Sección 1 cols A-L (M-T son calculadas)
      const row: (string | number)[] = [
        form.fecha_entrada || '',
        form.fecha_cosecha || '',
        form.remision || '',
        form.numero_bache || '',
        form.proveedor || '',
        form.programa || '',
        form.calidad_ccf || '',
        form.proceso || '',
        form.variedad || '',
        form.kg_ccf || 0,
        form.destino || '',
        form.estado || 'En Proceso',
      ]

      await appendRow(SHEET_2026_ID, 'CFF!A4:L4', row)

      setSuccess(true)
      setTimeout(() => navigate('/baches'), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="nuevo-bache">
      <button className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="form-header">
        <h1>Nuevo Bache</h1>
        <p>Registro de entrada en CFF · Sección 1</p>
      </div>

      <form onSubmit={handleSubmit} className="form-grid card">
        <div className="form-row">
          <div className="field">
            <label>Fecha entrada</label>
            <input
              type="date"
              value={form.fecha_entrada}
              onChange={e => update('fecha_entrada', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Fecha cosecha</label>
            <input
              type="date"
              value={form.fecha_cosecha}
              onChange={e => update('fecha_cosecha', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Remisión</label>
            <input
              type="text"
              value={form.remision || ''}
              onChange={e => update('remision', e.target.value)}
              placeholder="Ej. 020-26"
              required
            />
          </div>
          <div className="field">
            <label># Bache</label>
            <input
              type="text"
              value={form.numero_bache || ''}
              onChange={e => update('numero_bache', e.target.value)}
              placeholder="Ej. 020-26 (sufijo: T = Vecinos, CL = CraftLab)"
              required
            />
          </div>
        </div>

        <div className="field">
          <label>Proveedor / Caficultor</label>
          <input
            type="text"
            value={form.proveedor || ''}
            onChange={e => update('proveedor', e.target.value)}
            placeholder="Ej. LOTE 10, JUAN DAVID, VECINOS"
            required
          />
        </div>

        <div className="form-row">
          <div className="field">
            <label>Programa</label>
            <select
              value={form.programa}
              onChange={e => update('programa', e.target.value as Bache['programa'])}
            >
              <option value="VARIETALES">VARIETALES</option>
              <option value="VECINOS">VECINOS</option>
              <option value="TOSTADO">TOSTADO</option>
            </select>
          </div>
          <div className="field">
            <label>Calidad CCF</label>
            <select
              value={form.calidad_ccf}
              onChange={e => update('calidad_ccf', e.target.value)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Proceso</label>
            <select
              value={form.proceso}
              onChange={e => update('proceso', e.target.value as Bache['proceso'])}
            >
              {PROCESOS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Variedad</label>
            <select
              value={form.variedad}
              onChange={e => update('variedad', e.target.value as Bache['variedad'])}
            >
              {VARIEDADES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>KG CCF (cereza fresca)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.kg_ccf || ''}
              onChange={e => update('kg_ccf', parseFloat(e.target.value) || 0)}
              required
            />
          </div>
          <div className="field">
            <label>Proyecto destino</label>
            <select
              value={form.destino}
              onChange={e => update('destino', e.target.value as Bache['destino'])}
            >
              <option value="PT_EQ">PT_EQ</option>
              <option value="PT_TOSTADO">PT_TOSTADO</option>
            </select>
          </div>
        </div>

        <div className="field">
          <label>Estado inicial</label>
          <select
            value={form.estado}
            onChange={e => update('estado', e.target.value as Bache['estado'])}
          >
            <option value="En Proceso">En Proceso</option>
            <option value="Entregado a Analisis">Entregado a Analisis</option>
          </select>
          <small className="field-hint">
            «Entregado a Analisis» dispara automáticamente la propagación a AF y AS.
          </small>
        </div>

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">✓ Bache guardado correctamente</div>}

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><Loader2 className="spin" size={18} /> Guardando…</> : <><Save size={18} /> Guardar bache</>}
          </button>
        </div>
      </form>
    </div>
  )
}
