/**
 * pedidos-craftlab.ts — Capa de datos Supabase para el panel operario LP&ET.
 * Lee fb_orders + cl_orders, permite UPDATE de status/lote_id, INSERT en order_updates.
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
  lote_id: string | null
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
  lote_id: string | null
  tank_name: string
  created_at: string
  notes: string
}

export interface Tanque {
  id: string
  name: string
  status: string
  capacity_liters: number | null
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
    lote_id:    row.lote_id != null ? String(row.lote_id) : null,
    tank_name:  String((row as { lotes?: { tanks?: { name?: string } } }).lotes?.tanks?.name ?? '—'),
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
    lote_id:    row.lote_id != null ? String(row.lote_id) : null,
    tank_name:  String((row as { lotes?: { tanks?: { name?: string } } }).lotes?.tanks?.name ?? '—'),
    created_at: String(row.created_at ?? ''),
    notes:      String(row.notes ?? ''),
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Carga todos los pedidos FB + CL en paralelo.
 * Hace queries simples sin joins (más robusto). Si necesita tank_name lo
 * resuelve con queries separadas a lotes + tanks.
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

  // Resolver tank_name vía join lotes → tanks (solo para los pedidos con lote_id)
  const loteIds = Array.from(new Set(all.map(p => p.lote_id).filter(Boolean) as string[]))
  if (loteIds.length > 0) {
    const { data: lotesData, error: lotesErr } = await supabase
      .from('lotes')
      .select('id, tank_id, tanks(name)')
      .in('id', loteIds)
    if (lotesErr) {
      console.error('cargarTodosPedidos lotes error:', lotesErr)
    } else {
      const tankByLoteId = new Map<string, string>()
      for (const row of (lotesData ?? []) as Array<{ id: string; tanks?: { name?: string } }>) {
        if (row.tanks?.name) tankByLoteId.set(row.id, row.tanks.name)
      }
      for (const p of all) {
        if (p.lote_id && tankByLoteId.has(p.lote_id)) {
          p.tank_name = tankByLoteId.get(p.lote_id)!
        }
      }
    }
  }

  // Mezclar y ordenar por created_at desc
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
 * Asigna un lote_id existente a un pedido.
 */
export async function asignarLote(
  type: 'fb' | 'cl',
  id: string,
  lote_id: string
): Promise<void> {
  const table = type === 'fb' ? 'fb_orders' : 'cl_orders'
  const { error } = await supabase
    .from(table)
    .update({ lote_id, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`Error asignando lote: ${error.message}`)
}

/**
 * Carga tanques disponibles para el selector.
 */
export async function cargarTanques(): Promise<Tanque[]> {
  const { data, error } = await supabase
    .from('tanks')
    .select('id, name, status, capacity_liters')
    .eq('status', 'available')
    .order('name')
  if (error) throw new Error(`Error cargando tanques: ${error.message}`)
  return (data ?? []) as Tanque[]
}

/**
 * Carga todos los tanques (para el modal de asignación, incluyendo ocupados).
 */
export async function cargarTodosLosTanques(): Promise<Tanque[]> {
  const { data, error } = await supabase
    .from('tanks')
    .select('id, name, status, capacity_liters')
    .order('name')
  if (error) throw new Error(`Error cargando tanques: ${error.message}`)
  return (data ?? []) as Tanque[]
}

/**
 * Carga los updates de un pedido específico.
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
