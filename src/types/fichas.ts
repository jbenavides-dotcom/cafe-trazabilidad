export interface ProgramTemplate {
  code: 'pulse' | 'beat' | 'connect' | 'amistad'
  name: string
  tagline: string
  description_long: string
  color_hex: string
}

export interface OfferingSample {
  sample_order: number
  /** Código del bache individual (ej. "001-26"). Antes "nanolote_code", renombrado 2026-05-07. */
  bache_code: string
  variety: string
  process: string
  tasting_notes: string
  availability_kg: number
  price_usd_per_lb: number
  tasting_score?: string
  macroprofile?: string
  profile?: string
}

export interface OfferingRecipient {
  email: string
  name: string
  company?: string
  country?: string
  funnel_stage: 'queued' | 'sent' | 'opened' | 'viewed' | 'responded' | 'negotiating' | 'won' | 'lost'
  opened_email_at?: string
  last_viewed_at?: string
  view_count: number
  replied_at?: string
}

export interface Offering {
  id: string
  template_code: ProgramTemplate['code']
  title: string
  cover_message: string
  access_token: string
  samples: OfferingSample[]
  recipients: OfferingRecipient[]
  status: 'draft' | 'sent' | 'viewed' | 'responded' | 'expired'
  created_at: string
  sent_at?: string
}

// ─── Documentos comerciales ───────────────────────────────────────────────────

export interface BuyerInfo {
  company_name: string
  contact_name: string
  address: string
  city: string
  country: string
  postal_code?: string
  phone: string
  email: string
}

export interface SellerInfo {
  name: string
  address: string
  phone: string
  email: string
}

export interface OrderConfirmationItem {
  bache_code?: string    // referencia al bache del CFF (nuevo — items legacy no lo tienen)
  description: string
  program?: 'pulse' | 'beat' | 'connect' | 'amistad' | null  // programa comercial LP&ET
  quantity_kg: number
  unit_price_per_lb_usd: number
  total_usd: number
}

export interface OrderConfirmation {
  id: string
  /** UUID del registro en public.ct_buyers (presente después del primer save a Supabase) */
  buyer_id?: string
  number: string
  date: string
  buyer: BuyerInfo
  seller: SellerInfo
  items: OrderConfirmationItem[]
  origin_country: string
  preparation_varietal: string
  moisture_level: string
  shipping_date: string
  arrival_date: string
  incoterm: 'DAP' | 'FOB' | 'CIF' | 'EXW'
  payment_terms: string
  destination_country: string
  total_usd: number
  status: 'draft' | 'sent' | 'signed' | 'shipped' | 'completed'
  created_at: string
}

export interface ShippingParty {
  name: string
  address: string
  phone: string
  email: string
  country?: string
}

export interface AirDocumentsChecklist {
  invoice: boolean
  packinglist: boolean
  phytosanitary: boolean
  cert_origin: boolean
}

export interface ShippingInfo {
  id: string
  mode: 'sea' | 'air'
  /** UUID del OrderConfirmation vinculado (opcional) */
  confirmation_id?: string
  date: string
  contract_number: string
  buyer_ref: string
  seller_ref: string
  // sea-only
  shipment_line?: string
  loading_port?: string
  destination_port?: string
  documents_required_text?: string
  notify?: ShippingParty
  // air-only
  contact_person?: string
  documents_checklist?: AirDocumentsChecklist
  // common
  consignee: ShippingParty
  special_requirements: string
  created_at: string
}

// ─── Trip to Origin ────────────────────────────────────────────────────────────

export interface TripScheduleItem {
  time: string         // "7:00 AM"
  activity: string     // "Pickup at Hotel"
  description?: string // "Coffee Arrival, Processing, Milling Plant"
}

export interface TripDay {
  day_number: number   // 1, 2, 3...
  title: string        // "Arrival & Visit to La Amistad"
  date: string         // "NOVEMBER 19, 2026"
  schedule: TripScheduleItem[]
}

export interface TripToOrigin {
  id: string
  client_name: string
  client_email?: string
  trip_date: string                    // "04/02/2026"
  welcome_text_paragraphs: string[]    // 2 párrafos
  days: TripDay[]
  closing_text: string
  status: 'draft' | 'sent' | 'signed'
  buyer_id?: string
  created_at: string
}
