// v2: keep tracking local-first, but formalize event names to avoid drift.
export const TRACK_EVENTS = {
  round_new: 'round_new',
  round_start: 'round_start',
  nav_screen: 'nav_screen',
  round_lock: 'round_lock',
  round_unlock: 'round_unlock',
  share_status: 'share_status',
  share_settlement: 'share_settlement',
  bbb_award_set: 'bbb_award_set',
  bbb_hole_clear: 'bbb_hole_clear',
  debug_export: 'debug_export',
  debug_clear: 'debug_clear',
} as const

export type TrackEventName = (typeof TRACK_EVENTS)[keyof typeof TRACK_EVENTS]

export type TrackEvent = {
  ts: number
  name: TrackEventName
  props?: Record<string, unknown>
}

export type TrackExport = {
  v: 1
  exportedAt: number
  userAgent?: string
  href?: string
  events: TrackEvent[]
}

const KEY = 'rubislabs:golf-bets:track:v1'
const MAX = 500
const WRITE_DEBOUNCE_MS = 150

let memEvents: TrackEvent[] | null = null
let writeTimer: number | null = null

function safeParse(raw: string | null): TrackEvent[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    // stored events are trusted-ish (same app), but still guard shape lightly.
    return v.filter((x): x is TrackEvent => {
      if (!x || typeof x !== 'object') return false
      const rec = x as Record<string, unknown>
      return typeof rec.ts === 'number' && typeof rec.name === 'string'
    })
  } catch {
    return []
  }
}

function ensureLoaded(): TrackEvent[] {
  if (memEvents) return memEvents
  memEvents = safeParse(localStorage.getItem(KEY))
  return memEvents
}

function saveToStorage(events: TrackEvent[]) {
  const next = events.length > MAX ? events.slice(events.length - MAX) : events
  localStorage.setItem(KEY, JSON.stringify(next))
}

function scheduleWrite() {
  if (writeTimer !== null) return
  writeTimer = window.setTimeout(() => {
    writeTimer = null
    flushTrackedEvents()
  }, WRITE_DEBOUNCE_MS)
}

export function track(name: TrackEventName, props?: Record<string, unknown>) {
  const ev: TrackEvent = { ts: Date.now(), name, props }

  // Dev visibility (kept lightweight)
  try {
    console.log('[track]', ev)
  } catch {
    // ignore
  }

  try {
    const events = ensureLoaded()
    events.push(ev)
    scheduleWrite()
  } catch {
    // ignore (private mode / quota)
  }
}

export function getTrackedEvents(): TrackEvent[] {
  try {
    return ensureLoaded().slice()
  } catch {
    return []
  }
}

export function exportTrackedEvents(): TrackExport {
  const events = getTrackedEvents()
  let userAgent: string | undefined
  let href: string | undefined

  try {
    userAgent = navigator.userAgent
  } catch {
    // ignore
  }

  try {
    href = window.location.href
  } catch {
    // ignore
  }

  return {
    v: 1,
    exportedAt: Date.now(),
    userAgent,
    href,
    events,
  }
}

export function clearTrackedEvents() {
  if (writeTimer !== null) {
    window.clearTimeout(writeTimer)
    writeTimer = null
  }
  memEvents = []
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function flushTrackedEvents() {
  if (writeTimer !== null) {
    window.clearTimeout(writeTimer)
    writeTimer = null
  }

  try {
    const events = ensureLoaded()
    saveToStorage(events)
  } catch {
    // ignore
  }
}
