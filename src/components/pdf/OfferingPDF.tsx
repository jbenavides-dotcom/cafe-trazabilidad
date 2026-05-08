/**
 * OfferingPDF.tsx
 *
 * PDF print-ready para Offering List. Replica el diseño visual del PDF original
 * de La Palma y El Tucán (9 páginas en el original, variable según muestras).
 *
 * Estructura por offering:
 *   1 × Cover page
 *   1 × Descripción del programa
 *   N × Ficha por muestra (una página por OfferingSample)
 *
 * Tipografía: Helvetica nativa (react-pdf no soporta woff2 de Google CDN).
 *   Los scripts cursivos del original son fuentes propietarias — se aproximan
 *   con Helvetica-BoldOblique en el PDF (la cursiva caligráfica solo existe
 *   en el preview HTML via Pinyon Script de Google Fonts).
 *
 * Tamaño: proporciones 9:16 en A4 (210×297mm). Se usa Page size="A4" con
 *   orientation portrait y padding cero en todos los bordes para tener control
 *   total del layout. Las proporciones del original se respetan via flexbox.
 *
 * Colores:
 *   Cover:  #B30055 (fucsia), #FAF6EE (crema), #FF8FB7 (rosa banda)
 *   Pulse header:   #FF7A6E (coral)
 *   Beat header:    #A52C7E (magenta-violeta)
 *   Connect header: #8B7AB5 (morado)
 *   Amistad header: #8A9863 (verde olivo)
 *   Tabla labels:   #B30055 siempre (magenta)
 *   Footer fichas:  #FF4FA0 (rosa vibrante)
 */

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer'
import type { Offering, OfferingSample } from '../../types/fichas'

// ─── Logos PNG cream (importados via Vite para URLs hashed correctas) ──────────
import pulseCream   from '../../assets/logos/pulse-cream.png'
import beatCream    from '../../assets/logos/beat-cream.png'
import connectCream from '../../assets/logos/connect-cream.png'
import amistadCream from '../../assets/logos/amistad-cream.png'

const LOGO_PNG: Record<Offering['template_code'], string> = {
  pulse:   pulseCream,
  beat:    beatCream,
  connect: connectCream,
  amistad: amistadCream,
}

// ─── Deshabilitar hyphenation ──────────────────────────────────────────────────
Font.registerHyphenationCallback(word => [word])

// ─── Paleta de colores ────────────────────────────────────────────────────────
const C = {
  // Cover
  fucsia: '#B30055',
  cream: '#FAF6EE',
  rosaBand: '#FF8FB7',
  // Programa headers — exactos de la guía ML
  pulseHeader:   '#E97062',   // coral
  beatHeader:    '#A8327E',   // magenta (from-the-heart)
  connectHeader: '#8470B5',   // lavender (nature-leads)
  amistadHeader: '#7D8456',   // olive (collaboration)
  // Tabla ficha — guía ML
  labelMagenta:  '#B8004C',   // columna label
  tableBorder:   '#E91E83',   // hot-pink border + stripe
  bottomBar:     '#F36AAB',   // bottom bar tagline
  mlCream:       '#F6F1E8',   // texto header
  // Texto
  white: '#FFFFFF',
  offWhite: '#FAF6EE',
  dark: '#2a2a2a',
  // Scripts en descripción
  pulseScript:   '#E97062',
  beatScript:    '#A8327E',
  connectScript: '#8470B5',
  amistadScript: '#7D8456',
} as const

// ─── Config por plantilla ─────────────────────────────────────────────────────

interface TplConfig {
  headerBg: string
  scriptColor: string
  footerTagline: string
  useScriptHeader: boolean
  descParas: string[]
}

