/**
 * Calendar utilities — P4.6
 *
 * ICS file generation and Google Calendar deep-link builder for
 * reservation confirmation.
 */

export interface CalendarEvent {
  title: string
  date: string        // YYYY-MM-DD
  time: string        // HH:MM (24-hour)
  durationMinutes?: number
  description?: string
  location?: string
  uid?: string
}

function toIcsDateTime(date: string, time: string): string {
  // date: YYYY-MM-DD, time: HH:MM → 20240315T190000
  const d = date.replace(/-/g, '')
  const t = time.replace(':', '') + '00'
  return `${d}T${t}`
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const newH = Math.floor(total / 60) % 24
  const newM = total % 60
  const newTime = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
  return toIcsDateTime(date, newTime)
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function generateIcs(event: CalendarEvent): string {
  const duration = event.durationMinutes ?? 120
  const dtStart = toIcsDateTime(event.date, event.time)
  const dtEnd = addMinutes(event.date, event.time, duration)
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const uid = event.uid ?? `${Date.now()}@samoon`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Samoon//Reservation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  ]

  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function downloadIcs(event: CalendarEvent, filename = 'reservation.ics'): void {
  const content = generateIcs(event)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function buildGoogleCalendarUrl(event: CalendarEvent): string {
  const duration = event.durationMinutes ?? 120
  const start = toIcsDateTime(event.date, event.time)
  const end = addMinutes(event.date, event.time, duration)
  const dates = `${start}/${end}`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
