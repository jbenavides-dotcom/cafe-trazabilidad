// Tipos del dominio café trazabilidad — alineados con el flujo en Sheets 2026
// Documentación completa: memory/project_cafe-trazabilidad-flujo-refinado-6may.md

import {
  readRange, writeRange, deleteRow,
  SHEET_2026_ID, OFFERINGLIST_ID,
} from './sheets'

export type Proceso = 'Natural' | 'Lactico' | 'Bio Washed' | 'Bio Natural' | 'pH Clarity'

export type Variedad =
  | 'Geisha'
  | 'Sidra'
  | 'Java'
  | 'Borbón Amarillo'
  | 'Mokka'
  | 'Castillo'
  | 'Tabi'
  | 'Tekisic'

export type Programa = 'VARIETALES' | 'VECINOS' | 'TOSTADO'

export type ProyectoDestino = 'PT_EQ' | 'PT_TOSTADO'

export type EstadoBache = 'En Proceso' | 'Entregado a Analisis'

export type EstadoAS = 'APROBADO' | 'RECHAZADO' | ''

export type Origen = 'LP&ET' | 'Diego Vélez' | 'Mejores Vecinos' | 'CraftLab'

/** Bache CFF Sección 1 */
export interface Bache {
  fecha_entrada: string      // CFF.A
  fecha_cosecha: string      // CFF.B
  remision: string           // CFF.C
  numero_bache: string       // CFF.D — clave única (ej. 001-26, 008-26T)
  proveedor: string          // CFF.E
  programa: Programa         // CFF.F
  calidad_ccf: string        // CFF.G — A/B/C
  proceso: Proceso           // CFF.H
  variedad: Variedad         // CFF.I
  kg_ccf: number             // CFF.J — kg cereza fresca al entrar
  destino: ProyectoDestino   // CFF.K
  estado: EstadoBache        // CFF.L — trigger CFF→AF/AS
}

/** Análisis Físico AF (Sergio) */
export interface AnalisisFisico {
  codigo: string             // AF.A — # bache
  fecha_analisis?: string    // AF.B
  // C, D autocalculadas (proceso, variedad)
  fr_calculado?: number      // AF.E
  responsable?: string       // AF.F — Sergio
  muestra_gr?: number        // AF.G
  almendra_gr?: number       // AF.H
  merma_pct?: number         // AF.I
  humedad_pct?: number       // AF.J
  olor?: string              // AF.K
  color?: string             // AF.L
  // ... 40+ columnas más
}

/** Análisis Sensorial AS (Ismelda) */
export interface AnalisisSensorial {
  fecha?: string             // AS.A
  batch: string              // AS.B
  // C, D autocalculadas
  catador?: string           // AS.E
  fragancia?: number         // AS.F
  sabor?: number             // AS.G
  residual?: number          // AS.H
  acidez?: number            // AS.I
  balance?: number           // AS.J
  cuerpo?: number            // AS.K
  uniformidad?: number       // AS.L — default 10
  taza_limpia?: number       // AS.M — default 10
  dulzor?: number            // AS.N — default 10
  global?: number            // AS.O
  scaa_total?: number        // AS.P — calculado: F+G+H+I+J+K+L+M+N+O
  observaciones?: string     // AS.Q
  macro_perfil?: string      // AS.R — ej. "CITRICO-DULCE"
  notas_atributos?: string   // AS.S — ej. "MANDARINA-AZUCARMORENA"
  estado: EstadoAS           // AS.T — APROBADO / RECHAZADO
}

/** Asignación a nanolote — MX_V (LP&ET) o MX_MV (Vecinos) */
export interface AsignacionNanolote {
  codigo_nanolote: string    // MX_V.A (verde, lo escribe catador en fila summary)
  batch: string              // MX_V.B (escrito por v3 cuando AS aprueba)
  // C-W autocalculadas
  combina_con?: string       // MX_V.X — código nanolote destino (regla N≥2 baches)
}

