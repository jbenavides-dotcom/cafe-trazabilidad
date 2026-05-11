/**
 * fichas.ts — Capa de datos para Offerings, OrderConfirmations y Shippings.
 *
 * Estrategia:
 *   1. Intentar Supabase (schema public, tablas con prefijo ct_).
 *   2. Si falla (sin internet / SQL no ejecutado), leer localStorage como fallback.
 *   3. Todas las funciones async para permitir await tanto en Supabase como en LS.
 *
 * PROGRAM_TEMPLATES: antes hardcoded, ahora se cargan de ct_program_templates.
 * Si Supabase falla, se devuelve el listado hardcoded como fallback.
 */

import { supabase } from './supabase'
import type {
  Offering,
  OfferingRecipient,
  OfferingSample,
  OrderConfirmation,
  OrderConfirmationItem,
  ProgramTemplate,
  ShippingInfo,
  TripToOrigin,
  TripDay,
} from '../types/fichas'

// ─── LocalStorage keys (fallback) ────────────────────────────────────────────
const LS_KEY = 'cafe_traz_offerings'
const LS_KEY_ORDERS = 'cafe_traz_documents_orders'
const LS_KEY_SHIPPINGS = 'cafe_traz_documents_shippings'
const LS_KEY_TRIPS = 'cafetraz_trips_v1'

// ─── Fallback hardcoded templates (si Supabase no responde) ──────────────────
const PROGRAM_TEMPLATES_FALLBACK: ProgramTemplate[] = [
  {
    code: 'pulse',
    name: 'PULSE',
    tagline: 'Daring fermentations with precision and control',
    description_long:
      'Our most daring fermentations with precision and control. Coffees born from curiosity, experimentation and the wish to challenge the status quo. Here, we dive into the science of fermentation. Time, pH, temperature, stability; every variable becomes part of a living experiment that pushes flavor beyond expectations.',
    color_hex: '#FF7A8A',
  },
  {
    code: 'beat',
    name: 'BEAT',
    tagline: 'Coffees crafted for competition',
    description_long:
      'Coffees crafted for competition. A heartbeat is proof of life. A steady, unmistakable signal that energy and intention are flowing. Our BEAT Series captures that same vitality. Rare lots. Exceptional precision. Processes shaped by season, terroir, and intuition.',
    color_hex: '#FF1A6E',
  },
  {
    code: 'connect',
    name: 'CONNECT',
    tagline: 'Nature leads, we follow',
    description_long:
      'Fermentations guided by native microorganisms. Coffees that honor our connection to land, terroir, and time. These lots come from processes that have proven their harmony year after year. Stable, expressive, and deeply rooted in the biodiversity of our ecosystem.',
    color_hex: '#8A7BC4',
  },
  {
    code: 'amistad',
    name: 'LA AMISTAD',
    tagline: 'Coffees rooted in collaboration',
    description_long:
      'La Amistad is not just a coffee program; it is a decade-long conversation. It represents the coffees rooted in collaboration with the small-scale growers—our neighbors—who believed in this project long before it made sense on paper.',
    color_hex: '#8a9863',
  },
]

// Mantener compatibilidad: export estático para componentes que todavía lo importen
// directamente. TabPlantillas y el Wizard lo usan; se actualiza de forma lazy.
export let PROGRAM_TEMPLATES: ProgramTemplate[] = PROGRAM_TEMPLATES_FALLBACK

// ─── Cache de templates ───────────────────────────────────────────────────────
let _templatesCache: ProgramTemplate[] | null = null

export async function getProgramTemplates(): Promise<ProgramTemplate[]> {
  if (_templatesCache) return _templatesCache

  try {
    const { data, error } = await supabase
      .from('ct_program_templates')
      .select('code, name, tagline, description_long, color_hex')
      .eq('is_active', true)
      .order('code')

    if (error) throw error

    if (data && data.length > 0) {
      // El campo code de la BD puede ser string; cast a la unión tipada
      _templatesCache = data.map(r => ({
        ...r,
        code: r.code as ProgramTemplate['code'],
      }))
      // Actualizar el export estático para componentes síncronos
      PROGRAM_TEMPLATES = _templatesCache
      return _templatesCache
    }
  } catch {
    // Sin conexión o SQL no ejecutado → usar fallback
  }

  _templatesCache = PROGRAM_TEMPLATES_FALLBACK
  PROGRAM_TEMPLATES = PROGRAM_TEMPLATES_FALLBACK
  return _templatesCache
}

// ─── Estado de conectividad Supabase ─────────────────────────────────────────
/** true = Supabase respondió bien en esta sesión */
let _supabaseOnline: boolean | null = null

async function isSupabaseOnline(): Promise<boolean> {
  if (_supabaseOnline !== null) return _supabaseOnline
  try {
    const { error } = await supabase
      .from('ct_offerings')
      .select('id')
      .limit(1)
    _supabaseOnline = !error
  } catch {
    _supabaseOnline = false
  }
  return _supabaseOnline
}

// ─────────────────────────────────────────────────────────────────────────────
// OFFERINGS
// ─────────────────────────────────────────────────────────────────────────────

/** Lee y migra samples viejas que usen nanolote_code desde localStorage. */
function getOfferingsFromLS(): Offering[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<
      Omit<Offering, 'samples'> & {
        samples: Array<OfferingSample & { nanolote_code?: string }>
      }
    >
    return parsed.map(o => ({
      ...o,
      samples: o.samples.map(s => {
        if (!s.bache_code && s.nanolote_code) {
          const { nanolote_code, ...rest } = s
          return { ...rest, bache_code: nanolote_code } as OfferingSample
        }
        return s as OfferingSample
      }),
    }))
  } catch {
    return []
  }
}

function saveOfferingsToLS(offerings: Offering[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(offerings))
}

export async function getOfferings(): Promise<Offering[]> {
  const online = await isSupabaseOnline()
  if (!online) return getOfferingsFromLS()

  try {
    const { data, error } = await supabase
      .from('ct_offerings')
      .select(
        `id, title, cover_message, access_token, created_by,
         samples_count, language, status,
         sent_at, first_viewed_at, responded_at, expires_at, created_at,
         template:ct_program_templates(code, name, tagline, color_hex),
         samples:ct_offering_samples(*),
         recipients:ct_recipients(*)`
      )
      .order('created_at', { ascending: false })

    if (error) throw error

    // Mapear a la interfaz Offering esperada por los componentes
    return (data ?? []).map(row => mapDbRowToOffering(row))
  } catch (e) {
    console.error('getOfferings error:', e)
    return getOfferingsFromLS()
  }
}

export async function getOfferingByToken(token: string): Promise<Offering | null> {
  const online = await isSupabaseOnline()
  if (!online) {
    const all = getOfferingsFromLS()
    return all.find(o => o.access_token === token) ?? null
  }

  try {
    const { data, error } = await supabase
      .from('ct_offerings')
      .select(
        `id, title, cover_message, access_token, created_by,
         samples_count, language, status,
         sent_at, first_viewed_at, responded_at, expires_at, created_at,
         template:ct_program_templates(code, name, tagline, color_hex),
         samples:ct_offering_samples(*),
         recipients:ct_recipients(*)`
      )
      .eq('access_token', token)
      .single()

    if (error) return null
    return mapDbRowToOffering(data)
  } catch (e) {
    console.error('getOfferingByToken error:', e)
    const all = getOfferingsFromLS()
    return all.find(o => o.access_token === token) ?? null
  }
}

