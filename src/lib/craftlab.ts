// Lógica del módulo CraftLab — peticiones de cliente con comprador asignado
// Flujo: Solicitud → Buscando match → Asignada → En proceso → Lista despacho → Despachada
// Las peticiones viven en pestaña CL_PETICIONES del Sheet 2026.

import {
  appendRow, batchGet, readRange, writeRange,
  sheetExists, createSheetWithHeaders,
  SHEET_2026_ID,
} from './sheets'

export const CL_PESTANA = 'CL_PETICIONES'

export const CL_HEADERS = [
  'Código petición',     // A
  'Fecha solicitud',     // B
  'Cliente',             // C
  'Contacto',            // D
  'Variedad deseada',    // E
  'Proceso deseado',     // F
  'Kg solicitados',      // G
  'SCA mínimo',          // H
  'Perfil deseado',      // I
  'Precio acordado USD', // J
  'Fecha entrega',       // K
  'Estado',              // L
  'Bache/Nanolote',      // M
  'Origen',              // N
  'Área encargada',      // O
  'Notas internas',      // P
  'Fecha asignación',    // Q
  'Fecha despacho',      // R
] as const

export type EstadoCL =
  | 'Solicitud'
  | 'Buscando'
  | 'Asignada'
  | 'En proceso'
  | 'Lista despacho'
  | 'Despachada'
  | 'Cancelada'

export type OrigenCL = '' | 'stock_existente' | 'produccion_nueva'
export type AreaCL = 'Calidad' | 'Producción'

export interface PeticionCL {
  fila: number              // fila absoluta en el Sheet (>=2)
  codigo: string
  fecha_solicitud: string
  cliente: string
  contacto: string
  variedad: string
  proceso: string
  kg: number
  sca_min: number
  perfil: string
  precio_usd: number
  fecha_entrega: string
  estado: EstadoCL
  bache_nanolote: string    // ej. "PTNLG26002" o "015-26CL"
  origen: OrigenCL
  area: AreaCL | ''
  notas: string
  fecha_asignacion: string
  fecha_despacho: string
}

/** Asegura que la pestaña CL_PETICIONES exista. La crea con headers si no existe.
 *  Tolerante a race-condition (React StrictMode dispara efectos 2x en dev): si
 *  alguien la creó entre nuestro check y la creación, no falla.
 */