/** Nanolote consolidado — CFF Sección 3
 *
 * IMPORTANTE: hay DOS pesos diferentes para el mismo nanolote (Sergio 2026-05-06):
 * - kg_cps_*: café seco SIN trillar SIN despacillar (CPS/CCS) → CFF Inventario General
 * - kg_excelso: ALMENDRA VERDE (post-trilla teórica = CPS × 70/FR) → Seguimiento + OfferingList
 */
export interface Nanolote {
  fecha_entrada: string      // CFF.AG
  categoria: Programa        // CFF.AH
  codigo: string             // CFF.AI — ej. PTNLG26001
  proceso_nanolote: Proceso  // CFF.AJ
  variedad: Variedad         // CFF.AK
  destino: ProyectoDestino   // CFF.AL
  kg_cps_brutos: number      // CFF.AM — suma kg DISP CPS de baches
  kg_muestra: number         // CFF.AN — MicroMuestra MX_V.J5 / 1000 (en CPS)
  kg_cps_netos: number       // CFF.AO — brutos - muestra (CPS post muestra)
  kg_cps_disponibles: number // CFF.AP — inicial = netos
  // No persistido en CFF S3, viene de MX_V!M5
  kg_excelso?: number        // ALMENDRA VERDE = MX_V.M (post-trilla teórica) → OfferingList + Seguimiento
}

/** Pesos del nanolote calculados desde MX_V */
export interface NanolotePesos {
  kg_cps_mezclados: number   // MX_V.H5 (suma) — total CPS mezclado
  kg_muestra_g: number       // MX_V.J5 — gramos de muestra
  factor_rendimiento: number // MX_V.K5 — FR ponderado (típico 140)
  kg_excelso_teorico: number // MX_V.M5 — almendra verde (= H × 70/K)
  pct_merma_total: number    // MX_V.L5 — % merma cereza→excelso
}

/** OfferingList!PT — catálogo vendible (en kg ALMENDRA VERDE) */
export interface Oferta {
  project: 'PT'              // OfferingList.A
  program: 'NL'              // OfferingList.B
  code: string               // OfferingList.C — código nanolote
  status: 'Libre' | 'Bloqueado'  // OfferingList.D
  edition?: string           // OfferingList.E
  variety: Variedad          // OfferingList.F
  process: Proceso           // OfferingList.G
  provider: string           // OfferingList.H
  // I autocalculada (Disponibilidad: =IF(L=0,"No Disponibles","Disponibles"))
  total_excelso_kg: number   // OfferingList.J — kg ALMENDRA VERDE (NO CPS)
  total_salidas_kg: number   // OfferingList.K — suma vendido
  // L = J-K (Kg Disponibles), M = J/25 (Box x 25 Kg) — autocalculadas
}

/** Salida de café — CFF Sección 4 (Salidas Lotes-Trilla) */
export interface SalidaTrilla {
  numero_nanolote: string    // CFF.AR
  // AS, AT, AU, AV autocalculadas (proceso, variedad, kg netos, kg disp)
  kg_de_salida: number       // CFF.AW
  numero_sa?: string         // CFF.AX
  fecha_entrega: string      // CFF.AY
  puntaje_sca?: number       // CFF.AZ
  cliente?: string           // (no en sheet, solo metadata local)
}

// ─── Constantes / utilidades ───

export const PROCESOS: Proceso[] = ['Natural', 'Lactico', 'Bio Washed', 'Bio Natural', 'pH Clarity']

export const VARIEDADES: Variedad[] = [
  'Geisha', 'Sidra', 'Java', 'Borbón Amarillo', 'Mokka', 'Castillo', 'Tabi', 'Tekisic',
]

/** Detecta origen de un bache por sufijo del código */
export function origenDeBache(numero_bache: string, proveedor = ''): Origen {
  if (proveedor.toUpperCase().includes('VECINO')) return 'Mejores Vecinos'
  if (numero_bache.endsWith('CL')) return 'CraftLab'
  if (numero_bache.endsWith('d')) return 'Diego Vélez'
  if (numero_bache.endsWith('T') || numero_bache.endsWith('m')) return 'Mejores Vecinos'
  return 'LP&ET'
}