export async function saveOffering(offering: Offering): Promise<void> {
  // Siempre persistir en LS también (doble escritura como caché offline)
  const allLS = getOfferingsFromLS()
  const idxLS = allLS.findIndex(o => o.id === offering.id)
  if (idxLS >= 0) allLS[idxLS] = offering
  else allLS.push(offering)
  saveOfferingsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    // Upsert offering principal
    const { error: upsertErr } = await supabase
      .from('ct_offerings')
      .upsert({
        id: offering.id,
        template_id: await getTemplateIdByCode(offering.template_code),
        title: offering.title,
        cover_message: offering.cover_message,
        access_token: offering.access_token,
        status: offering.status,
        samples_count: offering.samples.length,
        sent_at: offering.sent_at ?? null,
        created_at: offering.created_at,
      })

    if (upsertErr) throw upsertErr

    // Reemplazar samples
    await supabase
      .from('ct_offering_samples')
      .delete()
      .eq('offering_id', offering.id)

    if (offering.samples.length > 0) {
      const samplesRows = offering.samples.map(s => ({
        offering_id: offering.id,
        sample_order: s.sample_order,
        bache_code: s.bache_code,
        variety: s.variety,
        process: s.process,
        tasting_notes: s.tasting_notes,
        availability_kg: s.availability_kg,
        price_usd_per_lb: s.price_usd_per_lb,
        tasting_score: s.tasting_score ?? null,
        macroprofile: s.macroprofile ?? null,
        profile: s.profile ?? null,
      }))
      await supabase.from('ct_offering_samples').insert(samplesRows)
    }

    // Reemplazar recipients
    await supabase
      .from('ct_recipients')
      .delete()
      .eq('offering_id', offering.id)

    if (offering.recipients.length > 0) {
      const recipientRows = offering.recipients.map(r => ({
        offering_id: offering.id,
        email: r.email,
        name: r.name,
        company: r.company ?? null,
        country: r.country ?? null,
        funnel_stage: r.funnel_stage,
        view_count: r.view_count,
        opened_email_at: r.opened_email_at ?? null,
        last_viewed_at: r.last_viewed_at ?? null,
        replied_at: r.replied_at ?? null,
      }))
      await supabase.from('ct_recipients').insert(recipientRows)
    }
  } catch (e) {
    console.error('saveOffering error:', e)
    // No re-throw — ya guardó en LS
  }
}

