/**
 * TripToOriginPDF.tsx
 *
 * PDF print-ready para Trip to Origin. 5 páginas A4 vertical.
 *
 * Paleta:
 *   fuchsia:   #E91E84  (fondo páginas 1, 2-top, 3, 4)
 *   magentaDark: #A1054C (Welcome gigante, chips de fecha, footer text)
 *   pinkLight:  #F8A6C7 (nombre cliente en cover)
 *   pinkFooter: #F2C4D8 (banda footer)
 *   cream:      #FAF6EE (fondo p2-bottom y p5)
 *   white:      #FFFFFF
 *
 * Tipografía: Helvetica nativa (react-pdf no acepta .woff2 de Google).
 * Las cursivas de Playfair se simulan con Helvetica-Oblique.
 */

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { TripToOrigin, TripDay, TripScheduleItem } from '../../types/fichas'

// ─── Deshabilitar hyphenation ──────────────────────────────────────────────────
Font.registerHyphenationCallback(word => [word])

// ─── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  fuchsia: '#E91E84',
  magentaDark: '#A1054C',
  pinkLight: '#F8A6C7',
  pinkFooter: '#F2C4D8',
  cream: '#FAF6EE',
  white: '#FFFFFF',
  dark: '#2C2D2E',
  semiWhite: 'rgba(255,255,255,0.88)',
} as const

// ─── Estilos compartidos ──────────────────────────────────────────────────────
const shared = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    flexDirection: 'column',
  },
  // Footer banda rosa
  footer: {
    backgroundColor: C.pinkFooter,
    paddingVertical: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: C.magentaDark,
    fontWeight: 500,
  },
  // Logo "LA PALMA & EL TUCÁN" pequeño
  logoBrand: {
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    letterSpacing: 2,
    color: C.white,
  },
  // Logo "From The Heart" grande
  logoMain: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 18,
    color: C.white,
    lineHeight: 1,
  },
})

// ─── Página 1: Cover fucsia ───────────────────────────────────────────────────
function Page1Cover({ doc }: { doc: TripToOrigin }) {
  return (
    <Page size="A4" style={[shared.page, { backgroundColor: C.fuchsia, justifyContent: 'space-between' }]}>
      {/* Body centrado */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 10 }}>
          <Text style={shared.logoBrand}>LA PALMA &amp; EL TUCAN</Text>
          <Text style={shared.logoMain}>From The Heart</Text>
        </View>

        {/* Etiqueta itinerario */}
        <Text style={{ fontFamily: 'Helvetica', fontSize: 10, color: C.white, textAlign: 'center', lineHeight: 1.5 }}>
          This Itinerary is specially prepared for:
        </Text>

        {/* Nombre del cliente */}
        <Text style={{
          fontFamily: 'Helvetica-BoldOblique',
          fontSize: 26,
          color: C.pinkLight,
          textAlign: 'center',
          lineHeight: 1.2,
          marginTop: 4,
          marginBottom: 16,
        }}>
          {doc.client_name || 'Your Name'}
        </Text>

        {/* Tagline */}
        <Text style={{
          fontFamily: 'Helvetica-Oblique',
          fontSize: 12,
          color: C.white,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          "Some say coffee is for the soul."
        </Text>
      </View>

      {/* Footer */}
      <View style={shared.footer}>
        <Text style={shared.footerText}>@lapalmayeltucan</Text>
        <Text style={shared.footerText}>lapalmayeltucan.com</Text>
      </View>
    </Page>
  )
}

// ─── Página 2: Welcome ────────────────────────────────────────────────────────
function Page2Welcome({ doc }: { doc: TripToOrigin }) {
  const para0 = doc.welcome_text_paragraphs[0] ?? ''
  const para1 = doc.welcome_text_paragraphs[1] ?? ''

  return (
    <Page size="A4" style={[shared.page, { backgroundColor: C.fuchsia }]}>
      {/* Top 60% — fucsia */}
      <View style={{ flex: 0.6, padding: 32, backgroundColor: C.fuchsia }}>
        <Text style={{ fontFamily: 'Helvetica', fontSize: 7, letterSpacing: 2, color: C.white, marginBottom: 8 }}>
          LA PALMA &amp; EL TUCAN
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 11, color: C.white, marginBottom: 4, lineHeight: 1.4 }}>
          "We think coffee is from the soul."
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 52, color: C.magentaDark, lineHeight: 1, marginBottom: 14 }}>
          Welcome
        </Text>
        {para0 ? (
          <Text style={{ fontFamily: 'Helvetica', fontSize: 10, color: C.white, lineHeight: 1.55, marginBottom: 8 }}>
            {para0}
          </Text>
        ) : null}
        {para1 ? (
          <Text style={{ fontFamily: 'Helvetica', fontSize: 10, color: C.white, lineHeight: 1.55 }}>
            {para1}
          </Text>
        ) : null}
      </View>

      {/* Bottom 40% — crema */}
      <View style={{ flex: 0.4, padding: 32, backgroundColor: C.cream, justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.magentaDark, letterSpacing: 1, marginBottom: 6 }}>
          DATE OF YOUR TRIP
        </Text>
        <Text style={{ fontFamily: 'Helvetica-BoldOblique', fontSize: 18, color: C.magentaDark, lineHeight: 1.2 }}>
          {doc.trip_date || '—'}
        </Text>
      </View>
    </Page>
  )
}

// ─── Páginas de días (3 y 4) ──────────────────────────────────────────────────

