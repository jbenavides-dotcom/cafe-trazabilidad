import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Coffee, Loader2, CheckCircle2, Beaker, Send, RotateCcw, Clock, Save } from 'lucide-react'
import { batchGet, writeRange, columnLetter, SHEET_2026_ID } from '../lib/sheets'
import { origenDeBache, cambiarEstadoBache, findCFFRow, puedeRevertirseEstado } from '../lib/trazabilidad'
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
  af: AnalisisFisicoFicha | null
  as: AnalisisSensorialFicha | null
  mxv: { nanolote?: string; combina_con?: string } | null
  // Datos post-secado (CFF cols ~M-S, cuando el bache está listo para análisis)
  postSecado: PostSecadoData
}

interface PostSecadoData {
  kg_brutos: string        // KG CPS/CCS BRUTOS — antes de muestras
  muestras: string         // MUESTRAS — kg/g separados para análisis
  sacos: string            // SACOS — número de sacos almacenados
  kg_disp_ccs_cps: string  // KG DISPONIBLES EN CCS/CPS — netos tras descontar muestras
  factor_conversion: string // FC CPS/CCS — Factor de conversión (4.5-5.5 CPS · 3-4.5 CCS)
  humedad_cps: string      // HUMEDAD CPS/CCS — % humedad medido
  kg_disponibles: string   // KG DISPONIBLES — kg final disponibles
}

interface AnalisisFisicoFicha {
  codigo: string
  fecha?: string
  responsable?: string
  // Pesos
  muestra_g?: string
  almendra_g?: string
  merma_pct?: string
  humedad?: string
  caracol_g?: string
  excelso_final?: string
  // Aspecto
  olor?: string
  color?: string
  // Mallas (gramos en N-T)
  mallas_g: number[]   // [m18, m17, m16, m15, m14, m13, fondo]
  // % calculados (cols Y, Z, AA, AB)
  defectos_grupo1_pct?: string
  defectos_grupo2_pct?: string
  broca_pct?: string
  mallas_pct?: string
  // Defectos primarios (gr)
  defectos_i?: string
  defectos_ii?: string
  broca_leve?: string
  broca_severa?: string
  // Observaciones (AD)
  observaciones?: string
  // Defectos detallados (AE-AW), cantidades en grupos
  defectos_detallados: { label: string; valor: string }[]
}

interface AnalisisSensorialFicha {
  fecha?: string
  catador?: string
  // 10 puntajes SCA (cols F-O)
  puntajes: { label: string; valor: number }[]
  scaa_total?: string
  observaciones?: string
  perfil?: string         // MacroPerfil
  notas?: string          // Notas-Atributos
  estado?: string         // APROBADO / RECHAZADO
}

const MALLAS_LABELS = ['18', '17', '16', '15', '14', '13', 'Fondo']

const DEFECTOS_LABELS = [
  'Negro', 'Negro parcial', 'Vinagre', 'Vinagre parcial',
  'Cardenillo', 'Cristalizado', 'Decolordo veteado', 'Decolorado reposado',
  'Ambar o mantequillo', 'Sobresecado', 'Mordido o cortado', 'Broca',
  'Broca severa', 'Ambar o mantequillo (2)', 'Averanado', 'Inmaduro',
  'M. Extraña', 'Guayaba', 'FLOJO',
]

const ATRIBUTOS_SCA = [
  'Fragancia y Aroma', 'Sabor', 'Residual', 'Acidez', 'Balance',
  'Cuerpo', 'Uniformidad', 'Taza Limpia', 'Dulzor', 'Global',
]