export async function deleteOffering(id: string): Promise<void> {
  const allLS = getOfferingsFromLS().filter(o => o.id !== id)
  saveOfferingsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await supabase.from('ct_offerings').delete().eq('id', id)
  } catch (e) {
    console.error('deleteOffering error:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PÚBLICA — selección del cliente por access_token
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientSelectionInput {
  sample_order: number
  selected: boolean
  requested_kg?: number
  priority?: 1 | 2 | 3
  client_notes?: string
}

/**
 * Envía la selección del cliente a Supabase.
 * - Resuelve/crea el recipient por email.
 * - Reemplaza todas las selecciones previas de ese recipient para ese offering.
 * - Marca recipient.funnel_stage='responded' + replied_at.
 *
 * Devuelve el id del recipient para que la UI pueda confirmar.
 */
export async function submitClientSelection(
  accessToken: string,
  clientEmail: string,
  clientName: string,
  selections: ClientSelectionInput[]
): Promise<{ recipient_id: string; offering_id: string }> {
  const email = clientEmail.trim().toLowerCase()
  if (!email) throw new Error('Email requerido')

  // 1. Resolver offering por token (con samples para mapear sample_order -> id)
  const { data: offering, error: offErr } = await supabase
    .from('ct_offerings')
    .select('id, samples:ct_offering_samples(id, sample_order)')
    .eq('access_token', accessToken)
    .single()
  if (offErr || !offering) throw new Error('Offering no encontrado')

  const offeringId = offering.id as string
  const samples = (offering.samples ?? []) as { id: string; sample_order: number }[]
  const sampleByOrder = new Map(samples.map(s => [s.sample_order, s.id]))

  // 2. Resolver recipient (existente o nuevo) por email + offering
  let recipientId: string
  const { data: existingRec } = await supabase
    .from('ct_recipients')
    .select('id')
    .eq('offering_id', offeringId)
    .eq('email', email)
    .maybeSingle()

  if (existingRec?.id) {
    recipientId = existingRec.id as string
    await supabase
      .from('ct_recipients')
      .update({
        funnel_stage: 'responded',
        replied_at: new Date().toISOString(),
        last_viewed_at: new Date().toISOString(),
        name: clientName || undefined,
      })
      .eq('id', recipientId)
  } else {
    const { data: newRec, error: insErr } = await supabase
      .from('ct_recipients')
      .insert({
        offering_id: offeringId,
        email,
        name: clientName || email,
        funnel_stage: 'responded',
        view_count: 1,
        replied_at: new Date().toISOString(),
        last_viewed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (insErr || !newRec) throw insErr ?? new Error('No se pudo crear recipient')
    recipientId = newRec.id as string
  }

  // 3. Borrar selecciones previas de este recipient para este offering
  await supabase
    .from('ct_offering_selections')
    .delete()
    .eq('offering_id', offeringId)
    .eq('recipient_id', recipientId)

  // 4. Insertar selecciones nuevas (solo las que selected=true)
  const rows = selections
    .filter(s => s.selected && sampleByOrder.has(s.sample_order))
    .map(s => ({
      offering_id: offeringId,
      sample_id: sampleByOrder.get(s.sample_order)!,
      recipient_id: recipientId,
      selected: true,
      requested_kg: s.requested_kg ?? null,
      priority: s.priority ?? 2,
      client_notes: s.client_notes ?? null,
    }))

  if (rows.length > 0) {
    const { error: selErr } = await supabase.from('ct_offering_selections').insert(rows)
    if (selErr) throw selErr
  }

  // 5. Promover status del offering a 'responded' si aún está en 'sent'/'viewed'
  await supabase
    .from('ct_offerings')
    .update({ status: 'responded' })
    .eq('id', offeringId)
    .in('status', ['draft', 'sent', 'viewed'])

  return { recipient_id: recipientId, offering_id: offeringId }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIRMA DIGITAL — /sign/:token
// ─────────────────────────────────────────────────────────────────────────────

export type SignatureDocumentType = 'order_confirmation' | 'shipping' | 'trip_to_origin'

export interface PendingSignatureRecord {
  id: string
  signature_token: string
  document_type: SignatureDocumentType
  document_id: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  signer_name?: string
  signer_email?: string
  signer_role?: string
  expires_at?: string
  /** Snippet del documento para mostrar al firmante (cargado por lookup separado) */
  document_label?: string
}

/**
 * Lee la firma pendiente por su token público.
 * También resuelve un label legible del documento (ej. "OC-2026-001 — Leaves Coffee").
 */
export async function getSignatureByToken(token: string): Promise<PendingSignatureRecord | null> {
  try {
    const { data, error } = await supabase
      .from('ct_digital_signatures')
      .select('*')
      .eq('signature_token', token)
      .single()
    if (error || !data) return null

    // Resolver label del documento
    let docLabel: string | undefined
    if (data.document_type === 'order_confirmation') {
      const { data: oc } = await supabase
        .from('ct_order_confirmations')
        .select('confirmation_number, buyer:ct_buyers(company_name)')
        .eq('id', data.document_id)
        .single()
      const buyerName = (oc?.buyer as unknown as { company_name?: string } | null)?.company_name
      docLabel = oc ? `${oc.confirmation_number}${buyerName ? ` — ${buyerName}` : ''}` : undefined
    } else if (data.document_type === 'shipping') {
      const { data: sh } = await supabase
        .from('ct_shipping_documents')
        .select('contract_number, mode')
        .eq('id', data.document_id)
        .single()
      docLabel = sh ? `Shipping ${sh.mode === 'air' ? 'Aéreo' : 'Marítimo'} — ${sh.contract_number}` : undefined
    } else if (data.document_type === 'trip_to_origin') {
      const { data: tr } = await supabase
        .from('ct_trip_to_origin')
        .select('client_name, trip_date')
        .eq('id', data.document_id)
        .single()
      docLabel = tr ? `Trip to Origin — ${tr.client_name} (${tr.trip_date})` : undefined
    }

    return {
      id: data.id,
      signature_token: data.signature_token,
      document_type: data.document_type,
      document_id: data.document_id,
      status: data.status,
      signer_name: data.signer_name ?? undefined,
      signer_email: data.signer_email ?? undefined,
      signer_role: data.signer_role ?? undefined,
      expires_at: data.expires_at ?? undefined,
      document_label: docLabel,
    }
  } catch (e) {
    console.error('getSignatureByToken error:', e)
    return null
  }
}

export interface SignatureSubmitInput {
  signer_name: string
  signer_email: string
  signer_role?: string
  signature_image_data_url: string  // dataURL base64 PNG del canvas
  /** Hash del payload firmado (texto canónico signer+token+timestamp) */
  document_hash_sha256: string
}

/**
 * Marca la firma como completada. Captura IP (best-effort) + user agent.
 * Actualiza también el documento origen (signed_at + signature_id).
 */
export async function submitSignature(
  token: string,
  input: SignatureSubmitInput
): Promise<{ signature_id: string }> {
  // 1. Buscar el registro
  const { data: sig, error: lookupErr } = await supabase
    .from('ct_digital_signatures')
    .select('id, document_type, document_id, status, expires_at')
    .eq('signature_token', token)
    .single()
  if (lookupErr || !sig) throw new Error('Token de firma inválido o expirado')
  if (sig.status === 'signed') throw new Error('Este documento ya fue firmado')
  if (sig.expires_at && new Date(sig.expires_at) < new Date()) {
    throw new Error('Este enlace expiró. Solicita uno nuevo a La Palma y El Tucán.')
  }

  // 2. IP best-effort (ipify gratis, sin auth)
  let signed_ip: string | null = null
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) })
    const j = await r.json()
    signed_ip = j.ip ?? null
  } catch { /* sin IP — no es crítico */ }

  // 3. UPDATE firma
  const now = new Date().toISOString()
  const { error: updErr } = await supabase
    .from('ct_digital_signatures')
    .update({
      status: 'signed',
      signer_name: input.signer_name,
      signer_email: input.signer_email.trim().toLowerCase(),
      signer_role: input.signer_role ?? null,
      signature_image_url: input.signature_image_data_url,
      document_hash_sha256: input.document_hash_sha256,
      signed_at: now,
      signed_ip,
      signed_user_agent: navigator.userAgent.slice(0, 512),
    })
    .eq('id', sig.id)
  if (updErr) throw updErr

  // 4. UPDATE documento origen (marcar como firmado).
  //    Las tres tablas tienen `status` + `updated_at` (NO `signed_at`).
  //    El timestamp queda registrado en ct_digital_signatures.signed_at.
  if (sig.document_type === 'order_confirmation') {
    const { error: ocErr } = await supabase
      .from('ct_order_confirmations')
      .update({ status: 'signed' })
      .eq('id', sig.document_id)
    if (ocErr) console.warn('UPDATE ct_order_confirmations falló:', ocErr.message)
  } else if (sig.document_type === 'shipping') {
    const { error: shErr } = await supabase
      .from('ct_shipping_documents')
      .update({ status: 'signed' })
      .eq('id', sig.document_id)
    if (shErr) console.warn('UPDATE ct_shipping_documents falló:', shErr.message)
  } else if (sig.document_type === 'trip_to_origin') {
    const { error: trErr } = await supabase
      .from('ct_trip_to_origin')
      .update({ status: 'signed', contract_signed: true })
      .eq('id', sig.document_id)
    if (trErr) console.warn('UPDATE ct_trip_to_origin falló:', trErr.message)
  }

  return { signature_id: sig.id }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVÍO DE EMAIL — webhook n8n
// ─────────────────────────────────────────────────────────────────────────────

const N8N_EMAIL_WEBHOOK = 'https://jhona.app.n8n.cloud/webhook/send-sig-email'

export interface SignatureEmailInput {
  to: string
  signer_name?: string
  document_label: string       // ej. "OC-2026-1031"
  document_summary: string     // ej. "Geisha LP&ET · 38.5 kg · $4,116.58 USD · DAP Colombia"
  sign_url: string
}

/**
 * Envía email transaccional al cliente con el link de firma.
 * Llama al webhook n8n (workflow "Send Signature Email — Café Trazabilidad").
 */
export async function sendSignatureEmail(input: SignatureEmailInput): Promise<void> {
  const html = renderSignatureEmailHtml(input)
  const subject = `Documento para firmar · ${input.document_label} · La Palma y El Tucán`

  const r = await fetch(N8N_EMAIL_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: input.to, subject, html }),
  })
  if (!r.ok) {
    const errBody = await r.text().catch(() => '')
    throw new Error(`Webhook respondió ${r.status}: ${errBody.slice(0, 200)}`)
  }
}

