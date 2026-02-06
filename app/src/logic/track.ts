type TrackEvent = {
  ts: number
  name: string
  props?: Record<string, unknown>
}

const KEY = 'rubislabs:golf-bets:track:v1'
const MAX = 500

function safeParse(raw: string | null): TrackEvent[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? (v as TrackEvent[]) : []
  } catch {
    return []
  }
}

export function track(name: string, props?: Record<string, unknown>) {
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

export function clearTrackedEvents() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
