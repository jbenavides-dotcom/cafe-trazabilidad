// Registro de eventos del flujo café — localStorage + webhook n8n
// Permite mostrar tiempos transcurridos entre etapas y notificar a roles externos.

const STORAGE_KEY = 'cafe-trazabilidad-eventos'
const WEBHOOK = import.meta.env.VITE_N8N_WEBHOOK_EVENTOS || ''
const LIMITE = 500  // últimos 500 eventos en localStorage

export type EventoTipo =
  | 'estado_cambiado'      // Bache cambió de "En Proceso" ↔ "Entregado a Analisis"
  | 'af_guardado'          // Sergio guardó análisis físico
  | 'as_guardado'          // Ismelda guardó análisis sensorial (sin estado)
  | 'as_aprobado'          // Bache aprobado en cata
  | 'as_rechazado'         // Bache rechazado en cata
  | 'estado_revertido'     // Devuelto de "Entregado" a "En Proceso"

export interface Evento {
  tipo: EventoTipo
  bache: string
  detalle?: string
  usuario: string         // email del usuario logueado
  antes?: string
  despues?: string
  ts: number              // Date.now()
}

interface UsuarioRef {
  email?: string
  name?: string
}

/** Persiste localmente y dispara webhook (silencioso si falla) */
export function registrarEvento(input: {
  tipo: EventoTipo
  bache: string
  detalle?: string
  antes?: string
  despues?: string
  usuario: UsuarioRef | null
}): Evento {
  const evento: Evento = {
    tipo: input.tipo,
    bache: input.bache,
    detalle: input.detalle,
    antes: input.antes,
    despues: input.despues,
    usuario: input.usuario?.email ?? input.usuario?.name ?? 'desconocido',
    ts: Date.now(),
  }

  // 1) localStorage
  const lista = listarEventos()
  lista.push(evento)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(-LIMITE)))
  } catch {
    /* localStorage lleno, ignorar */
  }

  // 2) webhook n8n (silencioso, no bloqueante)
  if (WEBHOOK) {
    void fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...evento,
        fecha_iso: new Date(evento.ts).toISOString(),
        // Sugerencia destinatarios — en n8n decides a quién mandar
        roles_objetivo: rolesParaTipo(evento.tipo),
      }),
    }).catch(err => console.warn('[eventos] webhook falló:', err))
  }

  return evento
}

function rolesParaTipo(tipo: EventoTipo): string[] {
  switch (tipo) {
    case 'estado_cambiado':
    case 'estado_revertido':
      return ['sergio', 'ismelda']  // ambos deben saber que entró/salió de la cola
    case 'af_guardado':
      return ['ismelda']            // ya puede catar
    case 'as_aprobado':
    case 'as_rechazado':
      return ['john', 'felipe']     // John combina, Felipe se entera de aprobaciones
    case 'as_guardado':
      return ['ismelda']            // confirmación a la propia catadora
    default:
      return []
  }
}

export function listarEventos(): Evento[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try { return JSON.parse(raw) as Evento[] } catch { return [] }
}

export function eventosDeBache(bache: string): Evento[] {
  return listarEventos()
    .filter(e => e.bache === bache)
    .sort((a, b) => a.ts - b.ts)
}

export function ultimoEventoDeTipo(bache: string, tipo: EventoTipo): Evento | undefined {
  const eventos = eventosDeBache(bache).filter(e => e.tipo === tipo)
  return eventos[eventos.length - 1]
}

/** Formato humano: "5 min", "2h 15min", "3d 5h" */
export function tiempoRelativo(desde: number, hasta = Date.now()): string {
  const ms = Math.max(0, hasta - desde)
  const seg = Math.floor(ms / 1000)
  if (seg < 60) return `${seg}s`
  const min = Math.floor(seg / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ${min % 60}min`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}

/** Etiqueta legible del tipo de evento */
export function etiquetaTipo(tipo: EventoTipo): string {
  switch (tipo) {
    case 'estado_cambiado':  return 'Estado cambiado'
    case 'estado_revertido': return 'Devuelto a En Proceso'
    case 'af_guardado':      return 'Análisis físico guardado'
    case 'as_guardado':      return 'Análisis sensorial guardado'
    case 'as_aprobado':      return 'Bache APROBADO'
    case 'as_rechazado':     return 'Bache RECHAZADO'
  }
}
