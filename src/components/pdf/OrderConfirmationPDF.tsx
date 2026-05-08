/**
 * OrderConfirmationPDF.tsx
 *
 * PDF print-ready para Order Confirmation. Replica el layout visual de
 * OrderConfirmationPreviewDoc (HTML) usando react-pdf/renderer.
 *
 * Tamaño: A4 (210×297 mm). Márgenes: 15mm todos los lados.
 * Colores: #E91E8C (fucsia), #FCE4EC (rosa pastel), #FBF7F0 (fondo crema).
 * Tipografías: Helvetica nativa (evita CORS con gstatic.com + woff2 incompatible).
 *
 * Bug corregido: react-pdf solo acepta .ttf/.otf — los .woff2 de Google Fonts
 * causan error silencioso y el PDF no se genera. Se usa Helvetica nativa.
 * Bug corregido: PDFDownloadLink renderiza <a> plano sin estilos de botón.
 *   Ahora se usa pdf().toBlob() en click handler para control total.
 */

import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { OrderConfirmation, OrderConfirmationItem } from '../../types/fichas'

// ─── Deshabilitar hyphenation ──────────────────────────────────────────────────
Font.registerHyphenationCallback(word => [word])

// ─── Constantes de programa ───────────────────────────────────────────────────
const PROGRAM_COLORS_PDF: Record<NonNullable<OrderConfirmationItem['program']>, string> = {
  pulse: '#FF7A8A',
  beat: '#FF1A6E',
  connect: '#8A7BC4',
  amistad: '#8A9863',
}

const PROGRAM_NAMES_PDF: Record<NonNullable<OrderConfirmationItem['program']>, string> = {
  pulse: 'Pulse',
  beat: 'Beat',
  connect: 'Connect',
  amistad: 'La Amistad',
}

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  pink: '#E91E8C',
  pinkDark: '#C2185B',
  cream: '#FBF7F0',
  black: '#000000',
  white: '#FFFFFF',
  dark: '#2D2D2D',
  nearBlack: '#1a1a1a',
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function calcTotal(items: OrderConfirmationItem[]): number {
  return items.reduce((acc, it) => acc + it.total_usd, 0)
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Página
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    backgroundColor: C.cream,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },

  // 1. Banda negra superior
  blackBand: {
    backgroundColor: C.black,
    paddingVertical: 6,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  blackBandText: {
    color: C.white,
    fontFamily: 'Helvetica-Oblique',
    fontSize: 9.5,
    letterSpacing: 0.2,
    lineHeight: 1.4,
  },

  // 2. Bloque logo
  logoBlock: {
    backgroundColor: C.cream,
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  logoSubtitle: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 3,
  },
  logoSubtitleText: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    letterSpacing: 2.5,
    color: C.nearBlack,
  },
  logoAmp: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8,
    color: C.nearBlack,
  },
  logoMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 0,
  },
  logoFrom: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 29,
    color: C.pink,
    lineHeight: 1,
  },
  logoThe: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 22,
    color: C.pink,
    lineHeight: 1,
    marginHorizontal: 3,
  },
  logoHeart: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 29,
    color: C.pink,
    lineHeight: 1,
  },

  // 3. Título
  titleBlock: {
    backgroundColor: C.cream,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  titleText: {
    fontFamily: 'Helvetica',
    fontSize: 36,
    color: C.pink,
    lineHeight: 1.05,
    letterSpacing: -0.3,
  },
  titleDate: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 13,
    color: C.pinkDark,
    marginTop: 4,
    letterSpacing: 0.2,
  },

  // 4. Intro
  introBlock: {
    backgroundColor: C.cream,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  introText: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.dark,
    lineHeight: 1.55,
    marginBottom: 5,
  },

  // 5. Parties — una sola caja fucsia con 2 columnas
  partiesRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: C.pink,
    borderRadius: 5,
    overflow: 'hidden',
  },
  partyBuyer: {
    flex: 1,
    padding: 13,
  },
  partySeller: {
    flex: 1,
    padding: 13,
  },
  partyLabel: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 10,
    color: C.white,
    marginBottom: 6,
    lineHeight: 1,
  },
  partyLine: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.white,
    lineHeight: 1.6,
  },

  // 6. Tabla
  tableWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 14,
    backgroundColor: C.cream,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.pink,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
  },
  tableFooterRow: {
    flexDirection: 'row',
    backgroundColor: C.white,
  },
  // Anchos de columna: Description 2fr · Programa 1fr · Kg 0.8fr · $/LB 1fr · Total 1fr
  thDesc: {
    flex: 2,
    padding: 7,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.white,
    letterSpacing: 0.3,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
  },
  thProg: {
    flex: 1,
    padding: 7,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.white,
    letterSpacing: 0.3,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
  },
  thNum: {
    flex: 1,
    padding: 7,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.white,
    letterSpacing: 0.3,
    textAlign: 'right',
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
  },
  tdDesc: {
    flex: 2,
    padding: 6,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.dark,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
  },
  tdProg: {
    flex: 1,
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
    justifyContent: 'center',
  },
  tdNum: {
    flex: 1,
    padding: 6,
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.dark,
    textAlign: 'right',
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
  },
  tfEmptyCell: {
    flex: 1,
    padding: 6,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
    backgroundColor: C.white,
  },
  tfLabelCell: {
    flex: 1,
    padding: 7,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.white,
    textAlign: 'right',
    backgroundColor: C.pink,
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
    letterSpacing: 0.3,
  },
  tfTotalCell: {
    flex: 1,
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.dark,
    textAlign: 'right',
    borderWidth: 0.5,
    borderColor: C.pink,
    borderStyle: 'solid',
    backgroundColor: C.white,
  },

  // 7. Specs
  specsBlock: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: C.cream,
  },
  specRow: {
    flexDirection: 'row',
    marginBottom: 1,
    alignItems: 'flex-start',
  },
  specKey: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.nearBlack,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  specColon: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: C.nearBlack,
    marginRight: 3,
    flexShrink: 0,
  },
  specValue: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.dark,
    flex: 1,
    lineHeight: 1.55,
  },
})

