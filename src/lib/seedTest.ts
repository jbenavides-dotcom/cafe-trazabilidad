import { supabase } from './supabase'

export type SeedResult = {
  ok: boolean
  rows: Record<string, number>
  errors: Record<string, string>
  total: number
  durationMs: number
}

const STAMP = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

export async function runSeedTest(): Promise<SeedResult> {
  const t0 = Date.now()
  const rows: Record<string, number> = {}
  const errors: Record<string, string> = {}

  const stamp = STAMP()
  const testTag = `TEST ${stamp}`

  // 1. ct_buyers — INSERT 1 buyer ficticio
  let buyerId: string | null = null
  {
    const { data, error } = await supabase
      .from('ct_buyers')
      .insert({
        company_name: `Coffee Buyer Test ${stamp}`,
        contact_name: 'Test Contact',
        address: '123 Test Street',
        city: 'Tokyo',
        country: 'JAPAN',
        postal_code: '100-0001',
        phone: '+81-3-0000-0000',
        email: `test-${Date.now()}@example.com`,
        tags: ['test'],
        notes: testTag,
      })
      .select('id')
      .single()
    if (error) errors.ct_buyers = error.message
    else { buyerId = (data as { id: string }).id; rows.ct_buyers = 1 }
  }

  // 2. ct_order_confirmations + items
  let ocId: string | null = null
  if (buyerId) {
    const { data, error } = await supabase
      .from('ct_order_confirmations')
      .insert({
        confirmation_number: `OC-TEST-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        buyer_id: buyerId,
        seller_name: 'LA PALMA Y EL TUCÁN',
        seller_address: 'Vereda Berlín, San Francisco, Cundinamarca',
        seller_phone: '+57 320 000 0000',
        seller_email: 'comercial@lapalmayeltucan.com',
        origin_country: 'COLOMBIA',
        preparation_varietal: 'EP screen 14+',
        moisture_level: '10.5-11.5%',
        shipping_date: 'JUNE',
        arrival_date: 'TBC',
        incoterm: 'DAP',
        payment_terms: 'CAD - 15 days',
        destination_country: 'JAPAN',
        total_usd: 4275.87,
        status: 'draft',
      })
      .select('id')
      .single()
    if (error) errors.ct_order_confirmations = error.message
    else { ocId = (data as { id: string }).id; rows.ct_order_confirmations = 1 }
  }

  // 3. ct_order_confirmation_items — 2 items
  if (ocId) {
    const { error } = await supabase
      .from('ct_order_confirmation_items')
      .insert([
        {
          confirmation_id: ocId,
          description: 'Lot. 06 Sidra (Test)',
          program: 'pulse',
          quantity_kg: 25.0,
          unit_price_per_lb_usd: 51.72,
          total_usd: 2850.58,
          line_order: 1,
        },
        {
          confirmation_id: ocId,
          description: 'Lot. 65 Geisha (Test)',
          program: 'beat',
          quantity_kg: 12.5,
          unit_price_per_lb_usd: 51.72,
          total_usd: 1425.29,
          line_order: 2,
        },
      ])
    if (error) errors.ct_order_confirmation_items = error.message
    else rows.ct_order_confirmation_items = 2
  }

  // 4. ct_shipping_documents — 1 sea
  if (ocId) {
    const { error } = await supabase
      .from('ct_shipping_documents')
      .insert({
        confirmation_id: ocId,
        mode: 'sea',
        date: new Date().toISOString().slice(0, 10),
        contract_number: `S/C-TEST-${Date.now()}`,
        buyer_ref: 'BR-001',
        seller_ref: 'SR-001',
        shipment_line: 'Maersk',
        loading_port: 'Cartagena, Colombia',
        destination_port: 'Tokyo, Japan',
        consignee_name: `Coffee Buyer Test ${stamp}`,
        consignee_address: '123 Test Street, Tokyo',
        consignee_country: 'JAPAN',
        special_requirements: testTag,
        is_first_shipment: true,
        status: 'draft',
      })
    if (error) errors.ct_shipping_documents = error.message
    else rows.ct_shipping_documents = 1
  }

  // 5. ct_trip_to_origin
  if (buyerId) {
    const { error } = await supabase
      .from('ct_trip_to_origin')
      .insert({
        buyer_id: buyerId,
        visit_date_start: '2026-11-19',
        visit_date_end: '2026-11-21',
        visitor_count: 2,
        visitor_names: ['Visitor 1', 'Visitor 2'],
        visitor_emails: ['v1@example.com', 'v2@example.com'],
        accommodation_type: 'cabaña',
        cupping_sessions: 2,
        language_preference: 'en',
        status: 'draft',
        notes: testTag,
      })
    if (error) errors.ct_trip_to_origin = error.message
    else rows.ct_trip_to_origin = 1
  }

  // 6. ct_offerings + samples + recipients
  // Necesita template_id del Pulse seed
  let offeringId: string | null = null
  {
    const { data: tpl } = await supabase
      .from('ct_program_templates')
      .select('id')
      .eq('code', 'pulse')
      .single()

    if (tpl) {
      const { data, error } = await supabase
        .from('ct_offerings')
        .insert({
          template_id: (tpl as { id: string }).id,
          title: `Test Offering ${stamp}`,
          subject_line: 'Test offering',
          cover_message: testTag,
          samples_count: 4,
          language: 'en',
          status: 'draft',
          created_by: 'seed-test',
        })
        .select('id')
        .single()
      if (error) errors.ct_offerings = error.message
      else { offeringId = (data as { id: string }).id; rows.ct_offerings = 1 }
    }
  }

  // 7. ct_offering_samples — 4 muestras
  if (offeringId) {
    const samples = [1, 2, 3, 4].map(n => ({
      offering_id: offeringId!,
      bache_code: `TEST-00${n}-26`,
      sample_order: n,
      microlot_number: `ML-TEST-${n}`,
      terroir_number: `TR-TEST-${n}`,
      variety: ['Sidra', 'Pink Bourbon', 'Geisha', 'Castillo'][n - 1],
      process: ['Aerobic 96h', 'Anaerobic thermal', 'Natural extended', 'Washed'][n - 1],
      tasting_notes: ['Roses, lychee', 'Mango, jasmine', 'Bergamot, peach', 'Cocoa, caramel'][n - 1],
      availability_kg: [25, 12.5, 25, 50][n - 1],
      price_usd_per_lb: [51.72, 65.0, 80.0, 28.5][n - 1],
    }))
    const { error } = await supabase.from('ct_offering_samples').insert(samples)
    if (error) errors.ct_offering_samples = error.message
    else rows.ct_offering_samples = 4
  }

  // 8. ct_recipients — 1 destinatario
  if (offeringId && buyerId) {
    const { error } = await supabase
      .from('ct_recipients')
      .insert({
        offering_id: offeringId,
        buyer_id: buyerId,
        email: `recipient-${Date.now()}@example.com`,
        name: 'Test Recipient',
        company: `Coffee Buyer Test ${stamp}`,
        country: 'JAPAN',
        funnel_stage: 'queued',
      })
    if (error) errors.ct_recipients = error.message
    else rows.ct_recipients = 1
  }

  const total = Object.values(rows).reduce((a, b) => a + b, 0)
  return {
    ok: Object.keys(errors).length === 0,
    rows,
    errors,
    total,
    durationMs: Date.now() - t0,
  }
}
