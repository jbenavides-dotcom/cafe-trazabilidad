/**
 * OfferingPreview.tsx
 *
 * Vista previa HTML del Offering List, replicando pixel-perfect el PDF original
 * de 9 páginas (La Palma y El Tucán, "From The Heart").
 *
 * Estructura generada por offering:
 *   1 × Cover page
 *   1 × Descripción del programa (Pulse / Beat / Connect / La Amistad)
 *   N × Ficha por muestra (una por sample en el offering)
 *
 * Notas de diseño:
 *   - Pulse: header coral #FF7A6E + script caligráfico "Pulse" (Pinyon Script)
 *   - Beat/Connect/Amistad: header en color del programa + lockup "From The heart"
 *     tipográfico (Playfair Display, NO el nombre en script)
 *   - Tabla ficha: label izquierda magenta #B30055 / valor blanco
 *   - Pulse usa labels EN, resto usa labels ES
 *   - Scripts cursivos: Pinyon Script como aproximación (los originales son
 *     fuentes propietarias de La Palma, no disponibles en Google Fonts)
 */

import './OfferingPreview.css'
import type { ProgramTemplate, OfferingSample } from '../types/fichas'

// ─── Mapa de logos reales ──────────────────────────────────────────────────────

// Cada plantilla usa SU PROPIO logo script
const LOGO_BY_VARIANT: Record<ProgramTemplate['code'], { svg: string; alt: string }> = {
  pulse:   { svg: 'pulse.svg',   alt: 'Pulse' },
  beat:    { svg: 'beat.svg',    alt: 'Beat' },
  connect: { svg: 'connect.svg', alt: 'Connect' },
  amistad: { svg: 'amistad.svg', alt: 'La Amistad' },
}

function Logo({
  templateCode,
  variant = 'header',
}: {
  templateCode: ProgramTemplate['code']
  variant?: 'header' | 'cover' | 'desc'
}) {
  const cfg = LOGO_BY_VARIANT[templateCode] ?? LOGO_BY_VARIANT.beat
  const url = `${import.meta.env.BASE_URL}logos/${cfg.svg}`
  return (
    <img
      src={url}
      alt={cfg.alt}
      className={`ml-logo ml-logo-${templateCode} ml-logo-${variant}`}
    />
  )
}

// ─── Tipos de props ────────────────────────────────────────────────────────────

interface RecipientPreview {
  name: string
  email: string
  company?: string
  country?: string
}

export interface OfferingPreviewProps {
  templateCode: ProgramTemplate['code'] | null
  title: string
  coverMessage: string
  samples: OfferingSample[]
  recipients: RecipientPreview[]
  minSamples?: number
}

// ─── Configuración por plantilla ──────────────────────────────────────────────

interface TemplateConfig {
  headerBg: string
  scriptColor: string
  gradientCss: string
  footerTagline: string
  useScriptHeader: boolean  // true=Pulse (script en header ficha), false=FromTheHeart
  descriptionParas: string[]
}