// ─── Documento PDF ────────────────────────────────────────────────────────────

export function OrderConfirmationPDF({ doc }: { doc: OrderConfirmation }) {
  const grandTotal = doc.total_usd > 0 ? doc.total_usd : calcTotal(doc.items)

  return (
    <Document
      title={`Order Confirmation ${doc.number || ''}`}
      author="La Palma y El Tucán"
      creator="Café Trazabilidad LP&ET"
    >
      <Page size="A4" style={styles.page}>

        {/* 1. Banda negra */}
        <View style={styles.blackBand}>
          <Text style={styles.blackBandText}>
            Thank You for being at the heart of this journey
          </Text>
        </View>

        {/* 2. Logo */}
        <View style={styles.logoBlock}>
          <View style={styles.logoSubtitle}>
            <Text style={styles.logoSubtitleText}>LA PALMA</Text>
            <Text style={styles.logoAmp}> &amp; </Text>
            <Text style={styles.logoSubtitleText}>EL TUCÁN</Text>
          </View>
          <View style={styles.logoMain}>
            <Text style={styles.logoFrom}>From</Text>
            <Text style={styles.logoThe}> The </Text>
            <Text style={styles.logoHeart}>heart</Text>
          </View>
        </View>

        {/* 3. Título */}
        <View style={styles.titleBlock}>
          <Text style={styles.titleText}>Order Confirmation</Text>
          {doc.date ? (
            <Text style={styles.titleDate}>Date: {doc.date}</Text>
          ) : null}
        </View>

        {/* 4. Intro */}
        <View style={styles.introBlock}>
          <Text style={styles.introText}>
            This is to confirm that we are in receipt of your order.
          </Text>
          <Text style={styles.introText}>
            We hereby confirm acceptance and have reserved the nano-lots and pico-lots
            of green specialty coffee detailed below with terms and conditions agreed.
          </Text>
        </View>

        {/* 5. Buyer / Seller */}
        <View style={styles.partiesRow}>
          {/* Buyer */}
          <View style={styles.partyBuyer}>
            <Text style={styles.partyLabel}>Buyer:</Text>
            {doc.buyer?.company_name ? (
              <Text style={styles.partyLine}>{doc.buyer.company_name}</Text>
            ) : null}
            {doc.buyer?.contact_name ? (
              <Text style={styles.partyLine}>Attn: {doc.buyer.contact_name}</Text>
            ) : null}
            {doc.buyer?.address ? (
              <Text style={styles.partyLine}>Address: {doc.buyer.address},</Text>
            ) : null}
            {(doc.buyer?.city || doc.buyer?.country) ? (
              <Text style={styles.partyLine}>
                {[doc.buyer?.city, doc.buyer?.country].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {doc.buyer?.postal_code ? (
              <Text style={styles.partyLine}>{doc.buyer.postal_code}</Text>
            ) : null}
            {doc.buyer?.phone ? (
              <Text style={styles.partyLine}>Phone: {doc.buyer.phone}</Text>
            ) : null}
            {doc.buyer?.email ? (
              <Text style={styles.partyLine}>Mail: {doc.buyer.email}</Text>
            ) : null}
          </View>

          {/* Seller */}
          <View style={styles.partySeller}>
            <Text style={styles.partyLabel}>Seller</Text>
            {doc.seller?.name ? (
              <Text style={styles.partyLine}>{doc.seller.name}</Text>
            ) : null}
            {doc.seller?.address ? (
              <Text style={styles.partyLine}>{doc.seller.address}</Text>
            ) : null}
            {doc.seller?.phone ? (
              <Text style={styles.partyLine}>I: {doc.seller.phone}</Text>
            ) : null}
            {doc.seller?.email ? (
              <Text style={styles.partyLine}>E: {doc.seller.email}</Text>
            ) : null}
          </View>
        </View>

        {/* 6. Tabla de items */}
        <View style={styles.tableWrapper}>
          {/* Header */}
          <View style={styles.tableHeaderRow}>
            <Text style={styles.thDesc}>Description</Text>
            <Text style={styles.thProg}>Programa</Text>
            <Text style={styles.thNum}>Quantity in Kg</Text>
            <Text style={styles.thNum}>Unit price x LBS</Text>
            <Text style={styles.thNum}>Total</Text>
          </View>

          {/* Body */}
          {doc.items.map((it, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tdDesc}>{it.description || '—'}</Text>
              <View style={styles.tdProg}>
                {it.program ? (
                  <Text style={{ color: PROGRAM_COLORS_PDF[it.program], fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>
                    {PROGRAM_NAMES_PDF[it.program]}
                  </Text>
                ) : (
                  <Text style={{ color: '#aaa', fontSize: 8.5 }}>—</Text>
                )}
              </View>
              <Text style={styles.tdNum}>
                {it.quantity_kg > 0 ? it.quantity_kg.toFixed(1) : '—'}
              </Text>
              <Text style={styles.tdNum}>
                {it.unit_price_per_lb_usd > 0
                  ? `$${fmtUSD(it.unit_price_per_lb_usd)}`
                  : '—'}
              </Text>
              <Text style={styles.tdNum}>
                {it.total_usd > 0 ? `$${fmtUSD(it.total_usd)}` : '—'}
              </Text>
            </View>
          ))}

          {/* Footer / Total — 3 celdas vacías (Description + Programa + Kg) */}
          <View style={styles.tableFooterRow}>
            <View style={[styles.tfEmptyCell, { flex: 2 }]} />
            <View style={[styles.tfEmptyCell, { flex: 1 }]} />
            <View style={[styles.tfEmptyCell, { flex: 1 }]} />
            <Text style={styles.tfLabelCell}>Total</Text>
            <Text style={styles.tfTotalCell}>${fmtUSD(grandTotal)}</Text>
          </View>
        </View>

        {/* 7. Specs */}
        <View style={styles.specsBlock}>
          {doc.origin_country ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>ORIGIN</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.origin_country}</Text>
            </View>
          ) : null}

          {doc.preparation_varietal ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>PREPARATION VARIETAL</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.preparation_varietal}</Text>
            </View>
          ) : null}

          {doc.moisture_level ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>MOISTURE LEVEL</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.moisture_level}</Text>
            </View>
          ) : null}

          {doc.shipping_date ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>SHIPPING DATE</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.shipping_date}</Text>
            </View>
          ) : null}

          {doc.arrival_date ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>ARRIVAL DATE</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.arrival_date}</Text>
            </View>
          ) : null}

          {doc.incoterm ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>INCOTERM</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.incoterm}</Text>
            </View>
          ) : null}

          {doc.payment_terms ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>PAYMENT</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.payment_terms}</Text>
            </View>
          ) : null}

          {doc.destination_country ? (
            <View style={styles.specRow}>
              <Text style={styles.specKey}>DESTINATION</Text>
              <Text style={styles.specColon}>:</Text>
              <Text style={styles.specValue}>{doc.destination_country}</Text>
            </View>
          ) : null}
        </View>

      </Page>
    </Document>
  )
}

// ─── Botón de descarga — patrón programático (pdf().toBlob()) ─────────────────
// Evita PDFDownloadLink que renderiza <a> sin estilos de botón y tiene
// problemas de propagación de eventos en algunos wrappers.

interface DownloadButtonProps {
  doc: OrderConfirmation
  className?: string
}

export function OrderConfirmationDownloadButton({ doc, className }: DownloadButtonProps) {
  const filename = doc.number
    ? `${doc.number.replace(/[^a-zA-Z0-9-_]/g, '-')}.pdf`
    : 'order-confirmation.pdf'

  async function handleDownload() {
    try {
      const blob = await pdf(<OrderConfirmationPDF doc={doc} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generando PDF:', err)
      alert(`No se pudo generar el PDF. Revisa la consola para detalles.`)
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleDownload()}
      aria-label={`Descargar PDF de Order Confirmation ${doc.number || ''}`}
    >
      Generar PDF
    </button>
  )
}