const TPL_CFG: Record<Offering['template_code'], TplConfig> = {
  pulse: {
    headerBg: C.pulseHeader,
    scriptColor: C.pulseScript,
    footerTagline: 'Daring fermentations with precision and control.',
    useScriptHeader: true,

    descParas: [
      'Our most daring fermentations with precision and control.',
      'Coffees born from curiosity, experimentation and the wish to challenge the status quo.',
      'Here, we dive into the science of fermentation. Time, pH, temperature, stability; every variable becomes part of a living experiment that pushes flavor beyond expectations.',
      'These are the coffees that represent our craziest ideas, the ones that challenge even our own methods and assumptions.',
      'PULSE is the rapid heartbeat of experimentation: alive, bold, and unapologetically curious.',
    ],
  },
  beat: {
    headerBg: C.beatHeader,
    scriptColor: C.beatScript,
    footerTagline: 'Coffees crafted for competition.',
    useScriptHeader: false,

    descParas: [
      'Coffees crafted for competition.',
      "A heartbeat is proof of life. A steady, unmistakable signal that energy and intention are flowing. Our BEAT Series captures that same vitality; coffees designed for the world's most demanding stages.",
      'Rare lots. Exceptional precision. Processes shaped by season, terroir, and intuition.',
      "BEAT is our farm's purest rhythm. Unique, powerful, and unforgettable. The coffees that carry our heart into the world.",
    ],
  },
  connect: {
    headerBg: C.connectHeader,
    scriptColor: C.connectScript,
    footerTagline: 'Nature leads, we follow.',
    useScriptHeader: false,

    descParas: [
      'Fermentations guided by native microorganisms.',
      'Coffees that honor our connection to land, terroir, and time. These lots come from processes that have proven their harmony year after year.',
      'Profiles that respect the voice of the fruit and the wisdom of the land. Coffees that remind us why we began: to protect, to restore, and to celebrate origin.',
      'CONNECT is the quiet, steady heartbeat of our farm. Nature leading, and us following.',
    ],
  },
  amistad: {
    headerBg: C.amistadHeader,
    scriptColor: C.amistadScript,
    footerTagline: 'Coffees rooted in collaboration',
    useScriptHeader: false,

    descParas: [
      'La Amistad is not just a coffee program; it is a decade-long conversation.',
      'It represents the coffees rooted in collaboration with the small-scale growers—our neighbors—who believed in this project long before it made sense on paper.',
      'Today, La Amistad is a celebration of that shared risk and resilience. It is a series built on the belief that the most beautiful journeys are the ones we travel together.',
      'In every cup, you find more than just a flavor profile; you find the steady echo of a friendship at origin that has only grown deeper with time.',
    ],
  },
}