function renderSignatureEmailHtml(i: SignatureEmailInput): string {
  const safeName = i.signer_name?.trim() || 'estimado cliente'
  return `
<div style="max-width:600px;margin:0 auto;font-family:Inter,Arial,sans-serif;background:#FAF6EE;border-radius:14px;overflow:hidden">
  <div style="background:#B30055;padding:36px 24px;text-align:center;color:white">
    <div style="font-size:11px;letter-spacing:3px;opacity:0.7;margin-bottom:10px">LA PALMA &amp; EL TUC&Aacute;N</div>
    <h1 style="margin:0;font-size:36px;font-family:Georgia,serif">From <em>The</em> heart</h1>
    <p style="margin:16px 0 0;font-size:15px;opacity:0.92">Tienes un documento listo para firmar</p>
  </div>
  <div style="padding:32px 28px;background:white">
    <p style="font-size:16px;line-height:1.6;color:#2a2a2a">Hola <strong>${escapeHtml(safeName)}</strong>,</p>
    <p style="font-size:15px;line-height:1.6;color:#444">
      Hemos preparado tu <strong>Order Confirmation</strong>. Por favor revisa los detalles y firma digitalmente cuando est&eacute;s conforme.
    </p>
    <div style="background:#FFF5F8;border-left:4px solid #B30055;padding:16px 18px;margin:22px 0;border-radius:6px">
      <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Documento</div>
      <div style="font-size:18px;font-weight:700;color:#B30055;margin-bottom:8px">${escapeHtml(i.document_label)}</div>
      <div style="font-size:13px;color:#666">${escapeHtml(i.document_summary)}</div>
    </div>
    <div style="text-align:center;margin:30px 0">
      <a href="${i.sign_url}" style="display:inline-block;background:#B30055;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
        Revisar y firmar documento
      </a>
    </div>
    <p style="font-size:12px;color:#888;line-height:1.5;margin-top:24px;border-top:1px solid #EAE5DC;padding-top:14px">
      Este enlace es &uacute;nico, expira en 30 d&iacute;as y queda registrado conforme a la Ley 527/1999 (Colombia) sobre firma electr&oacute;nica.
      Si no esperabas este correo, puedes ignorarlo.
    </p>
  </div>
  <div style="padding:18px;text-align:center;background:#FAF6EE;font-size:12px;color:#B30055">
    @lapalmayeltucan &middot; lapalmayeltucan.com
  </div>
</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Lee la firma más reciente (si existe) asociada a un documento.
 * Para mostrar el estado en la UI del documento (Order Confirmation, Shipping, Trip).
 */
export async function getSignatureForDocument(
  documentType: SignatureDocumentType,
  documentId: string
): Promise<{
  id: string
  signature_token: string
  status: 'pending' | 'signed' | 'declined' | 'expired'
  signer_name?: string
  signer_email?: string
  signer_role?: string
  signature_image_url?: string
  signed_at?: string
  signed_ip?: string
  expires_at?: string
  sent_at?: string
} | null> {
  try {
    const { data, error } = await supabase
      .from('ct_digital_signatures')
      .select('id, signature_token, status, signer_name, signer_email, signer_role, signature_image_url, signed_at, signed_ip, expires_at, sent_at')
      .eq('document_type', documentType)
      .eq('document_id', documentId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data) return null
    return {
      id: data.id,
      signature_token: data.signature_token,
      status: data.status,
      signer_name: data.signer_name ?? undefined,
      signer_email: data.signer_email ?? undefined,
      signer_role: data.signer_role ?? undefined,
      signature_image_url: data.signature_image_url ?? undefined,
      signed_at: data.signed_at ?? undefined,
      signed_ip: data.signed_ip ?? undefined,
      expires_at: data.expires_at ?? undefined,
      sent_at: data.sent_at ?? undefined,
    }
  } catch (e) {
    console.error('getSignatureForDocument error:', e)
    return null
  }
}

/**
 * Crea un registro `ct_digital_signatures` pendiente y devuelve la URL pública
 * que el equipo puede compartir con el cliente.
 *
 * - URL construida con BASE_URL para que funcione en local + producción
 *   (`https://jbenavides-dotcom.github.io/cafe-trazabilidad/#/sign/{token}`)
 * - Pre-rellena signer_name/email si se proveen (útil para Order Confirmation
 *   donde ya conocemos al buyer).
 */
export async function createSignatureLink(
  documentType: SignatureDocumentType,
  documentId: string,
  hint?: { signer_name?: string; signer_email?: string; signer_role?: string }
): Promise<{ token: string; signed_url: string; signature_id: string }> {
  const { data, error } = await supabase
    .from('ct_digital_signatures')
    .insert({
      document_type: documentType,
      document_id: documentId,
      status: 'pending',
      signer_name: hint?.signer_name ?? null,
      signer_email: hint?.signer_email ?? null,
      signer_role: hint?.signer_role ?? null,
    })
    .select('id, signature_token')
    .single()
  if (error || !data) throw error ?? new Error('No se pudo crear el link de firma')

  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '/')
  const signed_url = `${base}#/sign/${data.signature_token}`

  return { token: data.signature_token, signed_url, signature_id: data.id }
}

/**
 * Calcula SHA-256 (hex) de un string usando Web Crypto API nativa.
 * Útil para hashear el payload firmado (signer_name + token + timestamp).
 */
export async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Marca un offering como visto (view_count++) cuando el cliente abre el link.
 * Idempotente — se puede llamar en cada render sin problema.
 */
export async function trackOfferingView(accessToken: string): Promise<void> {
  try {
    const { data: off } = await supabase
      .from('ct_offerings')
      .select('id, status')
      .eq('access_token', accessToken)
      .single()
    if (!off) return

    // Promover draft/sent → viewed (no tocar responded/expired)
    if (off.status === 'draft' || off.status === 'sent') {
      await supabase.from('ct_offerings').update({ status: 'viewed' }).eq('id', off.id)
    }
  } catch (e) {
    console.error('trackOfferingView error:', e)
  }
}

export function getAllRecipients(
  offerings: Offering[]
): { offering: Offering; recipient: OfferingRecipient }[] {
  const result: { offering: Offering; recipient: OfferingRecipient }[] = []
  for (const offering of offerings) {
    for (const recipient of offering.recipients) {
      result.push({ offering, recipient })
    }
  }
  return result
}

// ─── Migración localStorage → Supabase ───────────────────────────────────────

/**
 * Si hay datos en LS y Supabase está vacío, ofrece subir los datos locales.
 * Devuelve el número de offerings subidos (0 si no hizo nada).
 */
