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

export function track(name: TrackEventName, props?: Record<string, unknown>) {
  const ev: TrackEvent = { ts: Date.now(), name, props }

  // Dev visibility (kept lightweight)
  try {
    console.log('[track]', ev)
  } catch {
    // ignore
  }

  try {
    const cur = safeParse(localStorage.getItem(KEY))
    cur.push(ev)
    const next = cur.length > MAX ? cur.slice(cur.length - MAX) : cur
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // ignore (private mode / quota)
  }
}

export function getTrackedEvents(): TrackEvent[] {
  try {
    return safeParse(localStorage.getItem(KEY))
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
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
