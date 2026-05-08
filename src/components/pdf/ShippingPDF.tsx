/**
 * ShippingPDF.tsx
 *
 * PDF print-ready para Shipping Information. Replica el layout visual del
 * ShippingPreviewDoc (HTML) usando react-pdf/renderer.
 *
 * Tamano: A4 (210x297 mm). Margenes: 15mm todos los lados.
 * Colores: #E91E8C (fucsia), #FFB3D9 (rosa claro titulos sobre fucsia),
 *          #FCE4EC (rosa pastel campos), #FBF7F0 (fondo crema mitad inferior).
 * Tipografias: Playfair Display + Inter.
 *
 * MODO SEA  -- layout completo pixel-perfect (sin tocar)
 * MODO AIR  -- layout adaptado pixel-perfect segun PDF original
 *   - Titulo en 2 lineas: "Air Shipping" / "Information"
 *   - Sin Contract Number
 *   - Contact Person con underline debajo del titulo
 *   - Consignee en top (Name + Address/Country + Phone/Email)
 *   - Documents Required = tabla 3 cols con checkboxes Yes/No
 *   - Sin Notify party
 *   - Label "Special Documents/ Requirements/ Other Instructions:"
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  PDFDownloadLink,
} from '@react-pdf/renderer'
import type { ShippingInfo, AirDocumentsChecklist } from '../../types/fichas'

// ─── Registro de fuentes ──────────────────────────────────────────────────────
Font.register({
  family: 'PlayfairDisplay',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vUDQbw.ttf',
      fontWeight: 'normal',
      fontStyle: 'italic',
    },
    {
      src: 'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFiD-vYSZviVYUb_rj3ij__anPXBYf9lW4e7GrRiS0zSumKfjM.ttf',
      fontWeight: 'bold',
      fontStyle: 'normal',
    },
  ],
})

Font.register({
  family: 'Inter',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7W4Q5KQ.woff2',
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
    {
      src: 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7W4Q5KQ.woff2',
      fontWeight: 'bold',
      fontStyle: 'normal',
    },
  ],
})

Font.registerHyphenationCallback(word => [word])

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  pink: '#E91E8C',
  pinkLight: '#FFB3D9',      // titulos sobre fondo fucsia
  pinkPastel: '#FCE4EC',     // fondo campos parte inferior
  pinkMedium: '#F5A8C8',     // fila docs alternada medio
  pinkLightRow: '#FAC8DC',   // fila docs alternada claro
  cream: '#FBF7F0',          // fondo mitad inferior
  white: '#FFFFFF',
  dark: '#2D2D2D',
  nearBlack: '#1a1a1a',
} as const

// ─── Estilos compartidos + especificos por modo ───────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 10,
    backgroundColor: C.cream,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },

  // ── MITAD SUPERIOR — fondo fucsia ───────────────────────────────────────────
  topSection: {
    backgroundColor: C.pink,
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 22,
  },

  // Fila Date arriba-izquierda
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  dateLabel: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 9,
    color: C.white,
    letterSpacing: 0.3,
  },
  dateBox: {
    borderWidth: 1,
    borderColor: C.white,
    borderStyle: 'solid',
    backgroundColor: C.white,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 70,
  },
  dateBoxText: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.nearBlack,
  },

  // Titulo central — SEA: 1 linea, AIR: 2 lineas
  titleBlock: {
    alignItems: 'center',
    marginBottom: 6,
  },
  // SEA titulo 1 linea
  titleText: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 'normal',
    fontSize: 42,
    color: C.pinkLight,
    lineHeight: 1.05,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  // AIR titulo 2 lineas
  titleAirLine: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 'normal',
    fontSize: 44,
    color: C.pinkLight,
    lineHeight: 1.05,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  contractRow: {
    fontFamily: 'Inter',
    fontSize: 9,
    color: C.pinkLight,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.2,
  },

  // Contact Person — AIR: fila con underline
  contactPersonRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
    justifyContent: 'center',
  },
  contactPersonLabel: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: C.white,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  contactPersonUnderline: {
    flex: 1,
    borderBottomWidth: 1.5,
    borderBottomColor: C.white,
    borderBottomStyle: 'solid',
    paddingBottom: 2,
    minHeight: 18,
    minWidth: 160,
  },
  contactPersonText: {
    fontFamily: 'Inter',
    fontSize: 8.5,
    color: C.white,
    lineHeight: 1.4,
  },

  // Campos en fondo fucsia — label blanco + caja blanca
  fieldRowFull: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 8,
  },
  fieldRow2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 7,
  },
  fieldRow2Item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabelWhite: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: C.white,
    flexShrink: 0,
    minWidth: 60,
    letterSpacing: 0.2,
  },
  fieldBoxWhite: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.white,
    borderStyle: 'solid',
    backgroundColor: C.white,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minHeight: 18,
  },
  fieldBoxText: {
    fontFamily: 'Inter',
    fontSize: 8.5,
    color: C.nearBlack,
    lineHeight: 1.4,
  },

  // ── MITAD INFERIOR — fondo crema ────────────────────────────────────────────
  bottomSection: {
    backgroundColor: C.cream,
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 20,
    flexGrow: 1,
  },

  // Seccion label rosa fucsia
  sectionLabel: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 9,
    color: C.pink,
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  // Lineas de texto libre (documents required sea / special requirements)
  textLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: C.pink,
    borderBottomStyle: 'solid',
    marginBottom: 7,
    paddingBottom: 3,
    minHeight: 16,
  },
  textLineText: {
    fontFamily: 'Inter',
    fontSize: 8.5,
    color: C.dark,
  },

  // 2 columnas Consignee / Notify (sea)
  partiesRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  partyCol: {
    flex: 1,
  },
  partyColLabel: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 9,
    color: C.pink,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  partyFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
    gap: 6,
  },
  partyFieldLabel: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 7.5,
    color: C.pink,
    flexShrink: 0,
    minWidth: 42,
    letterSpacing: 0.2,
  },
  partyFieldBox: {
    flex: 1,
    backgroundColor: C.pinkPastel,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 16,
  },
  partyFieldText: {
    fontFamily: 'Inter',
    fontSize: 7.5,
    color: C.nearBlack,
    lineHeight: 1.4,
  },

  // Air mode — tabla Documents Required
  docsTable: {
    marginBottom: 14,
  },
  docsTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: C.pink,
    borderBottomStyle: 'solid',
    paddingBottom: 4,
    marginBottom: 2,
  },
  docsTableHeaderDoc: {
    flex: 1,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: C.pink,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  docsTableHeaderYesNo: {
    width: 38,
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 8.5,
    color: C.pink,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  docsTableRowMedium: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.pinkMedium,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  docsTableRowLight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.pinkLightRow,
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  docsTableDocLabel: {
    flex: 1,
    fontFamily: 'Inter',
    fontSize: 8.5,
    color: C.nearBlack,
    fontWeight: 'normal',
  },
  docsTableCheckCell: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docsTableCheckBox: {
    width: 18,
    height: 18,
    backgroundColor: C.white,
    borderWidth: 0,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docsTableCheckMark: {
    fontFamily: 'Inter',
    fontWeight: 'bold',
    fontSize: 10,
    color: C.pink,
  },

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  footer: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: C.cream,
    alignItems: 'center',
    borderTopWidth: 0,
  },
  footerSubtitle: {
    fontFamily: 'Inter',
    fontSize: 6.5,
    letterSpacing: 2.5,
    color: C.nearBlack,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  footerMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  footerFrom: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 'bold',
    fontSize: 20,
    color: C.pink,
    lineHeight: 1,
  },
  footerThe: {
    fontFamily: 'PlayfairDisplay',
    fontStyle: 'italic',
    fontWeight: 'normal',
    fontSize: 15,
    color: C.pink,
    lineHeight: 1,
    marginHorizontal: 2,
  },
  footerHeart: {
    fontFamily: 'PlayfairDisplay',
    fontWeight: 'bold',
    fontSize: 20,
    color: C.pink,
    lineHeight: 1,
  },
})

// ─── Helpers compartidos ──────────────────────────────────────────────────────

function TopField({
  label,
  value,
  minWidth,
}: {
  label: string
  value: string
  minWidth?: number
}) {
  return (
    <View style={s.fieldRowFull}>
      <Text style={[s.fieldLabelWhite, minWidth ? { minWidth } : {}]}>{label}</Text>
      <View style={s.fieldBoxWhite}>
        <Text style={s.fieldBoxText}>{value || ' '}</Text>
      </View>
    </View>
  )
}

function TopField2({
  label,
  value,
  labelMinWidth,
}: {
  label: string
  value: string
  labelMinWidth?: number
}) {
  return (
    <View style={s.fieldRow2Item}>
      <Text style={[s.fieldLabelWhite, labelMinWidth ? { minWidth: labelMinWidth } : {}]}>{label}</Text>
      <View style={s.fieldBoxWhite}>
        <Text style={s.fieldBoxText}>{value || ' '}</Text>
      </View>
    </View>
  )
}

function PartyField({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.partyFieldRow}>
      <Text style={s.partyFieldLabel}>{label}</Text>
      <View style={s.partyFieldBox}>
        <Text style={s.partyFieldText}>{value || ' '}</Text>
      </View>
    </View>
  )
}

function TextLines({ text, count = 4 }: { text?: string; count?: number }) {
  const lines = (text ?? '').split('\n')
  const padded = Array.from({ length: count }, (_, i) => lines[i] ?? '')
  return (
    <>
      {padded.map((line, i) => (
        <View key={i} style={s.textLine}>
          <Text style={s.textLineText}>{line || ' '}</Text>
        </View>
      ))}
    </>
  )
}

// Tabla de documentos requeridos — air mode
const AIR_DOCS: { key: keyof AirDocumentsChecklist; label: string }[] = [
  { key: 'invoice', label: 'Invoice' },
  { key: 'packinglist', label: 'Packinglist' },
  { key: 'phytosanitary', label: 'Phytosanitary Certificate' },
  { key: 'cert_origin', label: 'Certificate of origin' },
]

// ─── Documento PDF ────────────────────────────────────────────────────────────

export function ShippingPDF({ doc }: { doc: ShippingInfo }) {
  const isSea = doc.mode === 'sea'
  const checklist: AirDocumentsChecklist = doc.documents_checklist ?? {
    invoice: false,
    packinglist: false,
    phytosanitary: false,
    cert_origin: false,
  }

  return (
    <Document
      title={isSea ? `Shipping Information ${doc.contract_number || ''}` : 'Air Shipping Information'}
      author="La Palma y El Tucan"
      creator="Cafe Trazabilidad LP&ET"
    >
      <Page size="A4" style={s.page}>

        {/* ── MITAD SUPERIOR FUCSIA ── */}
        <View style={s.topSection}>

          {/* Date arriba-izquierda */}
          <View style={s.dateRow}>
            <Text style={s.dateLabel}>Date</Text>
            <View style={s.dateBox}>
              <Text style={s.dateBoxText}>{doc.date || ' '}</Text>
            </View>
          </View>

          {isSea ? (
            /* SEA: titulo 1 linea + Contract Number */
            <>
              <View style={s.titleBlock}>
                <Text style={s.titleText}>Shipping Information</Text>
              </View>
              <Text style={s.contractRow}>
                Contract Number S/C: {doc.contract_number || '____________'}
              </Text>
            </>
          ) : (
            /* AIR: titulo en 2 lineas centradas */
            <View style={s.titleBlock}>
              <Text style={s.titleAirLine}>Air Shipping</Text>
              <Text style={s.titleAirLine}>Information</Text>
            </View>
          )}

          {/* Contact Person solo air con underline */}
          {!isSea && (
            <View style={s.contactPersonRow}>
              <Text style={s.contactPersonLabel}>Contact Person</Text>
              <View style={s.contactPersonUnderline}>
                <Text style={s.contactPersonText}>{doc.contact_person || ' '}</Text>
              </View>
            </View>
          )}

          {/* Buyer Ref */}
          <TopField label="Buyer Ref" value={doc.buyer_ref} />

          {/* Seller Ref */}
          <TopField label="Seller Ref" value={doc.seller_ref} />

          {isSea ? (
            /* SEA: Shipment Line + puertos */
            <>
              <TopField label="Shipment Line" value={doc.shipment_line ?? ''} />
              <View style={s.fieldRow2}>
                <TopField2 label="Loading Port" value={doc.loading_port ?? ''} labelMinWidth={70} />
                <TopField2 label="Destination Port" value={doc.destination_port ?? ''} labelMinWidth={82} />
              </View>
            </>
          ) : (
            /* AIR: Consignee (Name) + Address/Country + Phone/Email */
            <>
              <TopField label="Consignee" value={doc.consignee.name} minWidth={70} />
              <View style={s.fieldRow2}>
                <TopField2 label="Address" value={doc.consignee.address} labelMinWidth={50} />
                <TopField2 label="Country" value={doc.consignee.country ?? ''} labelMinWidth={50} />
              </View>
              <View style={s.fieldRow2}>
                <TopField2 label="Phone" value={doc.consignee.phone} labelMinWidth={40} />
                <TopField2 label="Email" value={doc.consignee.email} labelMinWidth={40} />
              </View>
            </>
          )}
        </View>

        {/* ── MITAD INFERIOR CREMA ── */}
        <View style={s.bottomSection}>

          {/* Documents required */}
          <Text style={s.sectionLabel}>Documents required:</Text>

          {isSea ? (
            <TextLines text={doc.documents_required_text} count={4} />
          ) : (
            /* AIR: tabla 3 columnas con checkboxes */
            <View style={s.docsTable}>
              {/* Header */}
              <View style={s.docsTableHeader}>
                <Text style={s.docsTableHeaderDoc}>Documents required</Text>
                <Text style={s.docsTableHeaderYesNo}>Yes</Text>
                <Text style={s.docsTableHeaderYesNo}>No</Text>
              </View>
              {/* Filas */}
              {AIR_DOCS.map(({ key, label }, idx) => {
                const isYes = checklist[key] === true
                const isNo = checklist[key] === false
                const rowStyle = idx % 2 === 0 ? s.docsTableRowMedium : s.docsTableRowLight
                return (
                  <View key={key} style={rowStyle}>
                    <Text style={s.docsTableDocLabel}>{label}</Text>
                    {/* Yes checkbox */}
                    <View style={s.docsTableCheckCell}>
                      <View style={s.docsTableCheckBox}>
                        {isYes && <Text style={s.docsTableCheckMark}>✓</Text>}
                      </View>
                    </View>
                    {/* No checkbox */}
                    <View style={s.docsTableCheckCell}>
                      <View style={s.docsTableCheckBox}>
                        {isNo && <Text style={s.docsTableCheckMark}>✓</Text>}
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}

          {/* Consignee + Notify — solo sea (air ya tiene consignee en top) */}
          {isSea && (
            <View style={s.partiesRow}>
              {/* Consignee */}
              <View style={s.partyCol}>
                <Text style={s.partyColLabel}>Consignee</Text>
                <PartyField label="Name" value={doc.consignee.name} />
                <PartyField label="Address" value={doc.consignee.address} />
                <PartyField label="Phone" value={doc.consignee.phone} />
                <PartyField label="Email" value={doc.consignee.email} />
              </View>
              {/* Notify */}
              <View style={s.partyCol}>
                <Text style={s.partyColLabel}>Notify</Text>
                <PartyField label="Name" value={doc.notify?.name ?? ''} />
                <PartyField label="Address" value={doc.notify?.address ?? ''} />
                <PartyField label="Phone" value={doc.notify?.phone ?? ''} />
                <PartyField label="Email" value={doc.notify?.email ?? ''} />
              </View>
            </View>
          )}

          {/* Special Requirements */}
          <Text style={s.sectionLabel}>
            {isSea ? 'Special Requirements:' : 'Special Documents/ Requirements/ Other Instructions:'}
          </Text>
          <TextLines text={doc.special_requirements} count={4} />

        </View>

        {/* ── FOOTER — logo FromTheheart ── */}
        <View style={s.footer}>
          <Text style={s.footerSubtitle}>LA PALMA &amp; EL TUCAN</Text>
          <View style={s.footerMain}>
            <Text style={s.footerFrom}>From</Text>
            <Text style={s.footerThe}> The </Text>
            <Text style={s.footerHeart}>heart</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}

// ─── Boton de descarga reutilizable ──────────────────────────────────────────

interface DownloadButtonProps {
  doc: ShippingInfo
  className?: string
}

export function ShippingDownloadButton({ doc, className }: DownloadButtonProps) {
  const isSea = doc.mode === 'sea'
  const prefix = isSea ? 'shipping' : 'air-shipping'
  const filename = doc.contract_number
    ? `${prefix}-${doc.contract_number.replace(/[^a-zA-Z0-9-_]/g, '-')}.pdf`
    : `${prefix}-info.pdf`

  return (
    <PDFDownloadLink
      document={<ShippingPDF doc={doc} />}
      fileName={filename}
      className={className}
      aria-label={`Descargar PDF de ${isSea ? 'Shipping' : 'Air Shipping'} Information ${doc.contract_number || ''}`}
    >
      {({ loading }) =>
        loading ? 'Generando PDF...' : 'Generar PDF'
      }
    </PDFDownloadLink>
  )
}