function getProgramDisplayName(code: Offering['template_code']): string {
  const map: Record<Offering['template_code'], string> = {
    pulse: 'PULSE',
    beat: 'BEAT',
    connect: 'CONNECT',
    amistad: 'LA AMISTAD',
  }
  return map[code]
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  // ── Página ──────────────────────────────────────────────────────────────────
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.cream,
    padding: 0,
    margin: 0,
  },

  // ══════════════════════════════════════
  // COVER
  // ══════════════════════════════════════
  coverTop: {
    backgroundColor: C.fucsia,
    flex: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 12,
  },
  coverBrand: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  // Lockup "FromTheheart"
  coverFthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  coverFthFrom: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 42,
    color: C.white,
    lineHeight: 1,
  },
  coverFthThe: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 28,
    color: C.white,
    lineHeight: 1,
    marginHorizontal: 2,
    paddingBottom: 3,
  },
  coverFthHeart: {
    fontFamily: 'Helvetica-BoldOblique',
    fontSize: 42,
    color: C.white,
    lineHeight: 1,
  },
  coverTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 36,
    color: 'rgba(255,200,220,0.72)',
    textAlign: 'center',
  },
  // Banda rosa
  coverBand: {
    height: 10,
    backgroundColor: C.rosaBand,
  },
  // Zona crema inferior
  coverBottom: {
    flex: 4,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingTop: 24,
    paddingBottom: 16,
  },
  coverTagline: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 20,
    color: C.fucsia,
    textAlign: 'center',
    lineHeight: 1.35,
  },
  coverFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  coverFooterItem: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: C.fucsia,
  },

  // ══════════════════════════════════════
  // DESCRIPCIÓN
  // ══════════════════════════════════════
  descContainer: {
    flex: 1,
    backgroundColor: C.cream,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 30,
    paddingBottom: 0,
  },
  // Logo PNG en página descripción (sobre fondo cream — usar versión sin filtro = el SVG negro)
  // Para PDF usamos el PNG cream porque react-pdf no soporta filtros CSS.
  // El PNG cream tiene el logo en color #F6F1E8 sobre transparente → lo ponemos sobre
  // el fondo cream con un tint de color del programa vía backgroundColor en el wrap.
  descLogoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  descLogoImg: {
    width: '55%',
    alignSelf: 'center',
  },
  descLogoImgFth: {
    width: '65%',
    alignSelf: 'center',
  },
  descPara: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: C.dark,
    textAlign: 'center',
    lineHeight: 1.55,
    marginBottom: 10,
  },
  descGradientBlock: {
    height: 18,
    marginTop: 'auto',
  },

  // ══════════════════════════════════════
  // FICHA — anatomía guía ML
  // ══════════════════════════════════════

  // Header: ~45% de la página
  fichaHeader: {
    flex: 45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },

  // Logo PNG cream — reemplaza el lockup tipográfico Pulse / From The heart
  fichaLogoHeader: {
    width: '55%',
    alignSelf: 'center',
    marginBottom: 12,
  },

  // Logo más pequeño para variantes FTH (más ancho visual)
  fichaLogoHeaderFth: {
    width: '60%',
    alignSelf: 'center',
    marginBottom: 12,
  },

  /* fichaMeta eliminado — Microlot/Terroir se movieron al grid del body */

  // ── Grid 2×4 — 7 celdas (reemplaza tabla 5×2) ──────────────────────────────
  fichaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    borderWidth: 1,
    borderColor: C.tableBorder,
    borderStyle: 'solid',
  },
  fichaGridCell: {
    width: '50%',
    flexDirection: 'column',
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
    borderBottomStyle: 'solid',
  },
  fichaGridCellFull: {
    width: '100%',
    flexDirection: 'column',
    borderBottomWidth: 0,
  },
  fichaGridLabel: {
    backgroundColor: C.labelMagenta,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaGridLabelText: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: C.white,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  fichaGridValue: {
    backgroundColor: C.white,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  fichaGridValueNotes: {
    minHeight: 48,
    justifyContent: 'flex-start',
  },
  fichaGridValueText: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.dark,
    lineHeight: 1.35,
  },
  fichaGridValueEmpty: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 8,
    color: '#858D9A',
    lineHeight: 1.35,
  },

  // Stripe divider — hot-pink sólida, 12px
  fichaBand: {
    height: 12,
    backgroundColor: C.tableBorder,   // #E91E83
  },

  // Imagery band — rosa pétalos (bloque sólido aproximado)
  fichaFloral: {
    height: 18,
    backgroundColor: '#FCE5EC',
  },

  // Cuerpo con tabla
  fichaBody: {
    flex: 1,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  // Tabla
  fichaTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.tableBorder,
    borderStyle: 'solid',
  },

  // Fila con borde inferior hot-pink
  fichaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
    borderBottomStyle: 'solid',
  },
  fichaRowLast: {
    flexDirection: 'row',
  },

  // Columna label — 40%, magenta #B8004C
  fichaCellLabel: {
    width: '40%',
    backgroundColor: C.labelMagenta,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
    borderRightStyle: 'solid',
  },
  fichaCellLabelText: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.white,
    textAlign: 'center',
    lineHeight: 1.3,
  },

  // Columna valor — 60%, blanco
  fichaCellValue: {
    flex: 1,
    backgroundColor: C.white,
    paddingVertical: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  fichaCellValueText: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: C.dark,
    lineHeight: 1.35,
  },

  // Bottom bar — tagline #F36AAB, texto negro Inter
  fichaFooter: {
    height: 26,
    backgroundColor: C.bottomBar,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  fichaFooterText: {
    fontFamily: 'Helvetica',
    fontSize: 8.5,
    color: '#000000',
    textAlign: 'center',
  },

  // ══════════════════════════════════════
  // TABLA RESUMEN (reemplaza N fichas)
  // ══════════════════════════════════════

  // Cuerpo de la página tabla
  tableBody: {
    flex: 1,
    backgroundColor: C.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  // Contenedor exterior de la tabla — borde izquierdo + superior
  tableOuter: {
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: C.tableBorder,
    borderTopStyle: 'solid',
    borderLeftWidth: 1,
    borderLeftColor: C.tableBorder,
    borderLeftStyle: 'solid',
  },

  // Fila genérica
  tableRow: {
    flexDirection: 'row',
  },

  // Celda header (fila 0)
  tableHeaderCell: {
    backgroundColor: C.labelMagenta,
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
    borderBottomStyle: 'solid',
    paddingVertical: 7,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableHeaderText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: C.white,
    textAlign: 'center',
    lineHeight: 1.2,
  },

  // Celda número de fila (col 0 en filas de datos)
  tableNumCell: {
    backgroundColor: C.labelMagenta,
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
    borderBottomStyle: 'solid',
    width: 22,
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableNumText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: C.white,
    textAlign: 'center',
  },

  // Celda de dato estándar
  tableDataCell: {
    backgroundColor: C.white,
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
    borderRightStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
    borderBottomStyle: 'solid',
    minHeight: 24,
    paddingVertical: 5,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  tableDataText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: C.dark,
    lineHeight: 1.3,
  },
  tableDataEmpty: {
    fontFamily: 'Helvetica-Oblique',
    fontSize: 7,
    color: '#c0c0c0',
  },
})

