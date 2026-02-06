import type { Round } from './types'

const KEY = 'rubislabs:golf-bets:rounds:v1'
const MAX = 25

type AnyRecord = Record<string, unknown>

function isRecord(v: unknown): v is AnyRecord {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export type StoredRounds = {
  activeRoundId?: string
  rounds: Round[]
}

export function loadRounds(): StoredRounds {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { rounds: [] }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || !Array.isArray(parsed.rounds)) return { rounds: [] }

    // Lightweight migration for older stored rounds.
    const rounds = (parsed.rounds as unknown[]).map((r) => {
      if (!isRecord(r)) return r as Round

      const game = r.game

      if (!game) {
        // legacy = skins
        return { ...(r as AnyRecord), game: 'skins', stakeCents: typeof r.stakeCents === 'number' ? r.stakeCents : 500 } as Round
      }

      if (game === 'skins') {
        return { ...(r as AnyRecord), stakeCents: typeof r.stakeCents === 'number' ? r.stakeCents : 500 } as Round
      }

      if (game === 'wolf') {
        return {
          ...(r as AnyRecord),
          wolfPointsPerHole: typeof r.wolfPointsPerHole === 'number' ? r.wolfPointsPerHole : 1,
          wolfLoneMultiplier: typeof r.wolfLoneMultiplier === 'number' ? r.wolfLoneMultiplier : 2,
          wolfDollarsPerPointCents:
            typeof r.wolfDollarsPerPointCents === 'number'
              ? r.wolfDollarsPerPointCents
              : typeof r.dollarsPerPointCents === 'number'
                ? r.dollarsPerPointCents
                : 0,
          wolfStartingIndex: typeof r.wolfStartingIndex === 'number' ? r.wolfStartingIndex : 0,
          wolfPartnerByHole: isRecord(r.wolfPartnerByHole) ? r.wolfPartnerByHole : {},
        } as Round
      }

      return r as Round
    })

    return {
      activeRoundId: typeof parsed.activeRoundId === 'string' ? parsed.activeRoundId : undefined,
      rounds: rounds as Round[],
    }
  } catch {
    return { rounds: [] }
  }
}

export function saveRounds(data: StoredRounds) {
  const rounds = data.rounds
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, MAX)
  const payload: StoredRounds = {
    activeRoundId: data.activeRoundId,
    rounds,
  }
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function upsertRound(data: StoredRounds, round: Round): StoredRounds {
  const idx = data.rounds.findIndex((r) => r.id === round.id)
  const nextRounds = data.rounds.slice()
  if (idx >= 0) nextRounds[idx] = round
  else nextRounds.push(round)
  return { ...data, rounds: nextRounds, activeRoundId: round.id }
}

export function deleteRound(data: StoredRounds, roundId: string): StoredRounds {
  const rounds = data.rounds.filter((r) => r.id !== roundId)
  const activeRoundId = data.activeRoundId === roundId ? rounds[0]?.id : data.activeRoundId
  return { rounds, activeRoundId }
}
