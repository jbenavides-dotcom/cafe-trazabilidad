import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ArrowRight, Loader2 } from 'lucide-react'
import { batchGet, SHEET_2026_ID } from '../lib/sheets'
import './Dashboard.css'

interface Stats {
  total_baches: number
  en_proceso: number
  entregados_analisis: number
  af_completos: number
  as_aprobados: number
  as_rechazados: number
  nanolotes_consolidados: number
  ofertas_disponibles: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await batchGet(SHEET_2026_ID, [
        'CFF!D5:L200',
        'AF!A2:A200',
        'AS!B2:T200',
        'CFF!AI5:AI200',
      ])
      const cffRows = data['CFF!D5:L200']
      const afRows = data['AF!A2:A200']
      const asRows = data['AS!B2:T200']
      const s3Rows = data['CFF!AI5:AI200']

      const total = cffRows.filter(r => r[0] && r[0] !== '#').length
      const en_proceso = cffRows.filter(r => r[8]?.trim() === 'En Proceso').length
      const entregados = cffRows.filter(r => r[8]?.trim() === 'Entregado a Analisis').length
      const af = afRows.filter(r => r[0] && r[0] !== '#N/A' && r[0].toUpperCase() !== 'CODIGO').length
      const as_aprob = asRows.filter(r => r[18]?.trim() === 'APROBADO').length
      const as_rech = asRows.filter(r => r[18]?.trim() === 'RECHAZADO').length
      const nanolotes = s3Rows.filter(r => r[0] && r[0] !== '#').length

      setStats({
        total_baches: total,
        en_proceso,
        entregados_analisis: entregados,
        af_completos: af,
        as_aprobados: as_aprob,
        as_rechazados: as_rech,
        nanolotes_consolidados: nanolotes,
        ofertas_disponibles: nanolotes,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando datos')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loader2 className="spin" size={32} />
        <p>Cargando datos del Sheet 2026…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>No se pudo cargar</h2>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={load}>Reintentar</button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Resumen Cosecha 2026</h1>
          <p className="dashboard-subtitle">Estado del flujo de trazabilidad en tiempo real</p>
        </div>
        <Link to="/baches/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo bache
        </Link>
      </div>

      <div className="kpi-grid">
        <KpiCard
          label="Baches registrados"
          value={stats.total_baches}
          tone="navy"
          to="/baches"
        />
        <KpiCard
          label="En proceso"
          value={stats.en_proceso}
          tone="tan"
        />
        <KpiCard
          label="Entregados a análisis"
          value={stats.entregados_analisis}
          tone="navy"
        />
        <KpiCard
          label="Análisis físico completos"
          value={stats.af_completos}
          tone="navy"
        />
        <KpiCard
          label="Catación aprobados"
          value={stats.as_aprobados}
          tone="green"
        />
        <KpiCard
          label="Rechazados"
          value={stats.as_rechazados}
          tone="red"
        />
        <KpiCard
          label="Nanolotes consolidados"
          value={stats.nanolotes_consolidados}
          tone="navy"
        />
        <KpiCard
          label="Disponibles para venta"
          value={stats.ofertas_disponibles}
          tone="green"
        />
      </div>

      <div className="flow-diagram card">
        <h2>Flujo del bache</h2>
        <div className="flow-steps">
          <FlowStep n={1} label="Entrada CFF" count={stats.total_baches} />
          <ArrowRight size={20} className="flow-arrow" />
          <FlowStep n={2} label="Entregado análisis" count={stats.entregados_analisis} />
          <ArrowRight size={20} className="flow-arrow" />
          <FlowStep n={3} label="AF + AS" count={stats.af_completos} />
          <ArrowRight size={20} className="flow-arrow" />
          <FlowStep n={4} label="MX_V aprobado" count={stats.as_aprobados} />
          <ArrowRight size={20} className="flow-arrow" />
          <FlowStep n={5} label="Nanolote" count={stats.nanolotes_consolidados} />
          <ArrowRight size={20} className="flow-arrow" />
          <FlowStep n={6} label="Oferta" count={stats.ofertas_disponibles} />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, tone, to }: {
  label: string; value: number; tone: 'navy' | 'tan' | 'green' | 'red'; to?: string
}) {
  const content = (
    <div className={`kpi-card kpi-${tone}`}>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  )
  return to ? <Link to={to} className="kpi-link">{content}</Link> : content
}

function FlowStep({ n, label, count }: { n: number; label: string; count: number }) {
  return (
    <div className="flow-step">
      <div className="flow-step-num">{n}</div>
      <div className="flow-step-label">{label}</div>
      <div className="flow-step-count">{count}</div>
    </div>
  )
}
