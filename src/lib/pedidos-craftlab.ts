/**
 * pedidos-craftlab.ts — Capa de datos Supabase para el panel operario LP&ET.
 * Lee fb_orders + cl_orders, permite UPDATE de status, asignación via
 * order_tank_assignments, INSERT en order_updates, lectura de sensor_readings.
 *
 * ANTES DE USAR: ejecutar en Supabase SQL Editor las policies de lectura de equipo.
 * Ver bloque SQL al inicio de PedidosCraftLab.tsx.
 */

import { supabase } from './supabase'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PedidoRaw {
  id: string
  user_id: string
  status: string
  created_at: string
  // fb_orders específicos
  variety?: string
  process?: string
  total_kg?: number
  harvest_season?: string
  // cl_orders específicos
  quantity_kg?: number
  flavor_profile?: string
  notes?: string
}

export interface Pedido {
  id: string
  type: 'fb' | 'cl'
  user_id: string
  user_email: string
  variety: string
  process: string
  total_kg: number
  status: string
  /** ID del tanque actualmente asignado (de order_tank_assignments). Null si no hay. */
  tank_id: string | null
  tank_name: string
  created_at: string
  notes: string
}

export interface Tanque {
  id: string
  name: string
  status: string
  capacity_kg: number | null
}

export interface OrderUpdate {
  id: string
  order_type: 'fb' | 'cl'
  order_id: string
  stage: string
  message: string
  image_url: string | null
  posted_by: string
  created_at: string
}

export interface NewOrderUpdate {
  order_type: 'fb' | 'cl'
  order_id: string
  stage: string
  message: string
  image_url: string | null
  posted_by: string
}

export interface SensorReading {
  id: string
  ph: number | null
  temp_c: number | null
  brix: number | null
  recorded_at: string
}

// Mapeo de status a label legible
export const STATUS_LABELS: Record<string, string> = {
  pending:      'Pendiente',
  confirmed:    'Confirmado',
  fermentation: 'Fermentación',
  drying:       'Secado',
  ready:        'Listo',
  shipped:      'Despachado',
  delivered:    'Entregado',
  cancelled:    'Cancelado',
}

export const STATUS_ORDER = [
  'pending',
  'confirmed',
  'fermentation',
  'drying',
  'ready',
  'shipped',
  'delivered',
] as const

export type OrderStatus = typeof STATUS_ORDER[number]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeFbOrder(row: Record<string, unknown>): Pedido {
  return {
    id:         String(row.id ?? ''),
    type:       'fb',
    user_id:    String(row.user_id ?? ''),
    user_email: String((row as { profiles?: { email?: string } }).profiles?.email ?? row.user_id ?? ''),
    variety:    String(row.variety ?? '—'),
    process:    String(row.process ?? '—'),
    total_kg:   Number(row.total_kg ?? 0),
    status:     String(row.status ?? 'pending'),
    tank_id:    null,
    tank_name:  '—',
    created_at: String(row.created_at ?? ''),
    notes:      '',
  }
}