function DayCard({ day }: { day: TripDay }) {
  const visibleItems = day.schedule.slice(0, 6)

  return (
    <View style={{
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      borderStyle: 'solid',
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
    }}>
      {/* Pill día */}
      <View style={{
        alignSelf: 'flex-start',
        backgroundColor: C.white,
        borderRadius: 16,
        paddingVertical: 3,
        paddingHorizontal: 10,
        marginBottom: 6,
      }}>
        <Text style={{ fontFamily: 'Helvetica-BoldOblique', fontSize: 8, color: C.fuchsia }}>
          Day {day.day_number}: {day.title}
        </Text>
      </View>

      {/* Chip fecha */}
      {day.date ? (
        <View style={{
          alignSelf: 'flex-start',
          backgroundColor: C.magentaDark,
          borderRadius: 10,
          paddingVertical: 2,
          paddingHorizontal: 8,
          marginBottom: 8,
        }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.white, letterSpacing: 0.5 }}>
            {day.date}
          </Text>
        </View>
      ) : null}

      {/* Timeline items */}
      {visibleItems.map((item: TripScheduleItem, idx: number) => (
        <View key={idx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, gap: 5 }}>
          {item.time ? (
            <View style={{
              backgroundColor: C.white,
              borderRadius: 8,
              paddingVertical: 2,
              paddingHorizontal: 5,
              flexShrink: 0,
            }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7, color: C.fuchsia }}>
                {item.time}
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.white, lineHeight: 1.35 }}>
              {item.activity}
            </Text>
            {item.description ? (
              <Text style={{ fontFamily: 'Helvetica', fontSize: 7, color: 'rgba(255,255,255,0.78)', lineHeight: 1.3 }}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>
      ))}

      {day.schedule.length > 6 ? (
        <Text style={{ fontFamily: 'Helvetica', fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
          +{day.schedule.length - 6} more activities…
        </Text>
      ) : null}
    </View>
  )
}

function PageDays({ days, label }: { days: TripDay[]; label: string }) {
  return (
    <Page size="A4" style={[shared.page, { backgroundColor: C.fuchsia, justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, padding: 28 }}>
        {/* Pill "OUR COFFEE JOURNEY" */}
        <View style={{
          alignSelf: 'flex-start',
          backgroundColor: C.white,
          borderRadius: 20,
          paddingVertical: 4,
          paddingHorizontal: 14,
          marginBottom: 10,
        }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.fuchsia, letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {label}
          </Text>
        </View>

        {/* Título */}
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 32, color: C.white, lineHeight: 1.05, marginBottom: 8 }}>
          Trip to Origin
        </Text>

        {/* Subtítulo */}
        <Text style={{ fontFamily: 'Helvetica', fontSize: 9, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5, marginBottom: 14 }}>
          We invite you to look beyond the surface and discover the story behind every cup.
        </Text>

        {/* Cards de días */}
        {days.map(d => (
          <DayCard key={d.day_number} day={d} />
        ))}
      </View>

      {/* Footer */}
      <View style={shared.footer}>
        <Text style={shared.footerText}>@lapalmayeltucan</Text>
        <Text style={shared.footerText}>lapalmayeltucan.com</Text>
      </View>
    </Page>
  )
}

// ─── Página 5: Closing ────────────────────────────────────────────────────────
function Page5Closing({ doc }: { doc: TripToOrigin }) {
  return (
    <Page size="A4" style={[shared.page, { backgroundColor: C.cream, justifyContent: 'space-between' }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 20 }}>
        {/* Texto de cierre */}
        {doc.closing_text ? (
          <Text style={{
            fontFamily: 'Helvetica',
            fontSize: 12,
            color: C.dark,
            textAlign: 'center',
            lineHeight: 1.65,
            maxWidth: 360,
          }}>
            {doc.closing_text}
          </Text>
        ) : null}

        {/* See you soon */}
        <Text style={{
          fontFamily: 'Helvetica-BoldOblique',
          fontSize: 24,
          color: C.fuchsia,
          textAlign: 'center',
        }}>
          See you very soon!
        </Text>

        {/* Logo en fucsia */}
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Text style={{ fontFamily: 'Helvetica', fontSize: 7, letterSpacing: 2, color: C.fuchsia, marginBottom: 2 }}>
            LA PALMA &amp; EL TUCAN
          </Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 22, color: C.fuchsia, lineHeight: 1 }}>
            From The Heart
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[shared.footer, { backgroundColor: C.pinkFooter }]}>
        <Text style={shared.footerText}>@lapalmayeltucan</Text>
        <Text style={shared.footerText}>lapalmayeltucan.com</Text>
      </View>
    </Page>
  )
}

// ─── Documento PDF completo ───────────────────────────────────────────────────
export function TripToOriginPDF({ doc }: { doc: TripToOrigin }) {
  // Día 1 va en página 3; días 2+ van en página 4
  const day1 = doc.days[0] ?? null
  const daysRest = doc.days.slice(1)

  return (
    <Document
      title={`Trip to Origin — ${doc.client_name || 'Guest'}`}
      author="La Palma y El Tucán"
      creator="Café Trazabilidad LP&ET"
    >
      <Page1Cover doc={doc} />
      <Page2Welcome doc={doc} />

      {/* Página 3: Día 1 (o placeholder si no hay días) */}
      <PageDays
        days={day1 ? [day1] : []}
        label="OUR COFFEE JOURNEY"
      />

      {/* Página 4: Días 2+ (o placeholder) */}
      <PageDays
        days={daysRest.length > 0 ? daysRest : []}
        label="COFFEE JOURNEY"
      />

      <Page5Closing doc={doc} />
    </Document>
  )
}