const TEMPLATE_CONFIGS: Record<ProgramTemplate['code'], TemplateConfig> = {
  pulse: {
    headerBg: '#E97062',
    scriptColor: '#E97062',
    gradientCss: 'linear-gradient(180deg, #E97062 0%, #FF8FB7 100%)',
    footerTagline: 'Daring fermentations with precision and control.',
    useScriptHeader: true,

    descriptionParas: [
      'Our most daring fermentations with precision and control.',
      'Coffees born from curiosity, experimentation and the wish to challenge the status quo.',
      'Here, we dive into the science of fermentation. Time, pH, temperature, stability; every variable becomes part of a living experiment that pushes flavor beyond expectations.',
      'These are the coffees that represent our craziest ideas, the ones that challenge even our own methods and assumptions.',
      'PULSE is the rapid heartbeat of experimentation: alive, bold, and unapologetically curious.',
    ],
  },
  beat: {
    headerBg: '#A8327E',
    scriptColor: '#C71585',
    gradientCss: 'linear-gradient(180deg, #A8327E 0%, #FF8FB7 100%)',
    footerTagline: 'Coffees crafted for competition.',
    useScriptHeader: false,

    descriptionParas: [
      'Coffees crafted for competition.',
      'A heartbeat is proof of life. A steady, unmistakable signal that energy and intention are flowing. Our BEAT Series captures that same vitality; coffees designed for the world\'s most demanding stages.',
      'Rare lots. Exceptional precision. Processes shaped by season, terroir, and intuition. Coffees that appear only when everything aligns: the land, the fruit, the science, and the hands behind them.',
      'BEAT is our farm\'s purest rhythm. Unique, powerful, and unforgettable. The coffees that carry our heart into the world.',
    ],
  },
  connect: {
    headerBg: '#8470B5',
    scriptColor: '#8470B5',
    gradientCss: 'linear-gradient(180deg, #8470B5 0%, #FF8FB7 100%)',
    footerTagline: 'Nature leads, we follow.',
    useScriptHeader: false,

    descriptionParas: [
      'Fermentations guided by native microorganisms.',
      'Coffees that honor our connection to land, terroir, and time. These lots come from processes that have proven their harmony year after year. Stable, expressive, and deeply rooted in the biodiversity of our ecosystem.',
      'Profiles that respect the voice of the fruit and the wisdom of the land. Coffees that remind us why we began: to protect, to restore, and to celebrate origin.',
      'CONNECT is the quiet, steady heartbeat of our farm. Nature leading, and us following.',
    ],
  },
  amistad: {
    headerBg: '#7D8456',
    scriptColor: '#7D8456',
    gradientCss: 'linear-gradient(180deg, #7D8456 0%, #F7DDE0 100%)',
    footerTagline: 'Coffees rooted in collaboration',
    useScriptHeader: false,

    descriptionParas: [
      'La Amistad is not just a coffee program; it is a decade-long conversation.',
      'It represents the coffees rooted in collaboration with the small-scale growers—our neighbors—who believed in this project long before it made sense on paper.',
      'Today, La Amistad is a celebration of that shared risk and resilience. It is a series built on the belief that the most beautiful journeys are the ones we travel together.',
      'In every cup, you find more than just a flavor profile; you find the steady echo of a friendship at origin that has only grown deeper with time.',
    ],
  },
}