function normalizeClOrder(row: Record<string, unknown>): Pedido {
  return {
    id:         String(row.id ?? ''),
    type:       'cl',
    user_id:    String(row.user_id ?? ''),
    user_email: String((row as { profiles?: { email?: string } }).profiles?.email ?? row.user_id ?? ''),
    variety:    String(row.variety ?? '—'),
    process:    String(row.process ?? row.flavor_profile ?? '—'),
    total_kg:   Number(row.quantity_kg ?? row.total_kg ?? 0),
    status:     String(row.status ?? 'pending'),
    tank_id:    null,
    tank_name:  '—',
    created_at: String(row.created_at ?? ''),
    notes:      String(row.notes ?? ''),
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Carga todos los pedidos FB + CL en paralelo.
 * Resuelve tank_id y tank_name via order_tank_assignments (released_at IS NULL).
 */
export async function cargarTodosPedidos(): Promise<Pedido[]> {
  const [fbResult, clResult] = await Promise.all([
    supabase.from('fb_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('cl_orders').select('*').order('created_at', { ascending: false }),
  ])

  if (fbResult.error) console.error('cargarTodosPedidos fb_orders error:', fbResult.error)
  if (clResult.error) console.error('cargarTodosPedidos cl_orders error:', clResult.error)

  const fbOrders: Pedido[] = (fbResult.data ?? []).map(r =>
    normalizeFbOrder(r as Record<string, unknown>)
  )
  const clOrders: Pedido[] = (clResult.data ?? []).map(r =>
    normalizeClOrder(r as Record<string, unknown>)
  )

  const all = [...fbOrders, ...clOrders]

  // Resolver tank_id + tank_name vía order_tank_assignments (asignaciones activas)
  if (all.length > 0) {
    const { data: assignments, error: aErr } = await supabase
      .from('order_tank_assignments')
      .select('order_type, order_id, tank_id, tanks(name)')
      .is('released_at', null)

    if (aErr) {
      console.error('cargarTodosPedidos assignments error:', aErr)
    } else {
      const tankByOrderKey = new Map<string, { id: string; name: string }>()
      for (const row of (assignments ?? []) as Array<{
        order_type: string
        order_id: string
        tank_id: string
        tanks?: { name?: string }
      }>) {
        if (row.tanks?.name) {
          tankByOrderKey.set(`${row.order_type}:${row.order_id}`, {
            id: row.tank_id,
            name: row.tanks.name,
          })
        }
      }
      for (const p of all) {
        const key = `${p.type}:${p.id}`
        const tank = tankByOrderKey.get(key)
        if (tank) {
          p.tank_id   = tank.id
          p.tank_name = tank.name
        }
      }
    }
  }

  // Ordenar por created_at desc
  return all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

/**
 * Actualiza el status de un pedido (fb o cl).
 */
export async function actualizarStatus(
  type: 'fb' | 'cl',
  id: string,
  status: string
): Promise<void> {
  const table = type === 'fb' ? 'fb_orders' : 'cl_orders'
  const { error } = await supabase
    .from(table)
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Error actualizando status: ${error.message}`)
}

/**
 * Asigna un tanque a un pedido vía order_tank_assignments.
 * Cierra cualquier asignación activa previa (released_at = NOW()) y crea una nueva.
 * También actualiza tanks.current_order_* para indicar uso.
 */
export async function asignarTanque(
  type: 'fb' | 'cl',
  order_id: string,
  tank_id: string
): Promise<void> {
  // 1. Cerrar asignaciones previas activas
  const { error: closeErr } = await supabase
    .from('order_tank_assignments')
    .update({ released_at: new Date().toISOString() })
    .eq('order_type', type)
    .eq('order_id', order_id)
    .is('released_at', null)
  if (closeErr) throw new Error(`Cerrar asignación previa: ${closeErr.message}`)

  // 2. Insertar nueva asignación
  const { error: insErr } = await supabase
    .from('order_tank_assignments')
    .insert({ order_type: type, order_id, tank_id })
  if (insErr) throw new Error(`Crear asignación: ${insErr.message}`)

  // 3. Actualizar tanks.current_order_* (no fatal si falla)
  const { error: tErr } = await supabase
    .from('tanks')
    .update({
      status: 'in_use',
      current_order_type: type,
      current_order_id: order_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tank_id)
  if (tErr) console.error('Update tank status (no fatal):', tErr)
}

/**
 * @deprecated Usar asignarTanque() en su lugar.
 * Esta función escribía lote_id en fb/cl_orders, que no es el bridge correcto.
 */
export async function asignarLote(
  _type: 'fb' | 'cl',
  _id: string,
  _lote_id: string
): Promise<void> {
  throw new Error('asignarLote() está deprecada. Usar asignarTanque() con order_tank_assignments.')
}

/**
 * Carga todos los tanques (para el modal de asignación, incluyendo ocupados).
 */
export async function cargarTodosLosTanques(): Promise<Tanque[]> {
  const { data, error } = await supabase
    .from('tanks')
    .select('id, name, status, capacity_kg')
    .order('name')
  if (error) throw new Error(`Error cargando tanques: ${error.message}`)
  return (data ?? []) as Tanque[]
}

/**
 * Carga los updates de un pedido específico (orden cronológico descendente).
 */
export async function cargarUpdates(
  type: 'fb' | 'cl',
  order_id: string
): Promise<OrderUpdate[]> {
  const { data, error } = await supabase
    .from('order_updates')
    .select('*')
    .eq('order_type', type)
    .eq('order_id', order_id)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Error cargando updates: ${error.message}`)
  return (data ?? []) as OrderUpdate[]
}

/**
 * Inserta un nuevo update de pedido.
 */
export async function insertarUpdate(update: NewOrderUpdate): Promise<void> {
  const { error } = await supabase.from('order_updates').insert(update)
  if (error) throw new Error(`Error insertando update: ${error.message}`)
}

/**
 * Carga las últimas N lecturas de sensor de un tanque (orden cronológico ascendente).
 */
export async function cargarReadings(tankId: string, limit = 30): Promise<SensorReading[]> {
  const { data, error } = await supabase
    .from('sensor_readings')
    .select('id, ph, temp_c, brix, recorded_at')
    .eq('tank_id', tankId)
    .order('recorded_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Error cargando readings: ${error.message}`)
  return ((data ?? []) as SensorReading[]).reverse() // cronológico ascendente
}