// ─── Documento PDF ────────────────────────────────────────────────────────────

export function OfferingPDF({ offering }: { offering: Offering }) {
  const cfg = TPL_CFG[offering.template_code]
  const programName = getProgramDisplayName(offering.template_code)
  const coverTitle = offering.title || 'Offering List'
  const coverTagline = offering.cover_message || 'From the Heart is how we move forward.'

  return (
    <Document
      title={`Offering List — ${programName} — ${coverTitle}`}
      author="La Palma y El Tucán"
      creator="Café Trazabilidad LP&ET"
    >
      {/* ── COVER ──────────────────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        {/* Zona fucsia */}
        <View style={S.coverTop}>
          <Text style={S.coverBrand}>LA PALMA &amp; EL TUCÁN</Text>
          <View style={S.coverFthRow}>
            <Text style={S.coverFthFrom}>From</Text>
            <Text style={S.coverFthThe}> The </Text>
            <Text style={S.coverFthHeart}>heart</Text>
          </View>
          <Text style={S.coverTitle}>{coverTitle}</Text>
        </View>

        {/* Banda rosa */}
        <View style={S.coverBand} />

        {/* Zona crema */}
        <View style={S.coverBottom}>
          <Text style={S.coverTagline}>{coverTagline}</Text>
          <View style={S.coverFooterRow}>
            <Text style={S.coverFooterItem}>@lapalmayeltucan</Text>
            <Text style={S.coverFooterItem}>lapalmayeltucan.com</Text>
          </View>
        </View>
      </Page>

      {/* ── DESCRIPCIÓN ──────────────────────────────────────────────────── */}
      <Page size="A4" style={[S.page, { flexDirection: 'column' }]}>
        <View style={S.descContainer}>
          {/* Logo PNG cream del programa */}
          <View style={S.descLogoWrap}>
            <Image
              src={LOGO_PNG[offering.template_code]}
              style={offering.template_code === 'pulse' ? S.descLogoImg : S.descLogoImgFth}
            />
          </View>

          {/* Párrafos */}
          {cfg.descParas.map((para, i) => (
            <Text key={i} style={S.descPara}>{para}</Text>
          ))}

          <View style={S.descGradientBlock} />
        </View>
      </Page>

      {/* ── TABLA RESUMEN — 1 página con 8 filas ────────────────────────── */}
      <Page size="A4" style={[S.page, { flexDirection: 'column' }]}>
        {/* 1. Header colored block */}
        <View style={[S.fichaHeader, { backgroundColor: cfg.headerBg }]}>
          <Image
            src={LOGO_PNG[offering.template_code]}
            style={offering.template_code === 'pulse' ? S.fichaLogoHeader : S.fichaLogoHeaderFth}
          />
        </View>

        {/* 2. Stripe divider — hot-pink 12px */}
        <View style={S.fichaBand} />

        {/* 3. Imagery band */}
        <View style={S.fichaFloral} />

        {/* 4. Body con tabla resumen */}
        <View style={S.tableBody}>
          <View style={S.tableOuter}>

            {/* Fila header de la tabla */}
            <View style={S.tableRow}>
              {/* Col # */}
              <View style={[S.tableHeaderCell, { width: 22 }]}>
                <Text style={S.tableHeaderText}>#</Text>
              </View>
              {/* Col Variedad — flex 2 */}
              <View style={[S.tableHeaderCell, { flex: 2 }]}>
                <Text style={S.tableHeaderText}>Variedad</Text>
              </View>
              {/* Col Proceso — flex 2 */}
              <View style={[S.tableHeaderCell, { flex: 2 }]}>
                <Text style={S.tableHeaderText}>Proceso</Text>
              </View>
              {/* Col Notas catación — flex 3 */}
              <View style={[S.tableHeaderCell, { flex: 3 }]}>
                <Text style={S.tableHeaderText}>Notas de catación</Text>
              </View>
              {/* Col Cantidad — flex 1.5 */}
              <View style={[S.tableHeaderCell, { flex: 1.5 }]}>
                <Text style={S.tableHeaderText}>Cantidad</Text>
              </View>
              {/* Col Precios — flex 1.5, sin borde derecho (ya lo cierra tableOuter) */}
              <View style={[S.tableHeaderCell, { flex: 1.5, borderRightWidth: 0 }]}>
                <Text style={S.tableHeaderText}>Precios</Text>
              </View>
            </View>

            {/* Filas dinámicas — una por muestra (2-8) */}
            {offering.samples.map((s: OfferingSample, i: number) => {
              const variety      = s.variety       ?? ''
              const process      = s.process       ?? ''
              const tastingNotes = s.tasting_notes ?? ''
              const cantidad     = s.availability_kg && s.availability_kg > 0
                ? `${s.availability_kg.toFixed(1)} kg`
                : ''
              const precio       = s.price_usd_per_lb && s.price_usd_per_lb > 0
                ? `$${s.price_usd_per_lb.toFixed(2)}/lb`
                : ''

              return (
                <View key={s.bache_code ?? i} style={S.tableRow}>
                  {/* Número */}
                  <View style={S.tableNumCell}>
                    <Text style={S.tableNumText}>{i + 1}</Text>
                  </View>
                  {/* Variedad */}
                  <View style={[S.tableDataCell, { flex: 2 }]}>
                    <Text style={variety ? S.tableDataText : S.tableDataEmpty}>{variety}</Text>
                  </View>
                  {/* Proceso */}
                  <View style={[S.tableDataCell, { flex: 2 }]}>
                    <Text style={process ? S.tableDataText : S.tableDataEmpty}>{process}</Text>
                  </View>
                  {/* Notas catación */}
                  <View style={[S.tableDataCell, { flex: 3 }]}>
                    <Text style={tastingNotes ? S.tableDataText : S.tableDataEmpty}>{tastingNotes}</Text>
                  </View>
                  {/* Cantidad */}
                  <View style={[S.tableDataCell, { flex: 1.5 }]}>
                    <Text style={cantidad ? S.tableDataText : S.tableDataEmpty}>{cantidad}</Text>
                  </View>
                  {/* Precios — sin borde derecho */}
                  <View style={[S.tableDataCell, { flex: 1.5, borderRightWidth: 0 }]}>
                    <Text style={precio ? S.tableDataText : S.tableDataEmpty}>{precio}</Text>
                  </View>
                </View>
              )
            })}

          </View>
        </View>

        {/* 5. Bottom bar — tagline */}
        <View style={S.fichaFooter}>
          <Text style={S.fichaFooterText}>{cfg.footerTagline}</Text>
        </View>
      </Page>
    </Document>
  )
}

// ─── Botón de descarga ─────────────────────────────────────────────────────────

interface DownloadButtonProps {
  offering: Offering
  className?: string
  children?: React.ReactNode
}

export function OfferingDownloadButton({
  offering,
  className,
  children,
}: DownloadButtonProps) {
  const programName = getProgramDisplayName(offering.template_code)
  const filename = `offering-list-${programName.toLowerCase().replace(/\s+/g, '-')}-${
    offering.title
      ? offering.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)
      : 'draft'
  }.pdf`

  async function handleDownload() {
    try {
      const blob = await pdf(<OfferingPDF offering={offering} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error generando PDF Offering:', err)
      alert('No se pudo generar el PDF. Revisa la consola para detalles.')
    }
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => void handleDownload()}
      aria-label={`Descargar PDF Offering List — ${programName}`}
    >
      {children ?? 'Generar PDF'}
    </button>
  )
}