/** Formatea número de bache: '001-26' (3 dígitos + año) */
export function formatBacheNumber(num: number, year: number = 26): string {
  return `${num.toString().padStart(3, '0')}-${year}`
}

/** Calcula excelso teórico (almendra verde) desde CPS y Factor Rendimiento.
 *  Excelso = CPS × (70 / FR). FR típico = 140 → 50% merma. */
export function calcularExcelso(kg_cps: number, factor_rendimiento: number = 140): number {
  if (!factor_rendimiento) return 0
  return Number((kg_cps * (70 / factor_rendimiento)).toFixed(2))
}

/** Tamaños de caja LP&ET (múltiplos de 12.5 kg) */
export const CAJA_KG = 12.5

/**
 * Redondea hacia abajo al múltiplo de caja_kg más cercano.
 * Sergio: "ofertamos en cajas redondas, redondeamos por debajo".
 *  12.55 → 12.5 (1 caja)
 *  27    → 25   (2 cajas)
 *  38.4  → 37.5 (3 cajas)
 */
export function redondearACajas(excelso_teorico: number, caja_kg: number = CAJA_KG): number {
  if (!excelso_teorico || excelso_teorico < caja_kg) return 0
  return Math.floor(excelso_teorico / caja_kg) * caja_kg
}

/** Cuenta cuántas cajas de 12.5 kg da un excelso teórico */
export function cajas12_5(excelso_teorico: number): number {
  return Math.floor(excelso_teorico / CAJA_KG)
}

/** Suma 10 puntajes SCA (cada uno 6.00–10.00). Total típico premium: 84-90 */
export function calcularSCATotal(p: {
  fragancia?: number; sabor?: number; residual?: number; acidez?: number;
  balance?: number; cuerpo?: number; uniformidad?: number; taza_limpia?: number;
  dulzor?: number; global?: number;
}): number {
  const vals = [
    p.fragancia, p.sabor, p.residual, p.acidez, p.balance,
    p.cuerpo, p.uniformidad ?? 10, p.taza_limpia ?? 10, p.dulzor ?? 10, p.global,
  ].map(v => Number(v) || 0)
  return Number(vals.reduce((a, b) => a + b, 0).toFixed(2))
}

/** Clasifica el SCA según escala SCA (Specialty Coffee Association) */
export function clasificarSCA(total: number): { label: string; tone: 'green'|'tan'|'navy'|'red' } {
  if (total >= 90) return { label: 'Outstanding', tone: 'green' }
  if (total >= 85) return { label: 'Excellent', tone: 'green' }
  if (total >= 80) return { label: 'Specialty', tone: 'tan' }
  if (total >= 75) return { label: 'Premium',   tone: 'navy' }
  return { label: 'Comercial', tone: 'red' }
}

// ─── Acciones sobre baches ───

/**
 * Cambia el estado de un bache en CFF!L.
 * Cambiar a "Entregado a Analisis" dispara la propagación a AF + AS
 * (vía fórmulas VLOOKUP en col C, D de AF y AS).
 *
 * Busca la fila por #bache (CFF col D, datos desde fila 5) y escribe CFF!L{row}.
 */
export async function cambiarEstadoBache(
  numero_bache: string,
  nuevo_estado: EstadoBache,
): Promise<number> {
  const codigos = await readRange(SHEET_2026_ID, 'CFF!D5:D200')
  const idx = codigos.findIndex(r => r[0]?.trim() === numero_bache)
  if (idx < 0) throw new Error(`Bache ${numero_bache} no encontrado en CFF`)
  const row = idx + 5
  await writeRange(SHEET_2026_ID, `CFF!L${row}`, [[nuevo_estado]])
  return row
}

// ─── Despacho de nanolotes (T7 ventas) ───

export interface DespachoResult {
  tipo: 'parcial' | 'total'
  fila_offeringlist: number
  kg_vendidos: number
  kg_disponibles_antes: number
  kg_disponibles_despues: number
  ms_total: number
  recordar_seguimiento: boolean
}