export async function migrateLocalStorageToSupabase(): Promise<number> {
  const lsData = getOfferingsFromLS()
  if (lsData.length === 0) return 0

  const online = await isSupabaseOnline()
  if (!online) return 0

  try {
    const { data: existing } = await supabase
      .from('ct_offerings')
      .select('id')
      .limit(1)

    if (existing && existing.length > 0) return 0 // ya hay datos en Supabase

    let count = 0
    for (const o of lsData) {
      await saveOffering(o)
      count++
    }
    return count
  } catch {
    return 0
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDER CONFIRMATIONS
// ─────────────────────────────────────────────────────────────────────────────

function getOrderConfirmationsFromLS(): OrderConfirmation[] {
  try {
    const raw = localStorage.getItem(LS_KEY_ORDERS)
    if (!raw) return [LEAVES_COFFEE_EXAMPLE]
    const parsed = JSON.parse(raw) as Partial<OrderConfirmation>[]

    // Migrar: filtrar entradas sin id y rellenar buyer/seller/items con defaults
    // si vienen undefined (schema viejo con JSONB anidado que ya no existe en Supabase).
    const migrated: OrderConfirmation[] = parsed
      .filter(d => Boolean(d.id))
      .map(d => ({
        id: d.id ?? '',
        buyer_id: d.buyer_id,
        number: d.number ?? '',
        date: d.date ?? '',
        buyer: d.buyer ?? {
          company_name: '',
          contact_name: '',
          address: '',
          city: '',
          country: '',
          postal_code: undefined,
          phone: '',
          email: '',
        },
        seller: d.seller ?? {
          name: 'LA PALMA Y EL TUCÁN',
          address: 'Vereda Berlín, San Francisco, Cundinamarca, Colombia',
          phone: '+57 320 000 0000',
          email: 'comercial@lapalmayeltucan.com',
        },
        items: d.items ?? [],
        origin_country: d.origin_country ?? 'COLOMBIA',
        preparation_varietal: d.preparation_varietal ?? '',
        moisture_level: d.moisture_level ?? '',
        shipping_date: d.shipping_date ?? '',
        arrival_date: d.arrival_date ?? '',
        incoterm: d.incoterm ?? 'DAP',
        payment_terms: d.payment_terms ?? '',
        destination_country: d.destination_country ?? '',
        total_usd: d.total_usd ?? 0,
        status: d.status ?? 'draft',
        created_at: d.created_at ?? new Date().toISOString(),
      }))

    return migrated.length > 0 ? migrated : [LEAVES_COFFEE_EXAMPLE]
  } catch (e) {
    console.error('getOrderConfirmationsFromLS error:', e)
    return [LEAVES_COFFEE_EXAMPLE]
  }
}

function saveOrderConfirmationsToLS(all: OrderConfirmation[]): void {
  localStorage.setItem(LS_KEY_ORDERS, JSON.stringify(all))
}

export async function getOrderConfirmations(): Promise<OrderConfirmation[]> {
  const online = await isSupabaseOnline()
  if (!online) return getOrderConfirmationsFromLS()

  try {
    const { data, error } = await supabase
      .from('ct_order_confirmations')
      .select(`
        *,
        buyer:ct_buyers(*),
        items:ct_order_confirmation_items(*)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = data ?? []
    if (rows.length === 0) return [LEAVES_COFFEE_EXAMPLE]
    return rows.map(mapDbRowToOrderConfirmation)
  } catch (e) {
    console.error('getOrderConfirmations error:', e)
    return getOrderConfirmationsFromLS()
  }
}

export async function saveOrderConfirmation(doc: OrderConfirmation): Promise<void> {
  // LS siempre
  const allLS = getOrderConfirmationsFromLS()
  const idxLS = allLS.findIndex(d => d.id === doc.id)
  if (idxLS >= 0) allLS[idxLS] = doc
  else allLS.push(doc)
  saveOrderConfirmationsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await saveOrderConfirmationFull(doc)
  } catch (e) {
    console.error('saveOrderConfirmation error:', e)
    // No re-throw — el LS ya quedó guardado, eso es suficiente para borrador
  }
}

export async function deleteOrderConfirmation(id: string): Promise<void> {
  const allLS = getOrderConfirmationsFromLS().filter(d => d.id !== id)
  saveOrderConfirmationsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await supabase.from('ct_order_confirmations').delete().eq('id', id)
  } catch (e) {
    console.error('deleteOrderConfirmation error:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING INFOS
// ─────────────────────────────────────────────────────────────────────────────

function getShippingsFromLS(): ShippingInfo[] {
  try {
    const raw = localStorage.getItem(LS_KEY_SHIPPINGS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<ShippingInfo>[]

    // Migrar: rellenar consignee/notify/documents_checklist con defaults si vienen undefined
    return parsed
      .filter(d => Boolean(d.id))
      .map(d => ({
        id: d.id ?? '',
        confirmation_id: d.confirmation_id,
        mode: d.mode ?? 'sea',
        date: d.date ?? '',
        contract_number: d.contract_number ?? '',
        buyer_ref: d.buyer_ref ?? '',
        seller_ref: d.seller_ref ?? '',
        shipment_line: d.shipment_line,
        loading_port: d.loading_port,
        destination_port: d.destination_port,
        documents_required_text: d.documents_required_text,
        notify: d.notify,
        contact_person: d.contact_person,
        documents_checklist: d.documents_checklist,
        consignee: d.consignee ?? { name: '', address: '', phone: '', email: '', country: '' },
        special_requirements: d.special_requirements ?? '',
        created_at: d.created_at ?? new Date().toISOString(),
      }))
  } catch (e) {
    console.error('getShippingsFromLS error:', e)
    return []
  }
}

function saveShippingsToLS(all: ShippingInfo[]): void {
  localStorage.setItem(LS_KEY_SHIPPINGS, JSON.stringify(all))
}

export async function getShippings(): Promise<ShippingInfo[]> {
  const online = await isSupabaseOnline()
  if (!online) return getShippingsFromLS()

  try {
    const { data, error } = await supabase
      .from('ct_shipping_documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map(mapDbRowToShipping)
  } catch (e) {
    console.error('getShippings error:', e)
    return getShippingsFromLS()
  }
}

export async function saveShipping(doc: ShippingInfo): Promise<void> {
  const allLS = getShippingsFromLS()
  const idxLS = allLS.findIndex(d => d.id === doc.id)
  if (idxLS >= 0) allLS[idxLS] = doc
  else allLS.push(doc)
  saveShippingsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await supabase.from('ct_shipping_documents').upsert(mapShippingToDb(doc))
  } catch (e) {
    console.error('saveShipping error:', e)
  }
}

export async function deleteShipping(id: string): Promise<void> {
  const allLS = getShippingsFromLS().filter(d => d.id !== id)
  saveShippingsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await supabase.from('ct_shipping_documents').delete().eq('id', id)
  } catch (e) {
    console.error('deleteShipping error:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Mappers DB ↔ TS
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToOffering(row: Record<string, any>): Offering {
  const template = row.template as Record<string, string> | null
  const templateCode = (template?.code ?? 'pulse') as Offering['template_code']

  const samples: OfferingSample[] = (row.samples ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: Record<string, any>) => ({
      sample_order: s.sample_order as number,
      bache_code: s.bache_code as string,
      variety: s.variety as string,
      process: s.process as string,
      tasting_notes: s.tasting_notes as string,
      availability_kg: s.availability_kg as number,
      price_usd_per_lb: s.price_usd_per_lb as number,
      tasting_score: s.tasting_score as string | undefined,
      macroprofile: s.macroprofile as string | undefined,
      profile: s.profile as string | undefined,
    })
  )

  const recipients: OfferingRecipient[] = (row.recipients ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (r: Record<string, any>) => ({
      email: r.email as string,
      name: r.name as string,
      company: r.company as string | undefined,
      country: r.country as string | undefined,
      funnel_stage: r.funnel_stage as OfferingRecipient['funnel_stage'],
      view_count: r.view_count as number,
      opened_email_at: r.opened_email_at as string | undefined,
      last_viewed_at: r.last_viewed_at as string | undefined,
      replied_at: r.replied_at as string | undefined,
    })
  )

  return {
    id: row.id as string,
    template_code: templateCode,
    title: row.title as string,
    cover_message: row.cover_message as string,
    access_token: row.access_token as string,
    samples,
    recipients,
    status: row.status as Offering['status'],
    created_at: row.created_at as string,
    sent_at: row.sent_at as string | undefined,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToOrderConfirmation(row: Record<string, any>): OrderConfirmation {
  // row.buyer viene del JOIN con ct_buyers (objeto o null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b = row.buyer as Record<string, any> | null | undefined

  // row.items viene del JOIN con ct_order_confirmation_items (array)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: Array<Record<string, any>> = Array.isArray(row.items) ? row.items : []
  const items: OrderConfirmation['items'] = rawItems
    .sort((a, b) => (Number(a.line_order) || 0) - (Number(b.line_order) || 0))
    .map(it => ({
      bache_code: it.bache_code as string | undefined,
      description: it.description as string,
      program: it.program as OrderConfirmationItem['program'],
      quantity_kg: Number(it.quantity_kg),
      unit_price_per_lb_usd: Number(it.unit_price_per_lb_usd),
      total_usd: Number(it.total_usd),
    }))

  return {
    id: row.id as string,
    buyer_id: row.buyer_id as string | undefined,
    // La BD guarda 'confirmation_number', el tipo TS usa 'number'
    number: (row.confirmation_number ?? '') as string,
    date: row.date as string,
    buyer: {
      company_name: b?.company_name ?? '',
      contact_name: b?.contact_name ?? '',
      address: b?.address ?? '',
      city: b?.city ?? '',
      country: b?.country ?? '',
      postal_code: b?.postal_code as string | undefined,
      phone: b?.phone ?? '',
      email: b?.email ?? '',
    },
    seller: {
      name: (row.seller_name ?? '') as string,
      address: (row.seller_address ?? '') as string,
      phone: (row.seller_phone ?? '') as string,
      email: (row.seller_email ?? '') as string,
    },
    items,
    origin_country: (row.origin_country ?? 'COLOMBIA') as string,
    preparation_varietal: (row.preparation_varietal ?? '') as string,
    moisture_level: (row.moisture_level ?? '') as string,
    shipping_date: (row.shipping_date ?? '') as string,
    arrival_date: (row.arrival_date ?? '') as string,
    incoterm: (row.incoterm ?? 'DAP') as OrderConfirmation['incoterm'],
    payment_terms: (row.payment_terms ?? '') as string,
    destination_country: (row.destination_country ?? '') as string,
    total_usd: Number(row.total_usd ?? 0),
    status: (row.status ?? 'draft') as OrderConfirmation['status'],
    created_at: (row.created_at ?? new Date().toISOString()) as string,
  }
}

// mapOrderConfirmationToDb eliminado — la tabla ct_order_confirmations NO tiene
// columnas buyer/seller/items JSONB. Usar saveOrderConfirmationFull() en su lugar.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbRowToShipping(row: Record<string, any>): ShippingInfo {
  // ct_shipping_documents normaliza notify y consignee en columnas separadas
  // (notify_name, notify_address, etc. — NO jsonb notify/consignee)
  const notify: ShippingInfo['notify'] =
    row.notify_name != null
      ? {
          name: row.notify_name as string,
          address: (row.notify_address ?? '') as string,
          phone: (row.notify_phone ?? '') as string,
          email: (row.notify_email ?? '') as string,
        }
      : undefined

  const consignee: ShippingInfo['consignee'] = {
    name: (row.consignee_name ?? '') as string,
    address: (row.consignee_address ?? '') as string,
    phone: (row.consignee_phone ?? '') as string,
    email: (row.consignee_email ?? '') as string,
    country: (row.consignee_country ?? '') as string,
  }

  return {
    id: row.id as string,
    confirmation_id: row.confirmation_id as string | undefined,
    mode: row.mode as ShippingInfo['mode'],
    date: row.date as string,
    contract_number: (row.contract_number ?? '') as string,
    buyer_ref: (row.buyer_ref ?? '') as string,
    seller_ref: (row.seller_ref ?? '') as string,
    shipment_line: row.shipment_line as string | undefined,
    loading_port: row.loading_port as string | undefined,
    destination_port: row.destination_port as string | undefined,
    documents_required_text: row.documents_required_text as string | undefined,
    notify,
    contact_person: row.contact_person as string | undefined,
    // documents_checklist sí es JSONB en la BD — llega como objeto
    documents_checklist: row.documents_checklist as ShippingInfo['documents_checklist'],
    consignee,
    special_requirements: (row.special_requirements ?? '') as string,
    created_at: row.created_at as string,
  }
}

function mapShippingToDb(doc: ShippingInfo): Record<string, unknown> {
  // Escribe a columnas normalizadas (notify_* y consignee_*), NO a objetos JSONB
  return {
    id: doc.id,
    confirmation_id: doc.confirmation_id ?? null,
    mode: doc.mode,
    date: doc.date,
    contract_number: doc.contract_number,
    buyer_ref: doc.buyer_ref,
    seller_ref: doc.seller_ref,
    shipment_line: doc.shipment_line ?? null,
    loading_port: doc.loading_port ?? null,
    destination_port: doc.destination_port ?? null,
    documents_required_text: doc.documents_required_text ?? null,
    notify_name: doc.notify?.name ?? null,
    notify_address: doc.notify?.address ?? null,
    notify_phone: doc.notify?.phone ?? null,
    notify_email: doc.notify?.email ?? null,
    contact_person: doc.contact_person ?? null,
    documents_checklist: doc.documents_checklist ?? null,
    consignee_name: doc.consignee.name,
    consignee_address: doc.consignee.address,
    consignee_phone: doc.consignee.phone,
    consignee_email: doc.consignee.email,
    consignee_country: doc.consignee.country ?? null,
    special_requirements: doc.special_requirements,
    created_at: doc.created_at,
  }
}

// ─── Helper para obtener template_id desde code ───────────────────────────────
const _templateIdCache = new Map<string, string>()

async function getTemplateIdByCode(code: string): Promise<string | null> {
  if (_templateIdCache.has(code)) return _templateIdCache.get(code)!

  try {
    const { data } = await supabase
      .from('ct_program_templates')
      .select('id')
      .eq('code', code)
      .single()

    if (data?.id) {
      _templateIdCache.set(code, data.id as string)
      return data.id as string
    }
  } catch {
    // silenciar
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVE ORDER CONFIRMATION FULL (buyer + OC + items en cascade)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Genera el próximo número de confirmación en formato OC-YYYY-NNN.
 * Cuenta los registros existentes en la BD con ese prefijo de año.
 */
async function generateConfirmationNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('ct_order_confirmations')
    .select('id', { count: 'exact', head: true })
    .like('confirmation_number', `OC-${year}-%`)
  const next = (count ?? 0) + 1
  return `OC-${year}-${String(next).padStart(3, '0')}`
}

/**
 * Persiste un OrderConfirmation completo en 3 tablas de public (prefijo ct_):
 *   1. ct_buyers       — upsert por email (UNIQUE)
 *   2. ct_order_confirmations — upsert por id
 *   3. ct_order_confirmation_items — replace (DELETE + INSERT)
 *
 * Lanza error si cualquier paso falla. El caller NO debe descargar el PDF
 * hasta que esta función resuelva sin error.
 *
 * Nota: el schema de order_confirmations usa columna "confirmation_number",
 * no "number", para guardar el OC-YYYY-NNN. El campo "number" del tipo TS
 * se mapea a esa columna. El campo "buyer" (JSONB) se mantiene también para
 * compatibilidad con el mapper existente que lo reconstruye desde la columna.
 */
export async function saveOrderConfirmationFull(
  doc: OrderConfirmation
): Promise<OrderConfirmation> {
  // ── 1. Upsert buyer ──────────────────────────────────────────────────────
  const { data: existingBuyer } = await supabase
    .from('ct_buyers')
    .select('id')
    .eq('email', doc.buyer.email)
    .maybeSingle()

  let buyer_id: string
  if (existingBuyer) {
    const { error } = await supabase
      .from('ct_buyers')
      .update({
        company_name: doc.buyer.company_name,
        contact_name: doc.buyer.contact_name,
        address: doc.buyer.address,
        city: doc.buyer.city,
        country: doc.buyer.country,
        postal_code: doc.buyer.postal_code ?? null,
        phone: doc.buyer.phone,
      })
      .eq('id', existingBuyer.id)
    if (error) throw new Error(`ct_buyers UPDATE: ${error.message}`)
    buyer_id = existingBuyer.id as string
  } else {
    const { data, error } = await supabase
      .from('ct_buyers')
      .insert({
        company_name: doc.buyer.company_name,
        contact_name: doc.buyer.contact_name,
        address: doc.buyer.address,
        city: doc.buyer.city,
        country: doc.buyer.country,
        postal_code: doc.buyer.postal_code ?? null,
        phone: doc.buyer.phone,
        email: doc.buyer.email,
      })
      .select('id')
      .single()
    if (error) throw new Error(`ct_buyers INSERT: ${error.message}`)
    buyer_id = (data as { id: string }).id
  }

  // ── 2. Upsert order_confirmation ─────────────────────────────────────────
  const isExample = !doc.id || doc.id === 'example-leaves-coffee-2026'
  const confirmationNumber =
    doc.number && doc.number.trim() !== ''
      ? doc.number
      : await generateConfirmationNumber()

  // Solo columnas que existen en ct_order_confirmations (sin JSONB buyer/seller/items)
  const ocPayload = {
    confirmation_number: confirmationNumber,
    date: doc.date,
    buyer_id,
    seller_name: doc.seller.name,
    seller_address: doc.seller.address,
    seller_phone: doc.seller.phone,
    seller_email: doc.seller.email,
    origin_country: doc.origin_country,
    preparation_varietal: doc.preparation_varietal,
    moisture_level: doc.moisture_level,
    shipping_date: doc.shipping_date,
    arrival_date: doc.arrival_date,
    incoterm: doc.incoterm,
    payment_terms: doc.payment_terms,
    destination_country: doc.destination_country,
    total_usd: doc.total_usd,
    status: doc.status ?? 'draft',
  }

  let oc_id: string
  if (!isExample) {
    // Verificar si el ID realmente existe en Supabase antes de hacer UPDATE.
    // Un OC creado offline (en LS) puede tener un UUID que no existe en BD,
    // lo cual causa un PATCH 400. En ese caso se hace INSERT con nuevo UUID.
    const { data: existing } = await supabase
      .from('ct_order_confirmations')
      .select('id')
      .eq('id', doc.id)
      .maybeSingle()

    if (existing) {
      // UPDATE del registro existente
      const { error } = await supabase
        .from('ct_order_confirmations')
        .update(ocPayload)
        .eq('id', doc.id)
      if (error) throw new Error(`ct_order_confirmations UPDATE: ${error.message}`)
      oc_id = doc.id
    } else {
      // ID de LS no existe en Supabase → INSERT con nuevo UUID asignado por BD
      const { data, error } = await supabase
        .from('ct_order_confirmations')
        .insert(ocPayload)
        .select('id')
        .single()
      if (error) throw new Error(`ct_order_confirmations INSERT (id-not-found): ${error.message}`)
      oc_id = (data as { id: string }).id
    }
  } else {
    // INSERT de registro nuevo
    const { data, error } = await supabase
      .from('ct_order_confirmations')
      .insert(ocPayload)
      .select('id')
      .single()
    if (error) throw new Error(`ct_order_confirmations INSERT: ${error.message}`)
    oc_id = (data as { id: string }).id
  }

  // ── 3. Replace items ──────────────────────────────────────────────────────
  const { error: delErr } = await supabase
    .from('ct_order_confirmation_items')
    .delete()
    .eq('confirmation_id', oc_id)
  if (delErr) throw new Error(`ct_order_confirmation_items DELETE: ${delErr.message}`)

  if (doc.items.length > 0) {
    const itemsPayload = doc.items.map((it, idx) => ({
      confirmation_id: oc_id,
      bache_code: it.bache_code ?? null,
      description: it.description,
      program: it.program ?? null,
      quantity_kg: it.quantity_kg,
      unit_price_per_lb_usd: it.unit_price_per_lb_usd,
      total_usd: it.total_usd,
      line_order: idx + 1,
    }))
    const { error: insErr } = await supabase
      .from('ct_order_confirmation_items')
      .insert(itemsPayload)
    if (insErr) throw new Error(`ct_order_confirmation_items INSERT: ${insErr.message}`)
  }

  return { ...doc, id: oc_id, number: confirmationNumber, buyer_id }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE DOCUMENTO NUEVO VACÍO
// ─────────────────────────────────────────────────────────────────────────────

export function newOrderConfirmation(): OrderConfirmation {
  return {
    id: crypto.randomUUID(),
    number: '',
    date: new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    }),
    buyer: {
      company_name: '',
      contact_name: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      email: '',
    },
    seller: {
      name: 'LA PALMA Y EL TUCÁN',
      address: 'Vereda Berlín, San Francisco, Cundinamarca, Colombia',
      phone: '+57 320 000 0000',
      email: 'comercial@lapalmayeltucan.com',
    },
    items: [{ description: '', quantity_kg: 0, unit_price_per_lb_usd: 0, total_usd: 0 }],
    origin_country: 'COLOMBIA',
    preparation_varietal: '',
    moisture_level: '10.5 - 11.5%',
    shipping_date: 'TBC',
    arrival_date: 'TBC',
    incoterm: 'DAP',
    payment_terms: '',
    destination_country: '',
    total_usd: 0,
    status: 'draft',
    created_at: new Date().toISOString(),
  }
}

export function newShippingInfo(mode: 'sea' | 'air'): ShippingInfo {
  const base = {
    id: crypto.randomUUID(),
    mode,
    date: new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
    }),
    contract_number: '',
    buyer_ref: '',
    seller_ref: '',
    consignee: { name: '', address: '', phone: '', email: '', country: '' },
    special_requirements: '',
    created_at: new Date().toISOString(),
  }
  if (mode === 'sea') {
    return {
      ...base,
      shipment_line: '',
      loading_port: '',
      destination_port: '',
      documents_required_text: '',
      notify: { name: '', address: '', phone: '', email: '' },
    }
  }
  return {
    ...base,
    contact_person: '',
    documents_checklist: {
      invoice: false,
      packinglist: false,
      phytosanitary: false,
      cert_origin: false,
    },
  }
}

// ─── Ejemplo precargado: Leaves Coffee Tokio ─────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// TRIP TO ORIGIN
// ─────────────────────────────────────────────────────────────────────────────

// TODO: refactor schema cuando Felipe defina campos exactos en ct_trip_to_origin.
// Por ahora usamos localStorage como fuente de verdad con intento de Supabase via
// columnas disponibles: visit_date_start (← trip_date) + activities (← days JSONB)
// + notes (← welcome_text_paragraphs + closing_text como JSON estructurado).

export function getTripsFromLS(): TripToOrigin[] {
  try {
    const raw = localStorage.getItem(LS_KEY_TRIPS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<TripToOrigin>[]
    return parsed
      .filter(d => Boolean(d.id))
      .map(d => ({
        id: d.id ?? '',
        client_name: d.client_name ?? '',
        client_email: d.client_email,
        trip_date: d.trip_date ?? '',
        welcome_text_paragraphs: d.welcome_text_paragraphs ?? ['', ''],
        days: d.days ?? [],
        closing_text: d.closing_text ?? '',
        status: (d.status as TripToOrigin['status']) ?? 'draft',
        buyer_id: d.buyer_id,
        created_at: d.created_at ?? new Date().toISOString(),
      }))
  } catch (e) {
    console.error('getTripsFromLS error:', e)
    return []
  }
}

export function saveTripsToLS(all: TripToOrigin[]): void {
  localStorage.setItem(LS_KEY_TRIPS, JSON.stringify(all))
}

export async function getTrips(): Promise<TripToOrigin[]> {
  const online = await isSupabaseOnline()
  if (!online) return getTripsFromLS()

  try {
    const { data, error } = await supabase
      .from('ct_trip_to_origin')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = data ?? []
    if (rows.length === 0) return getTripsFromLS()

    // Mapear desde schema Supabase a nuestro tipo local
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((row: Record<string, any>) => {
      // notes guarda welcome_text_paragraphs + closing_text como JSON
      let welcome_text_paragraphs: string[] = ['', '']
      let closing_text = ''
      if (row.notes) {
        try {
          const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes
          if (notes.welcome_text_paragraphs) welcome_text_paragraphs = notes.welcome_text_paragraphs as string[]
          if (notes.closing_text) closing_text = notes.closing_text as string
        } catch { /* mantiene defaults */ }
      }

      // activities guarda el array de días
      let days: TripDay[] = []
      if (row.activities) {
        try {
          const acts = typeof row.activities === 'string' ? JSON.parse(row.activities) : row.activities
          if (Array.isArray(acts)) days = acts as TripDay[]
        } catch { /* mantiene default */ }
      }

      // visitor_names[0] como client_name
      const visitorNames: string[] = row.visitor_names ?? []
      const client_name = visitorNames[0] ?? (row.client_name as string | undefined) ?? ''

      return {
        id: row.id as string,
        client_name,
        client_email: row.client_email as string | undefined,
        trip_date: (row.visit_date_start as string | null)
          ? new Date(row.visit_date_start as string).toLocaleDateString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
            })
          : '',
        welcome_text_paragraphs,
        days,
        closing_text,
        status: (row.status as TripToOrigin['status']) ?? 'draft',
        buyer_id: row.buyer_id as string | undefined,
        created_at: row.created_at as string,
      }
    })
  } catch (e) {
    console.error('getTrips error:', e)
    return getTripsFromLS()
  }
}

export async function saveTrip(trip: TripToOrigin): Promise<void> {
  // LS siempre
  const allLS = getTripsFromLS()
  const idx = allLS.findIndex(t => t.id === trip.id)
  if (idx >= 0) allLS[idx] = trip
  else allLS.push(trip)
  saveTripsToLS(allLS)

  // Supabase: try/catch silencioso
  const online = await isSupabaseOnline()
  if (!online) return

  try {
    const notesJson = JSON.stringify({
      welcome_text_paragraphs: trip.welcome_text_paragraphs,
      closing_text: trip.closing_text,
    })

    await supabase.from('ct_trip_to_origin').upsert({
      id: trip.id,
      visitor_names: [trip.client_name],
      client_email: trip.client_email ?? null,
      visit_date_start: trip.trip_date
        ? new Date(trip.trip_date).toISOString().split('T')[0]
        : null,
      activities: trip.days,
      notes: notesJson,
      status: trip.status,
      buyer_id: trip.buyer_id ?? null,
      created_at: trip.created_at,
    })
  } catch (e) {
    console.error('saveTrip Supabase error:', e)
    // LS ya quedó guardado
  }
}

export async function deleteTrip(id: string): Promise<void> {
  const allLS = getTripsFromLS().filter(t => t.id !== id)
  saveTripsToLS(allLS)

  const online = await isSupabaseOnline()
  if (!online) return

  try {
    await supabase.from('ct_trip_to_origin').delete().eq('id', id)
  } catch (e) {
    console.error('deleteTrip error:', e)
  }
}

/** Crea un TripToOrigin nuevo con los 3 días del PDF original precargados */
export function newTripToOrigin(): TripToOrigin {
  const days: TripDay[] = [
    {
      day_number: 1,
      title: 'Arrival & Visit to La Amistad',
      date: 'NOVEMBER 19, 2026',
      schedule: [
        { time: '7:00 AM', activity: 'Pickup at Hotel', description: 'Departure from Bogotá hotel lobby' },
        { time: '10:45 AM', activity: 'Arrival to the Farm', description: 'Coffee Arrival, Processing, Milling Plant' },
        { time: '12:00 PM', activity: 'Farm Tour', description: 'Visit La Amistad plots, varietal garden and processing areas' },
        { time: '1:30 PM', activity: 'Lunch at the Farm' },
        { time: '3:00 PM', activity: 'Cupping Session', description: 'Current harvest lot selection' },
        { time: '5:30 PM', activity: 'Return to Bogotá' },
      ],
    },
    {
      day_number: 2,
      title: 'Deep Dive — Fermentation & Processing',
      date: 'NOVEMBER 20, 2026',
      schedule: [
        { time: '7:00 AM', activity: 'Pickup at Hotel' },
        { time: '10:45 AM', activity: 'Arrival to the Farm' },
        { time: '11:00 AM', activity: 'Fermentation Workshop', description: 'pH monitoring, tank visits, protocol review' },
        { time: '1:30 PM', activity: 'Lunch at the Farm' },
        { time: '2:30 PM', activity: 'Advanced Cupping', description: 'Micro-lot comparatives with Katherine Rodríguez' },
        { time: '5:00 PM', activity: 'Return to Bogotá' },
      ],
    },
    {
      day_number: 3,
      title: 'Closing & Farewell',
      date: 'NOVEMBER 21, 2026',
      schedule: [
        { time: '9:00 AM', activity: 'Coffee Breakfast', description: 'Brew bar at the farm — filter and espresso' },
        { time: '10:00 AM', activity: 'Final Q&A with the team' },
        { time: '11:30 AM', activity: 'Departure', description: 'Return transfer to Bogotá airport or hotel' },
      ],
    },
  ]

  return {
    id: crypto.randomUUID(),
    client_name: '',
    client_email: '',
    trip_date: new Date().toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    }),
    welcome_text_paragraphs: [
      'We want this experience to be more human than ever. Join our team at the farm and immerse yourself in our day-to-day activities.',
      'Please, ask many questions, share in our passion, and above all—enjoy the journey!',
    ],
    days,
    closing_text:
      'Everything we do comes back to the people who share our passion for honest coffee. We are so incredibly happy to receive you and to share our day-to-day with you.',
    status: 'draft',
    created_at: new Date().toISOString(),
  }
}

// ─── Helper de debugging — usar en consola: window._clearCafeTrazLS() ────────
if (typeof window !== 'undefined') {
  ;(window as unknown as { _clearCafeTrazLS: () => void })._clearCafeTrazLS = () => {
    localStorage.removeItem('cafe_traz_offerings')
    localStorage.removeItem('cafe_traz_documents_orders')
    localStorage.removeItem('cafe_traz_documents_shippings')
    localStorage.removeItem(LS_KEY_TRIPS)
    console.log('LocalStorage de cafe-trazabilidad limpiado. Recarga la página.')
  }
}

export const LEAVES_COFFEE_EXAMPLE: OrderConfirmation = {
  id: 'example-leaves-coffee-2026',
  number: 'OC-2026-001',
  date: '03/25/26',
  buyer: {
    company_name: 'Leaves Coffee',
    contact_name: 'Miho Haru',
    address: '1-8-8 Honjo',
    city: 'Sumida City, Tokyo',
    country: 'JAPAN',
    postal_code: '1300004',
    phone: '81 3 5637 8718',
    email: 'miho@leavescoffee.jp',
  },
  seller: {
    name: 'FLAVOR EQUATION',
    address: 'Calle 70 A # 5-37, Bogotá, Colombia',
    phone: '+1 (503) 446-5210',
    email: 'dahyana@equationcoffee.com',
  },
  items: [
    {
      description: 'Lot. 06 Sidra',
      quantity_kg: 25.0,
      unit_price_per_lb_usd: 51.72,
      total_usd: 2850.58,
    },
    {
      description: 'Lot. 65 Geisha',
      quantity_kg: 12.5,
      unit_price_per_lb_usd: 51.72,
      total_usd: 1425.29,
    },
  ],
  origin_country: 'COLOMBIA',
  preparation_varietal: 'EP WITH A 5% TOLERANCE ON SCREEN SIZE 14&13 - DEFECT TOLERANCE 0-5',
  moisture_level: '10.5 - 11.5%',
  shipping_date: 'JUNE',
  arrival_date: 'TBC',
  incoterm: 'DAP',
  payment_terms: 'CAD - 15 days',
  destination_country: 'JAPAN',
  total_usd: 4275.87,
  status: 'sent',
  created_at: '2026-03-25T00:00:00.000Z',
}