export default function DetalleBache() {
  const { numero } = useParams()
  const navigate = useNavigate()
  const [bache, setBache] = useState<BacheDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [duracionMs, setDuracionMs] = useState<number | null>(null)

  // ── Campos editables post-secado ──────────────────────────────────────────
  // Valores controlados para los 3 campos manuales
  const [kgBrutos, setKgBrutos] = useState('')
  const [muestras, setMuestras] = useState('')
  const [humedad, setHumedad] = useState('')
  // Snapshot de los valores al cargar — para detectar si hubo cambios
  const savedPostSecado = useRef({ kgBrutos: '', muestras: '', humedad: '' })

  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  // Índices de columna de los 3 campos manuales en CFF — se populan al cargar
  // Guardamos los índices (0-based) para construir la letra de columna al escribir
  const colIdxRefs = useRef({ kg_brutos: -1, muestras: -1, humedad_cps: -1 })

  const haycambiosSinGuardar =
    kgBrutos !== savedPostSecado.current.kgBrutos ||
    muestras  !== savedPostSecado.current.muestras  ||
    humedad   !== savedPostSecado.current.humedad

  async function guardarPostSecado() {
    if (!bache) return
    if (!kgBrutos && !muestras && !humedad) return
    setGuardando(true)
    setErrorGuardado(null)
    setGuardadoOk(false)
    try {
      const row = await findCFFRow(bache.numero)

      // Construir letra de columna desde índice 0-based guardado en colIdxRefs.
      // columnLetter espera 1-based (1 → A, 13 → M, …)
      const { kg_brutos: idxM, muestras: idxN, humedad_cps: idxR } = colIdxRefs.current

      if (idxM < 0 || idxN < 0 || idxR < 0) {
        throw new Error(
          'No se encontraron las columnas KG CPS/CCS BRUTOS / MUESTRAS / HUMEDAD CPS/CCS en el Sheet. ' +
          'Revisa los headers de la fila 4 del CFF.'
        )
      }

      const colM = columnLetter(idxM + 1)  // índice 0-based → 1-based para columnLetter
      const colN = columnLetter(idxN + 1)
      const colR = columnLetter(idxR + 1)

      // Escribimos cada celda individualmente porque las columnas no son contiguas
      if (kgBrutos) await writeRange(SHEET_2026_ID, `CFF!${colM}${row}`, [[parseFloat(kgBrutos)]])
      if (muestras)  await writeRange(SHEET_2026_ID, `CFF!${colN}${row}`, [[parseFloat(muestras)]])
      if (humedad)   await writeRange(SHEET_2026_ID, `CFF!${colR}${row}`, [[parseFloat(humedad)]])

      // Actualizar snapshot para que el botón Guardar se deshabilite de nuevo
      savedPostSecado.current = { kgBrutos, muestras, humedad }

      registrarEvento({
        tipo: 'datos_postsecado',
        bache: bache.numero,
        detalle: `KG brutos: ${kgBrutos} · Muestras: ${muestras} · Humedad: ${humedad}%`,
        usuario: getStoredUser(),
      })

      setGuardadoOk(true)
      // Refrescar para que los auto-calculados muestren los nuevos valores
      await load()
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'Error guardando datos post-secado')
    } finally {
      setGuardando(false)
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  async function entregarAnalisis() {
    if (!bache) return

    // Validar que los 3 campos manuales estén llenos antes de cambiar estado
    const faltantes: string[] = []
    if (!bache.postSecado.kg_brutos && !kgBrutos) faltantes.push('KG CPS/CCS BRUTOS')
    if (!bache.postSecado.muestras && !muestras)   faltantes.push('MUESTRAS')
    if (!bache.postSecado.humedad_cps && !humedad) faltantes.push('HUMEDAD CPS/CCS')
    if (faltantes.length > 0) {
      alert(
        `Antes de entregar a análisis debes registrar:\n\n` +
        faltantes.map(f => '• ' + f).join('\n') +
        `\n\nEstos datos se llenan manualmente en la sección "Datos manuales (post-secado)".`
      )
      return
    }

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
        'CFF!A4:T200',  // Fila 4 = headers; A5:T200 = datos. Extendido hasta T para post-secado.
        'AF!A2:AW200',  // Hasta AW para incluir 19 defectos detallados
        'AS!A2:T200',
        'MX_V!A4:X50',
      ])

      // Fila 4 (índice 0) = headers del CFF — usamos para mapear columnas por nombre
      const cffRows = data['CFF!A4:T200']
      const headerRow: string[] = cffRows[0] ?? []

      // Función auxiliar: índice de columna por nombre de header (insensible a mayúsculas y espacios extra)
      function colIdx(name: string): number {
        return headerRow.findIndex(
          h => h.trim().toLowerCase() === name.trim().toLowerCase()
        )
      }

      // Columnas base (ya validadas previamente)
      const IDX_FECHA_ENT = 0
      const IDX_FECHA_COS = 1
      const IDX_REMISION  = 2
      const IDX_NUMERO    = 3
      const IDX_PROVEEDOR = 4
      const IDX_PROGRAMA  = 5
      const IDX_PROCESO   = 7
      const IDX_VARIEDAD  = 8
      const IDX_KG_CCF    = 9
      const IDX_DESTINO   = 10
      const IDX_ESTADO    = 11

      // Columnas post-secado — buscadas por nombre de header
      const IDX_KG_BRUTOS      = colIdx('KG CPS/CCS BRUTOS')
      const IDX_MUESTRAS        = colIdx('MUESTRAS')
      const IDX_SACOS           = colIdx('SACOS')
      const IDX_KG_DISP_CCS    = colIdx('KG DISPONIBLES EN CCS/CPS')
      const IDX_FC              = colIdx('FC CPS/CCS')
      const IDX_HUMEDAD_CPS     = colIdx('HUMEDAD CPS/CCS')
      const IDX_KG_DISP         = colIdx('KG DISPONIBLES')

      // Log para diagnóstico — visible en DevTools durante desarrollo
      console.log('[DetalleBache] CFF headers A-T:', headerRow)
      console.log('[DetalleBache] Mapeo post-secado:', {
        kg_brutos:       { header: headerRow[IDX_KG_BRUTOS],   idx: IDX_KG_BRUTOS },
        muestras:        { header: headerRow[IDX_MUESTRAS],    idx: IDX_MUESTRAS },
        sacos:           { header: headerRow[IDX_SACOS],       idx: IDX_SACOS },
        kg_disp_ccs_cps: { header: headerRow[IDX_KG_DISP_CCS], idx: IDX_KG_DISP_CCS },
        factor_conv:     { header: headerRow[IDX_FC],          idx: IDX_FC },
        humedad_cps:     { header: headerRow[IDX_HUMEDAD_CPS], idx: IDX_HUMEDAD_CPS },
        kg_disponibles:  { header: headerRow[IDX_KG_DISP],     idx: IDX_KG_DISP },
      })

      // Filas de datos = desde índice 1 (saltamos la fila de headers)
      const cff = cffRows.slice(1).find(r => r[IDX_NUMERO] === numero)
      if (!cff) throw new Error(`Bache ${numero} no encontrado en CFF`)

      // Función auxiliar para leer una celda de cff de forma segura
      function cffCol(idx: number): string {
        if (idx < 0) return ''
        return cff![idx] ?? ''
      }

      // AF "llenado de verdad" = humedad (col J, índice 9) numérica
      // (el código aparece automático por fórmulas VLOOKUP cuando CFF cambia a "Entregado a Analisis")
      const af_row_raw = data['AF!A2:AW200'].find(r => r[0]?.trim() === numero)
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

      // Guardar índices de columnas manuales para usar al escribir
      colIdxRefs.current = {
        kg_brutos:   IDX_KG_BRUTOS,
        muestras:    IDX_MUESTRAS,
        humedad_cps: IDX_HUMEDAD_CPS,
      }

      const ps: PostSecadoData = {
        kg_brutos:         cffCol(IDX_KG_BRUTOS),
        muestras:          cffCol(IDX_MUESTRAS),
        sacos:             cffCol(IDX_SACOS),
        kg_disp_ccs_cps:   cffCol(IDX_KG_DISP_CCS),
        factor_conversion: cffCol(IDX_FC),
        humedad_cps:       cffCol(IDX_HUMEDAD_CPS),
        kg_disponibles:    cffCol(IDX_KG_DISP),
      }

      // Poblar estados de inputs con valores actuales del Sheet
      setKgBrutos(ps.kg_brutos)
      setMuestras(ps.muestras)
      setHumedad(ps.humedad_cps)
      savedPostSecado.current = {
        kgBrutos: ps.kg_brutos,
        muestras: ps.muestras,
        humedad:  ps.humedad_cps,
      }
      // Resetear feedback de guardado al recargar
      setGuardadoOk(false)
      setErrorGuardado(null)

      setBache({
        fecha_entrada: cffCol(IDX_FECHA_ENT),
        fecha_cosecha: cffCol(IDX_FECHA_COS),
        remision:      cffCol(IDX_REMISION),
        numero:        cffCol(IDX_NUMERO),
        proveedor:     cffCol(IDX_PROVEEDOR),
        programa:      cffCol(IDX_PROGRAMA),
        proceso:       cffCol(IDX_PROCESO),
        variedad:      cffCol(IDX_VARIEDAD),
        kg_ccf:        cffCol(IDX_KG_CCF),
        destino:       cffCol(IDX_DESTINO),
        estado:        cffCol(IDX_ESTADO),
        origen: origenDeBache(numero, cffCol(IDX_PROVEEDOR)),
        af: af_row ? construirFichaAF(af_row) : null,
        as: as_row ? construirFichaAS(as_row) : null,
        mxv: mxv_row ? {
          nanolote: nanolote_asignado,
          combina_con: mxv_row[23],
        } : null,
        postSecado: ps,
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
      detail: bache.af ? `Humedad ${bache.af.humedad}% · Excelso ${bache.af.excelso_final}g` : '—',
    },
    {
      key: 'as',
      label: 'AS · Análisis sensorial',
      done: !!bache.as,
      detail: bache.as ? `SCA ${bache.as.scaa_total} · ${bache.as.estado || 'pendiente'}` : '—',
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

      {/* Datos post-secado (CFF cols M-S) */}
      <SeccionPostSecado
        data={bache.postSecado}
        kgBrutos={kgBrutos}
        muestras={muestras}
        humedad={humedad}
        onKgBrutos={setKgBrutos}
        onMuestras={setMuestras}
        onHumedad={setHumedad}
        onGuardar={guardarPostSecado}
        guardando={guardando}
        guardadoOk={guardadoOk}
        errorGuardado={errorGuardado}
        hayCambios={haycambiosSinGuardar}
      />

      {/* AF FICHA COMPLETA si existe */}
      {bache.af && (
        <FichaAF af={bache.af} numero={bache.numero} />
      )}

      {/* AS FICHA COMPLETA si existe */}
      {bache.as && (
        <FichaAS as_data={bache.as} numero={bache.numero} />
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

interface SeccionPostSecadoProps {
  data: PostSecadoData
  // Campos controlados — manuales
  kgBrutos: string
  muestras: string
  humedad: string
  onKgBrutos: (v: string) => void
  onMuestras: (v: string) => void
  onHumedad: (v: string) => void
  // Acciones
  onGuardar: () => void
  guardando: boolean
  guardadoOk: boolean
  errorGuardado: string | null
  hayCambios: boolean
}

function SeccionPostSecado({
  data,
  kgBrutos, muestras, humedad,
  onKgBrutos, onMuestras, onHumedad,
  onGuardar, guardando, guardadoOk, errorGuardado, hayCambios,
}: SeccionPostSecadoProps) {
  // Auto-calculados: solo los que tienen valor
  const autoCalculados: Array<{ label: string; value: string; unit?: string; big?: boolean }> = [
    { label: 'Sacos',            value: data.sacos                                },
    { label: 'KG Disp. CCS/CPS', value: data.kg_disp_ccs_cps,  unit: 'kg'        },
    { label: 'FC CPS/CCS',       value: data.factor_conversion                   },
    { label: 'KG Disponibles',   value: data.kg_disponibles,    unit: 'kg', big: true },
  ]

  return (
    <section className="card bd-postsec">
      <h2 className="bd-postsec-titulo">Datos post-secado</h2>

      {/* ── Bloque 1: Datos manuales ─────────────────────────────────── */}
      <div className="bd-postsec-bloque bd-postsec-bloque--manual">
        <h3 className="bd-postsec-sub">Datos manuales (post-secado)</h3>
        <div className="bd-postsec-inputs">

          {/* KG CPS/CCS Brutos */}
          <div className="bd-postsec-input-grupo">
            <label className="bd-postsec-label" htmlFor="ps-kg-brutos">
              KG CPS/CCS Brutos
            </label>
            <div className="bd-postsec-input-wrap">
              <input
                id="ps-kg-brutos"
                type="number"
                step="0.1"
                min="0"
                className="bd-postsec-input"
                value={kgBrutos}
                onChange={e => onKgBrutos(e.target.value)}
                placeholder="0.0"
                aria-label="KG CPS/CCS Brutos"
              />
              <span className="bd-postsec-unit">kg</span>
            </div>
          </div>

          {/* Muestras */}
          <div className="bd-postsec-input-grupo">
            <label className="bd-postsec-label" htmlFor="ps-muestras">
              Muestras
            </label>
            <div className="bd-postsec-input-wrap">
              <input
                id="ps-muestras"
                type="number"
                step="0.1"
                min="0"
                className="bd-postsec-input"
                value={muestras}
                onChange={e => onMuestras(e.target.value)}
                placeholder="0.0"
                aria-label="Muestras"
              />
              <span className="bd-postsec-unit">kg</span>
            </div>
          </div>

          {/* Humedad CPS/CCS */}
          <div className="bd-postsec-input-grupo">
            <label className="bd-postsec-label" htmlFor="ps-humedad">
              Humedad CPS/CCS
            </label>
            <div className="bd-postsec-input-wrap">
              <input
                id="ps-humedad"
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="bd-postsec-input"
                value={humedad}
                onChange={e => onHumedad(e.target.value)}
                placeholder="0.0"
                aria-label="Humedad CPS/CCS"
              />
              <span className="bd-postsec-unit">%</span>
            </div>
          </div>
        </div>

        {/* Feedback de guardado */}
        {errorGuardado && (
          <p className="bd-postsec-error" role="alert">{errorGuardado}</p>
        )}
        {guardadoOk && !hayCambios && (
          <p className="bd-postsec-ok">Datos guardados correctamente.</p>
        )}

        <div className="bd-postsec-actions">
          <button
            className="btn btn-primary"
            onClick={onGuardar}
            disabled={guardando || !hayCambios}
            aria-label="Guardar datos post-secado"
          >
            {guardando
              ? <><Loader2 className="spin" size={16} /> Guardando…</>
              : <><Save size={16} /> Guardar datos post-secado</>}
          </button>
        </div>
      </div>

      {/* ── Bloque 2: Auto-calculados ────────────────────────────────── */}
      <div className="bd-postsec-bloque bd-postsec-bloque--auto">
        <h3 className="bd-postsec-sub">Auto-calculados por fórmula</h3>
        <div className="bd-postsec-grid">
          {autoCalculados.map((c, i) => (
            <div key={i} className={`bd-postsec-campo${c.big ? ' bd-postsec-campo--big' : ''}`}>
              <span className="bd-postsec-badge-auto">Auto</span>
              <span className="bd-postsec-label">{c.label}</span>
              <span className="bd-postsec-valor">
                {c.value
                  ? `${c.value}${c.unit ? ' ' + c.unit : ''}`
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FichaAF({ af, numero }: { af: AnalisisFisicoFicha; numero: string }) {
  const totalMallas_g = af.mallas_g.reduce((a, b) => a + b, 0)
  const defectosConValor = af.defectos_detallados.filter(d => parseFloat(d.valor) > 0)

  return (
    <section className="card ficha-af">
      <div className="ficha-header">
        <h2><Beaker size={20} /> Análisis físico</h2>
        <Link to={`/baches/${numero}/fisico`} className="ficha-edit-link">Editar</Link>
      </div>

      <div className="ficha-meta">
        {af.fecha && <span><strong>Fecha:</strong> {af.fecha}</span>}
        {af.responsable && <span><strong>Responsable:</strong> {af.responsable}</span>}
      </div>

      {/* Pesos y rendimiento */}
      <div className="ficha-section">
        <h3>Pesos y rendimiento</h3>
        <DataGrid items={[
          { label: 'Muestra',      value: af.muestra_g ? `${af.muestra_g} g` : undefined },
          { label: 'Almendra',     value: af.almendra_g ? `${af.almendra_g} g` : undefined },
          { label: 'Merma',        value: af.merma_pct ? `${af.merma_pct}%` : undefined },
          { label: 'Humedad C.V',  value: af.humedad ? `${af.humedad}%` : undefined, big: true },
          { label: 'Caracol',      value: af.caracol_g ? `${af.caracol_g} g` : undefined },
          { label: 'Excelso final', value: af.excelso_final ? `${af.excelso_final} g` : undefined, big: true },
        ]} />
      </div>

      {/* Aspecto */}
      {(af.olor || af.color) && (
        <div className="ficha-section">
          <h3>Aspecto</h3>
          <DataGrid items={[
            { label: 'Olor',  value: af.olor },
            { label: 'Color', value: af.color },
          ]} />
        </div>
      )}

      {/* Mallas con barras */}
      {totalMallas_g > 0 && (
        <div className="ficha-section">
          <h3>
            Mallas (criba)
            <small> · total {totalMallas_g.toFixed(1)} g{af.mallas_pct && ` · ${af.mallas_pct}% mallas finas`}</small>
          </h3>
          <div className="ficha-mallas">
            {af.mallas_g.map((g, i) => {
              const pct = totalMallas_g > 0 ? (g / totalMallas_g) * 100 : 0
              return (
                <div key={i} className="ficha-malla">
                  <div className="malla-info">
                    <span className="malla-name">M{MALLAS_LABELS[i]}</span>
                    <span className="malla-g">{g.toFixed(1)} g · {pct.toFixed(1)}%</span>
                  </div>
                  <div className="malla-bar"><div className="malla-fill" style={{ width: `${pct}%` }} /></div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Defectos primarios */}
      {(af.defectos_i || af.defectos_ii || af.broca_leve || af.broca_severa) && (
        <div className="ficha-section">
          <h3>Defectos primarios</h3>
          <DataGrid items={[
            { label: 'Defectos I (gr)',   value: af.defectos_i },
            { label: 'Defectos II (gr)',  value: af.defectos_ii },
            { label: 'Broca leve (gr)',   value: af.broca_leve },
            { label: 'Broca severa (gr)', value: af.broca_severa },
            { label: '% Grupo 1',         value: af.defectos_grupo1_pct },
            { label: '% Grupo 2',         value: af.defectos_grupo2_pct },
            { label: '% Broca',           value: af.broca_pct },
          ]} />
        </div>
      )}

      {/* Defectos detallados (solo los que tienen valor) */}
      {defectosConValor.length > 0 && (
        <div className="ficha-section">
          <h3>Defectos detallados <small>· {defectosConValor.length} de 19 tipos con dato</small></h3>
          <div className="ficha-defectos-grid">
            {defectosConValor.map((d, i) => (
              <div key={i} className="ficha-defecto">
                <span className="def-label">{d.label}</span>
                <span className="def-valor">{d.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observaciones */}
      {af.observaciones && (
        <div className="ficha-section">
          <h3>Observaciones</h3>
          <p className="ficha-obs">{af.observaciones}</p>
        </div>
      )}
    </section>
  )
}

function FichaAS({ as_data, numero }: { as_data: AnalisisSensorialFicha; numero: string }) {
  const total = as_data.scaa_total ? parseFloat(as_data.scaa_total) : 0
  const tone =
    total >= 90 ? 'green' :
    total >= 85 ? 'green' :
    total >= 80 ? 'tan' :
    total >= 75 ? 'navy' :
    'red'

  return (
    <section className="card ficha-as">
      <div className="ficha-header">
        <h2><FlaskConical size={20} /> Análisis sensorial</h2>
        <Link to={`/baches/${numero}/sensorial`} className="ficha-edit-link">Editar</Link>
      </div>

      <div className="ficha-meta">
        {as_data.fecha && <span><strong>Fecha:</strong> {as_data.fecha}</span>}
        {as_data.catador && <span><strong>Catador:</strong> {as_data.catador}</span>}
        {as_data.estado && (
          <span className={`as-estado-pill estado-${as_data.estado.toLowerCase()}`}>
            {as_data.estado}
          </span>
        )}
      </div>

      {/* SCA Total destacado */}
      {as_data.scaa_total && (
        <div className={`ficha-sca-display sca-${tone}`}>
          <div className="ficha-sca-num">{as_data.scaa_total}</div>
          <div className="ficha-sca-label">SCA Total</div>
        </div>
      )}

      {/* 10 puntajes con barras */}
      <div className="ficha-section">
        <h3>Atributos SCA</h3>
        <div className="ficha-puntajes">
          {as_data.puntajes.map((p, i) => (
            <div key={i} className="ficha-puntaje">
              <div className="puntaje-row">
                <span className="puntaje-name">{p.label}</span>
                <span className="puntaje-num">{p.valor.toFixed(2)}</span>
              </div>
              <div className="puntaje-bar">
                <div className="puntaje-fill" style={{ width: `${(p.valor / 10) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Perfil + notas */}
      {(as_data.perfil || as_data.notas || as_data.observaciones) && (
        <div className="ficha-section">
          <h3>Perfil sensorial</h3>
          {as_data.perfil && (
            <p className="ficha-perfil-macro"><strong>Macro:</strong> {as_data.perfil}</p>
          )}
          {as_data.notas && (
            <p className="ficha-perfil-notas"><strong>Notas:</strong> {as_data.notas}</p>
          )}
          {as_data.observaciones && (
            <p className="ficha-obs"><strong>Observaciones:</strong> {as_data.observaciones}</p>
          )}
        </div>
      )}
    </section>
  )
}

function construirFichaAF(row: string[]): AnalisisFisicoFicha {
  // Mallas N-T = índices 13-19 (gramos)
  const mallas_g = [13, 14, 15, 16, 17, 18, 19].map(i => parseFloat(row[i]) || 0)
  // Defectos detallados AE-AW = índices 30-48
  const defectos_detallados = DEFECTOS_LABELS.map((label, i) => ({
    label,
    valor: row[30 + i] || '0',
  }))
  return {
    codigo: row[0] || '',
    fecha: row[1],
    responsable: row[5],
    muestra_g: row[6],
    almendra_g: row[7],
    merma_pct: row[8],
    humedad: row[9],
    olor: row[10],
    color: row[11],
    caracol_g: row[12],
    mallas_g,
    defectos_i: row[20],
    defectos_ii: row[21],
    broca_leve: row[22],
    broca_severa: row[23],
    defectos_grupo1_pct: row[24],
    defectos_grupo2_pct: row[25],
    broca_pct: row[26],
    mallas_pct: row[27],
    excelso_final: row[28],
    observaciones: row[29],
    defectos_detallados,
  }
}

function construirFichaAS(row: string[]): AnalisisSensorialFicha {
  // 10 puntajes en cols F-O = índices 5-14
  const puntajes = ATRIBUTOS_SCA.map((label, i) => ({
    label,
    valor: parseFloat(row[5 + i]) || 0,
  }))
  return {
    fecha: row[0],
    catador: row[4],
    puntajes,
    scaa_total: row[15],
    observaciones: row[16],
    perfil: row[17],
    notas: row[18],
    estado: row[19],
  }
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