export async function asegurarPestanaCL(): Promise<{ creada: boolean }> {
  const existe = await sheetExists(SHEET_2026_ID, CL_PESTANA)
  if (existe) return { creada: false }
  try {
    await createSheetWithHeaders(SHEET_2026_ID, CL_PESTANA, [...CL_HEADERS])
    return { creada: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    // Si Google ya respondió "Ya existe una hoja…" tratamos como caso normal
    if (msg.includes('Ya existe') || msg.includes('already exists')) {
      return { creada: false }
    }
    throw e
  }
}

/** Lee todas las peticiones del Sheet */
export async function listarPeticionesCL(): Promise<PeticionCL[]> {
  const data = await readRange(SHEET_2026_ID, `${CL_PESTANA}!A2:R200`)
  return data
    .map((row, i) => parseRow(row, i + 2))
    .filter((p): p is PeticionCL => p !== null)
}

function parseRow(row: string[], fila: number): PeticionCL | null {
  const codigo = (row[0] || '').trim()
  if (!codigo) return null
  return {
    fila,
    codigo,
    fecha_solicitud: row[1] || '',
    cliente: row[2] || '',
    contacto: row[3] || '',
    variedad: row[4] || '',
    proceso: row[5] || '',
    kg: parseFloat(row[6]) || 0,
    sca_min: parseFloat(row[7]) || 0,
    perfil: row[8] || '',
    precio_usd: parseFloat(row[9]) || 0,
    fecha_entrega: row[10] || '',
    estado: ((row[11] || 'Solicitud') as EstadoCL),
    bache_nanolote: row[12] || '',
    origen: ((row[13] || '') as OrigenCL),
    area: ((row[14] || '') as AreaCL | ''),
    notas: row[15] || '',
    fecha_asignacion: row[16] || '',
    fecha_despacho: row[17] || '',
  }
}

/** Genera el siguiente código CL-2026-NNN basado en las peticiones existentes */
export async function siguienteCodigoCL(year = 26): Promise<string> {
  const peticiones = await listarPeticionesCL()
  const yearPad = String(year).padStart(2, '0')
  const prefix = `CL-20${yearPad}-`
  let max = 0
  for (const p of peticiones) {
    if (p.codigo.startsWith(prefix)) {
      const n = parseInt(p.codigo.slice(prefix.length), 10)
      if (!isNaN(n) && n > max) max = n
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** Crea una nueva petición y la agrega al Sheet */
export async function crearPeticionCL(
  input: Omit<PeticionCL, 'fila' | 'codigo' | 'fecha_solicitud' | 'estado' | 'bache_nanolote' | 'origen' | 'fecha_asignacion' | 'fecha_despacho'>,
): Promise<{ codigo: string; fila: number }> {
  const codigo = await siguienteCodigoCL()
  const hoy = new Date().toLocaleDateString('es-CO')
  const fila: (string | number)[] = [
    codigo,                  // A
    hoy,                     // B
    input.cliente,           // C
    input.contacto,          // D
    input.variedad,          // E
    input.proceso,           // F
    input.kg || 0,           // G
    input.sca_min || 0,      // H
    input.perfil,            // I
    input.precio_usd || 0,   // J
    input.fecha_entrega,     // K
    'Solicitud',             // L
    '',                      // M
    '',                      // N
    input.area,              // O
    input.notas,             // P
    '',                      // Q
    '',                      // R
  ]
  await appendRow(SHEET_2026_ID, `${CL_PESTANA}!A2:R2`, fila)
  // No tenemos la fila exacta — la próxima carga la trae
  return { codigo, fila: -1 }
}

/** Actualiza el estado y campos relacionados de una petición */
export async function actualizarPeticionCL(
  fila: number,
  cambios: Partial<Pick<PeticionCL,
    'estado' | 'bache_nanolote' | 'origen' | 'area' | 'notas' |
    'fecha_asignacion' | 'fecha_despacho'
  >>,
): Promise<void> {
  // Construimos un mini-batch: leemos primero la fila completa, luego
  // reescribimos solo los campos cambiados.
  const data = await batchGet(SHEET_2026_ID, [`${CL_PESTANA}!A${fila}:R${fila}`])
  const row = data[`${CL_PESTANA}!A${fila}:R${fila}`]?.[0] || []

  // Mapeo de cambios → índice de columna (0-indexed dentro del rango A:R)
  const colMap: Record<keyof typeof cambios, number> = {
    estado: 11,             // L
    bache_nanolote: 12,     // M
    origen: 13,             // N
    area: 14,               // O
    notas: 15,              // P
    fecha_asignacion: 16,   // Q
    fecha_despacho: 17,     // R
  }

  const newRow = [...row]
  // Asegurar que tenga 18 elementos
  while (newRow.length < 18) newRow.push('')

  for (const k in cambios) {
    const idx = colMap[k as keyof typeof cambios]
    const val = cambios[k as keyof typeof cambios] ?? ''
    newRow[idx] = String(val)
  }

  await writeRange(SHEET_2026_ID, `${CL_PESTANA}!A${fila}:R${fila}`, [newRow])
}

/** Busca matches en MX_V para una petición (variedad, proceso, SCA mínimo) */
export interface MatchNanolote {
  fila: number
  codigo: string  // PTNLG26001
  variedad: string
  proceso: string
  sca: string
  kg_excelso: string
}

export async function buscarMatchesEnStock(
  filtros: { variedad?: string; proceso?: string; sca_min?: number },
): Promise<MatchNanolote[]> {
  const data = await readRange(SHEET_2026_ID, 'MX_V!A4:N120')
  const REGEX = /^PT[A-Z]{2,3}\d{4,5}$/i
  const out: MatchNanolote[] = []
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const codigo = (row[0] || '').trim()
    if (!REGEX.test(codigo)) continue
    const variedad = row[2] || ''
    const proceso = row[3] || ''
    const sca = parseFloat(row[13]) || 0
    if (filtros.variedad && filtros.variedad !== variedad) continue
    if (filtros.proceso && filtros.proceso !== proceso) continue
    if (filtros.sca_min && sca < filtros.sca_min) continue
    out.push({
      fila: i + 4,
      codigo,
      variedad,
      proceso,
      sca: row[13] || '',
      kg_excelso: row[12] || '',
    })
  }
  return out
}

/** Etiquetas legibles de los estados (para badges) */
export const ESTADO_LABEL: Record<EstadoCL, { label: string; tone: 'tan' | 'navy' | 'green' | 'red' | 'gray' }> = {
  'Solicitud':       { label: 'Solicitud',       tone: 'navy' },
  'Buscando':        { label: 'Buscando',        tone: 'tan' },
  'Asignada':        { label: 'Asignada',        tone: 'tan' },
  'En proceso':      { label: 'En proceso',      tone: 'tan' },
  'Lista despacho':  { label: 'Lista para despacho', tone: 'green' },
  'Despachada':      { label: 'Despachada',      tone: 'green' },
  'Cancelada':       { label: 'Cancelada',       tone: 'gray' },
}