/**
 * Despacho de un nanolote desde OfferingList.
 *
 * - Si kg_vendidos = kg_disponibles → DESPACHO TOTAL: borra la fila de OL.
 * - Si kg_vendidos < kg_disponibles → DESPACHO PARCIAL: incrementa K (Total salidas).
 *   La fórmula L=J-K e I=IF(L=0,...) recalculan solas.
 *
 * NO toca Seguimiento .xlsx (la API de Sheets no edita Office files).
 * El equipo debe actualizar Seguimiento manualmente — la pantalla muestra recordatorio.
 *
 * @param codigo_nanolote ej. "PTNLG26001"
 * @param kg_vendidos kg que sale al cliente
 */
export async function despacharNanolote(
  codigo_nanolote: string,
  kg_vendidos: number,
): Promise<DespachoResult> {
  if (kg_vendidos <= 0) throw new Error('kg_vendidos debe ser > 0')

  const t0 = performance.now()

  // 1. Buscar fila del nanolote en OfferingList!PT (datos desde R5)
  const rows = await readRange(OFFERINGLIST_ID, 'PT!A4:L100')
  // Header en R4 — buscar desde R5 (índice 1)
  const idx = rows.slice(1).findIndex(r => (r[2] || '').trim() === codigo_nanolote)
  if (idx < 0) throw new Error(`Nanolote ${codigo_nanolote} no está en OfferingList`)

  const fila = idx + 5  // +1 por header en R4 + offset de slice + 1 (1-indexed)
  const row = rows[idx + 1]

  const total_excelso = parseFloat((row[9] || '0').replace(',', '.'))     // J
  const salidas_actuales = parseFloat((row[10] || '0').replace(',', '.')) // K
  const kg_disp = total_excelso - salidas_actuales                       // L=J-K

  if (kg_vendidos > kg_disp + 0.01) {
    throw new Error(`Solo hay ${kg_disp} kg disponibles, se intentó vender ${kg_vendidos}`)
  }

  const es_total = Math.abs(kg_vendidos - kg_disp) < 0.01

  if (es_total) {
    // DESPACHO TOTAL → borrar fila completa
    await deleteRow(OFFERINGLIST_ID, 'PT', fila)
  } else {
    // DESPACHO PARCIAL → incrementar K (Total salidas)
    const nuevas_salidas = Number((salidas_actuales + kg_vendidos).toFixed(2))
    await writeRange(OFFERINGLIST_ID, `PT!K${fila}`, [[nuevas_salidas]])
  }

  return {
    tipo: es_total ? 'total' : 'parcial',
    fila_offeringlist: fila,
    kg_vendidos,
    kg_disponibles_antes: kg_disp,
    kg_disponibles_despues: es_total ? 0 : kg_disp - kg_vendidos,
    ms_total: performance.now() - t0,
    recordar_seguimiento: true,
  }
}

/**
 * Verifica si es seguro revertir el estado a "En Proceso".
 * Solo permitido si nadie ha empezado AF ni AS.
 *
 * Lee AF (col J = humedad) y AS (col F = primer puntaje SCA) buscando el bache.
 * Si alguno tiene dato distinto de #N/A, NO se puede revertir.
 */
export async function puedeRevertirseEstado(numero_bache: string): Promise<{
  puede: boolean
  razon?: string
}> {
  const data = await readRange(SHEET_2026_ID, 'AF!A2:T200')
  const af_row = data.find(r => r[0]?.trim() === numero_bache)
  // AF.J = humedad (índice 9). Si tiene número, Sergio ya empezó.
  if (af_row && af_row[9] && !isNaN(parseFloat(af_row[9]))) {
    return { puede: false, razon: 'Sergio ya guardó datos en el análisis físico' }
  }
  // AS.F = fragancia (primer puntaje, índice 5 desde col A → leemos AS!A2:F200)
  const as_data = await readRange(SHEET_2026_ID, 'AS!A2:F200')
  const as_row = as_data.find(r => r[1]?.trim() === numero_bache)
  if (as_row && as_row[5] && !isNaN(parseFloat(as_row[5]))) {
    return { puede: false, razon: 'Ismelda ya empezó el análisis sensorial' }
  }
  return { puede: true }
}