// Variante CSS por código de plantilla
const VARIANT_CLASS: Record<ProgramTemplate['code'], string> = {
  pulse:   'v-pulse',
  beat:    'v-beat',
  connect: 'v-connect',
  amistad: 'v-amistad',
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function OfferingPreview({
  templateCode,
  title,
  coverMessage,
  samples,
}: OfferingPreviewProps) {

  if (!templateCode) {
    return (
      <div className="op-wrap">
        <div className="op-label">Vista previa del cliente</div>
        <div className="op-empty">
          <div className="op-empty-inner">
            <div className="op-empty-icon">◻</div>
            <div className="op-empty-text">Selecciona una plantilla para ver la vista previa</div>
          </div>
        </div>
      </div>
    )
  }

  const cfg = TEMPLATE_CONFIGS[templateCode]
  const coverTitle = title || 'Offering List'
  const coverTag = coverMessage || 'From the Heart is how we move forward.'

  return (
    <div className="op-wrap">
      <div className="op-label">Vista previa del cliente</div>
      <div className="op-pages">

        {/* ── 1. Cover ─────────────────────────────────────────────────────── */}
        <CoverPage title={coverTitle} tagline={coverTag} />

        {/* ── 2. Descripción del programa ──────────────────────────────────── */}
        <DescriptionPage cfg={cfg} templateCode={templateCode} />

        {/* ── 3. Tabla resumen — 1 página con 8 filas ─────────────────────── */}
        <TableSummaryPage
          cfg={cfg}
          templateCode={templateCode}
          samples={samples}
        />

      </div>
    </div>
  )
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function CoverPage({ title, tagline }: { title: string; tagline: string }) {
  return (
    <div className="op-page op-cover">
      {/* Zona fucsia superior */}
      <div className="op-cover-top">
        <div className="op-cover-brand">LA PALMA &amp; EL TUCÁN</div>

        {/* Lockup "FromTheheart" */}
        <div className="op-cover-from-the-heart">
          <span className="op-cover-fth-from">From</span>
          <span className="op-cover-fth-the">The</span>
          <span className="op-cover-fth-heart">heart</span>
        </div>

        {/* "Offering List" semitransparente */}
        <div className="op-cover-title">{title}</div>
      </div>

      {/* Banda rosa */}
      <div className="op-cover-band" />

      {/* Zona crema inferior */}
      <div className="op-cover-bottom">
        <div className="op-cover-tagline">{tagline}</div>
        <div className="op-cover-footer">
          <span className="op-cover-footer-item">@lapalmayeltucan</span>
          <span className="op-cover-footer-item">lapalmayeltucan.com</span>
        </div>
      </div>
    </div>
  )
}

// ─── Description Page ─────────────────────────────────────────────────────────

function DescriptionPage({
  cfg,
  templateCode,
}: {
  cfg: TemplateConfig
  templateCode: ProgramTemplate['code']
}) {
  return (
    <div className="op-page op-desc">
      <div className="op-desc-inner">
        {/* Logo real del programa */}
        <div className="op-desc-logo-wrap" style={{ '--script-color': cfg.scriptColor } as React.CSSProperties}>
          <Logo templateCode={templateCode} variant="desc" />
        </div>

        {/* Párrafos */}
        {cfg.descriptionParas.map((para, i) => (
          <p key={i} className="op-desc-para">{para}</p>
        ))}
      </div>

      {/* Gradient inferior */}
      <div
        className="op-desc-gradient"
        style={{ background: cfg.gradientCss }}
      />
    </div>
  )
}

// ─── Table Summary Page ──────────────────────────────────────────────────────

const TABLE_HEADERS = ['#', 'Variedad', 'Proceso', 'Notas de catación', 'Cantidad', 'Precios']

function TableSummaryPage({
  cfg,
  templateCode,
  samples,
}: {
  cfg: TemplateConfig
  templateCode: ProgramTemplate['code']
  samples: OfferingSample[]
}) {
  const variantClass = VARIANT_CLASS[templateCode]

  return (
    <article className={`op-page ml-card ${variantClass}`}>
      {/* ── 1. Header colored block ────────────────────────────────────────── */}
      <header className="ml-header">
        <Logo templateCode={templateCode} variant="header" />
      </header>

      {/* ── 2. Stripe divider — hot-pink ─────────────────────────────────── */}
      <div className="ml-stripe" />

      {/* ── 3. Imagery band — gradiente pétalos ─────────────────────────── */}
      <div className="ml-imagery" />

      {/* ── 4. Body con tabla resumen ────────────────────────────────────── */}
      <div className="ml-summary-table-wrap">
        <table className="ml-summary-table">
          <thead>
            <tr>
              {TABLE_HEADERS.map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((s, i) => (
              <tr key={s.bache_code ?? i}>
                <td className="row-num">{i + 1}</td>
                <td className={!s.variety ? 'empty' : ''}>{s.variety ?? ''}</td>
                <td className={!s.process ? 'empty' : ''}>{s.process ?? ''}</td>
                <td className={!s.tasting_notes ? 'empty' : ''}>{s.tasting_notes ?? ''}</td>
                <td className={!(s.availability_kg && s.availability_kg > 0) ? 'empty' : ''}>
                  {s.availability_kg && s.availability_kg > 0 ? `${s.availability_kg.toFixed(1)} kg` : ''}
                </td>
                <td className={!(s.price_usd_per_lb && s.price_usd_per_lb > 0) ? 'empty' : ''}>
                  {s.price_usd_per_lb && s.price_usd_per_lb > 0 ? `$${s.price_usd_per_lb.toFixed(2)}/lb` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── 5. Bottom bar — tagline ──────────────────────────────────────── */}
      <footer className="ml-tagline">{cfg.footerTagline}</footer>
    </article>
  )
}

