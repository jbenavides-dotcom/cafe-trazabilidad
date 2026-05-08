/**
 * TripToOriginDoc.tsx
 *
 * Componente split-screen 40/60 para crear y previsualizar un Trip to Origin.
 * Izquierda: formulario con secciones Client info · Trip date · Welcome paragraphs
 *            · Days (add/remove day y schedule items) · Closing text
 * Derecha: preview sticky con las 5 páginas apiladas (aspect-ratio 9:16 c/u)
 *
 * Patrón idéntico a OrderConfirmationDoc y ShippingDoc.
 */

import { useState } from 'react'
import './TripToOriginDoc.css'
import type { TripToOrigin, TripDay, TripScheduleItem } from '../types/fichas'
import { TripToOriginPDF } from './pdf/TripToOriginPDF'
import { pdf } from '@react-pdf/renderer'
import { saveTrip } from '../lib/fichas'

// ─── Playfair Display via @import para el preview HTML ────────────────────────

const PLAYFAIR_IMPORT = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&display=swap');
`

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  doc: TripToOrigin
  onChange: (updated: TripToOrigin) => void
  onSaveDraft: () => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TripToOriginDoc({ doc, onChange, onSaveDraft }: Props) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  function patch(updates: Partial<TripToOrigin>) {
    onChange({ ...doc, ...updates })
  }

  // Welcome paragraphs
  function patchParagraph(idx: number, value: string) {
    const paras = [...doc.welcome_text_paragraphs]
    paras[idx] = value
    patch({ welcome_text_paragraphs: paras })
  }

  // Days CRUD
  function addDay() {
    const nextNum = doc.days.length + 1
    const newDay: TripDay = {
      day_number: nextNum,
      title: '',
      date: '',
      schedule: [{ time: '', activity: '', description: '' }],
    }
    patch({ days: [...doc.days, newDay] })
  }

  function removeDay(idx: number) {
    const days = doc.days.filter((_, i) => i !== idx).map((d, i) => ({
      ...d,
      day_number: i + 1,
    }))
    patch({ days })
  }

  function patchDay(idx: number, field: keyof TripDay, value: string | number | TripScheduleItem[]) {
    const days = doc.days.map((d, i) =>
      i === idx ? { ...d, [field]: value } : d
    )
    patch({ days })
  }

  // Schedule CRUD
  function addScheduleItem(dayIdx: number) {
    const days = doc.days.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        schedule: [...d.schedule, { time: '', activity: '', description: '' }],
      }
    })
    patch({ days })
  }

  function removeScheduleItem(dayIdx: number, itemIdx: number) {
    const days = doc.days.map((d, i) => {
      if (i !== dayIdx) return d
      return {
        ...d,
        schedule: d.schedule.filter((_, si) => si !== itemIdx),
      }
    })
    patch({ days })
  }

  function patchScheduleItem(
    dayIdx: number,
    itemIdx: number,
    field: keyof TripScheduleItem,
    value: string
  ) {
    const days = doc.days.map((d, i) => {
      if (i !== dayIdx) return d
      const schedule = d.schedule.map((s, si) =>
        si === itemIdx ? { ...s, [field]: value } : s
      )
      return { ...d, schedule }
    })
    patch({ days })
  }

  async function handleGeneratePDF() {
    setSaving(true)
    setSaveError(null)
    try {
      // Guardar en LS + Supabase antes de generar
      await saveTrip(doc)

      const filename = doc.client_name
        ? `trip-to-origin-${doc.client_name.replace(/\s+/g, '-').toLowerCase()}.pdf`
        : 'trip-to-origin.pdf'
      const blob = await pdf(<TripToOriginPDF doc={doc} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error generando PDF')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Inyectar Playfair Display para el preview HTML */}
      <style>{PLAYFAIR_IMPORT}</style>

      <div className="tto-split">
        {/* ── Formulario izquierda ── */}
        <div className="tto-form">
          <div className="tto-form-title">Trip to Origin</div>

          {/* Client info */}
          <div className="tto-group-title">Client Info</div>
          <div className="field">
            <label>Client Name</label>
            <input
              value={doc.client_name}
              onChange={e => patch({ client_name: e.target.value })}
              placeholder="Miho Haru"
            />
          </div>
          <div className="tto-row-2">
            <div className="field">
              <label>Email (opcional)</label>
              <input
                type="email"
                value={doc.client_email ?? ''}
                onChange={e => patch({ client_email: e.target.value })}
                placeholder="miho@leavescoffee.jp"
              />
            </div>
            <div className="field">
              <label>Status</label>
              <select
                value={doc.status}
                aria-label="Estado del documento"
                onChange={e => patch({ status: e.target.value as TripToOrigin['status'] })}
              >
                <option value="draft">Borrador</option>
                <option value="sent">Enviado</option>
                <option value="signed">Firmado</option>
              </select>
            </div>
          </div>

          {/* Trip date */}
          <div className="tto-group-title">Trip Date</div>
          <div className="field">
            <label>Fecha del viaje</label>
            <input
              value={doc.trip_date}
              onChange={e => patch({ trip_date: e.target.value })}
              placeholder="04/02/2026"
            />
          </div>

          {/* Welcome paragraphs */}
          <div className="tto-group-title">Welcome Text</div>
          {doc.welcome_text_paragraphs.map((para, idx) => (
            <div key={idx} className="field">
              <label>Párrafo {idx + 1}</label>
              <textarea
                rows={3}
                value={para}
                onChange={e => patchParagraph(idx, e.target.value)}
                style={{ resize: 'vertical', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-gray-medium)', borderRadius: 'var(--radius-sm)' }}
              />
            </div>
          ))}

          {/* Days */}
          <div className="tto-group-title">
            Días del itinerario
            <button className="tto-btn-add" type="button" onClick={addDay}>+ Día</button>
          </div>

          {doc.days.map((day, dayIdx) => (
            <div key={dayIdx} className="tto-day-card">
              <div className="tto-day-header">
                <span className="tto-day-number">Día {day.day_number}</span>
                {doc.days.length > 1 && (
                  <button
                    className="tto-btn-remove"
                    type="button"
                    onClick={() => removeDay(dayIdx)}
                    aria-label={`Eliminar día ${day.day_number}`}
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="tto-day-row-2">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Título</label>
                  <input
                    value={day.title}
                    onChange={e => patchDay(dayIdx, 'title', e.target.value)}
                    placeholder="Arrival & Visit to La Amistad"
                  />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Fecha (ej. NOVEMBER 19, 2026)</label>
                  <input
                    value={day.date}
                    onChange={e => patchDay(dayIdx, 'date', e.target.value)}
                    placeholder="NOVEMBER 19, 2026"
                  />
                </div>
              </div>

              {/* Schedule items */}
              <div className="tto-group-title" style={{ marginTop: 10, fontSize: 10 }}>
                Horario
                <button
                  className="tto-btn-add"
                  type="button"
                  onClick={() => addScheduleItem(dayIdx)}
                >
                  + Actividad
                </button>
              </div>

              <div className="tto-schedule-list">
                {day.schedule.map((item, itemIdx) => (
                  <div key={itemIdx} className="tto-schedule-item">
                    <input
                      value={item.time}
                      onChange={e => patchScheduleItem(dayIdx, itemIdx, 'time', e.target.value)}
                      placeholder="7:00 AM"
                      aria-label="Hora"
                    />
                    <input
                      value={item.activity}
                      onChange={e => patchScheduleItem(dayIdx, itemIdx, 'activity', e.target.value)}
                      placeholder="Actividad"
                      aria-label="Actividad"
                    />
                    <input
                      value={item.description ?? ''}
                      onChange={e => patchScheduleItem(dayIdx, itemIdx, 'description', e.target.value)}
                      placeholder="Descripción (opcional)"
                      aria-label="Descripción"
                    />
                    {day.schedule.length > 1 && (
                      <button
                        className="tto-btn-remove"
                        type="button"
                        onClick={() => removeScheduleItem(dayIdx, itemIdx)}
                        aria-label="Eliminar actividad"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Closing text */}
          <div className="tto-group-title">Closing Text</div>
          <div className="field">
            <label>Texto de cierre</label>
            <textarea
              rows={4}
              value={doc.closing_text}
              onChange={e => patch({ closing_text: e.target.value })}
              style={{ resize: 'vertical', padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', border: '1px solid var(--color-gray-medium)', borderRadius: 'var(--radius-sm)' }}
            />
          </div>

          {saveError && (
            <div className="tto-save-error" role="alert">{saveError}</div>
          )}

          <div className="tto-actions">
            <button className="btn btn-secondary" type="button" onClick={onSaveDraft}>
              Guardar borrador
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={saving}
              onClick={() => void handleGeneratePDF()}
              aria-label="Guardar y descargar PDF Trip to Origin"
            >
              {saving ? 'Generando…' : 'Generar PDF'}
            </button>
          </div>
        </div>

        {/* ── Preview derecha ── */}
        <div className="tto-preview">
          <div className="tto-preview-label">Vista previa — 5 páginas</div>
          <TripToOriginPreview doc={doc} />
        </div>
      </div>
    </>
  )
}

// ─── Preview visual — 5 páginas apiladas ──────────────────────────────────────

function TripToOriginPreview({ doc }: { doc: TripToOrigin }) {
  const clientName = doc.client_name || 'Client Name'
  const tripDate = doc.trip_date || '—'
  const para0 = doc.welcome_text_paragraphs[0] ?? ''
  const para1 = doc.welcome_text_paragraphs[1] ?? ''

  // Separar días: página 3 = día 1 · página 4 = días 2+ (apilados)
  const day1 = doc.days[0] ?? null
  const daysRest = doc.days.slice(1)

  return (
    <div className="tto-pages-stack">
      {/* ── Página 1: Cover ── */}
      <div className="tto-page tto-p1">
        <div className="tto-p1-body">
          <div>
            <div className="tto-p1-logo-brand">LA PALMA &amp; EL TUCÁN</div>
            <div className="tto-p1-logo-main">From The Heart</div>
          </div>
          <div className="tto-p1-itinerary-label">This Itinerary is specially prepared for:</div>
          <div className="tto-p1-client-name">{clientName}</div>
          <div className="tto-p1-tagline">"Some say coffee is for the soul."</div>
        </div>
        <div className="tto-p1-footer">
          <span className="tto-p1-footer-text">@lapalmayeltucan</span>
          <span className="tto-p1-footer-text">lapalmayeltucan.com</span>
        </div>
      </div>

      {/* ── Página 2: Welcome ── */}
      <div className="tto-page tto-p2">
        <div className="tto-p2-top">
          <div className="tto-p2-logo-small">LA PALMA &amp; EL TUCÁN</div>
          <div className="tto-p2-headline">"We think coffee is from the soul."</div>
          <div className="tto-p2-welcome">Welcome</div>
          <div className="tto-p2-paras">
            {para0 && <div className="tto-p2-para">{para0}</div>}
            {para1 && <div className="tto-p2-para">{para1}</div>}
          </div>
        </div>
        <div className="tto-p2-bottom">
          <div className="tto-p2-date-label">Date of your trip</div>
          <div className="tto-p2-date-value">{tripDate}</div>
        </div>
      </div>

      {/* ── Página 3: Día 1 ── */}
      <div className="tto-page tto-pday">
        <div className="tto-pday-body">
          <div className="tto-pday-pill-top">OUR COFFEE JOURNEY</div>
          <div className="tto-pday-title">Trip to Origin</div>
          <div className="tto-pday-subtitle">
            We invite you to look beyond the surface and discover the story behind every cup.
          </div>
          <div className="tto-pday-cards">
            {day1 ? (
              <DayTimelineCard day={day1} />
            ) : (
              <div style={{ opacity: 0.5, fontSize: 8, color: 'white' }}>Agrega un día en el formulario</div>
            )}
          </div>
        </div>
        <div className="tto-pday-footer">
          <span className="tto-pday-footer-text">@lapalmayeltucan</span>
          <span className="tto-pday-footer-text">lapalmayeltucan.com</span>
        </div>
      </div>

      {/* ── Página 4: Días 2-3 (o vacía si no hay) ── */}
      <div className="tto-page tto-pday">
        <div className="tto-pday-body">
          <div className="tto-pday-pill-top">COFFEE JOURNEY</div>
          <div className="tto-pday-title">Trip to Origin</div>
          <div className="tto-pday-cards">
            {daysRest.length > 0
              ? daysRest.map((d) => <DayTimelineCard key={d.day_number} day={d} />)
              : <div style={{ opacity: 0.5, fontSize: 8, color: 'white' }}>Días 2+ aparecerán aquí</div>
            }
          </div>
        </div>
        <div className="tto-pday-footer">
          <span className="tto-pday-footer-text">@lapalmayeltucan</span>
          <span className="tto-pday-footer-text">lapalmayeltucan.com</span>
        </div>
      </div>

      {/* ── Página 5: Closing ── */}
      <div className="tto-page tto-p5">
        <div className="tto-p5-body">
          {doc.closing_text && (
            <div className="tto-p5-closing-text">{doc.closing_text}</div>
          )}
          <div className="tto-p5-see-you">See you very soon!</div>
          <div className="tto-p5-logo">
            <div className="tto-p5-logo-brand">LA PALMA &amp; EL TUCÁN</div>
            <div className="tto-p5-logo-main">From The Heart</div>
          </div>
        </div>
        <div className="tto-p5-footer">
          <span className="tto-p5-footer-text">@lapalmayeltucan</span>
          <span className="tto-p5-footer-text">lapalmayeltucan.com</span>
        </div>
      </div>
    </div>
  )
}

// ─── Card de timeline de un día en el preview ─────────────────────────────────

function DayTimelineCard({ day }: { day: TripDay }) {
  // Mostrar máximo 5 items para no desbordar la card
  const visibleItems = day.schedule.slice(0, 5)

  return (
    <div className="tto-day-timeline-card">
      <div className="tto-day-timeline-pill">
        Day {day.day_number}: {day.title || 'Sin título'}
      </div>
      <br />
      {day.date && (
        <div className="tto-day-date-chip">{day.date}</div>
      )}
      <div className="tto-timeline-items">
        {visibleItems.map((item, idx) => (
          <div key={idx} className="tto-timeline-item">
            {item.time && (
              <span className="tto-timeline-time-chip">{item.time}</span>
            )}
            <div>
              <div className="tto-timeline-activity">{item.activity}</div>
              {item.description && (
                <div className="tto-timeline-desc">{item.description}</div>
              )}
            </div>
          </div>
        ))}
        {day.schedule.length > 5 && (
          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            +{day.schedule.length - 5} más…
          </div>
        )}
      </div>
    </div>
  )
}
