import type { Player, PlayerId } from '../types'
import type { Settlement, SettlementLine } from './wolfSettlement'
import { settlementLinesFromNet } from './settlementMatcher'

// BBB points are non-negative, so we need a zero-sum money model.
// Model (v1): each BBB point is worth $/pt paid by *each opponent*.
// => net[p] = ($/pt) * (points[p] * N - totalPoints)
// This is zero-sum by construction and matches the common "everyone pays winner per point" intuition.
export function computeBBBSettlement(players: Player[], pointsByPlayer: Record<PlayerId, number>, dollarsPerPointCents: number): Settlement {
  const N = players.length
  if (N <= 1) return { netByPlayer: {}, lines: [] }

  const totalPoints = players.reduce((sum, p) => sum + (pointsByPlayer[p.id] || 0), 0)

  const netByPlayer: Record<PlayerId, number> = {}
  for (const p of players) {
    const pts = pointsByPlayer[p.id] || 0
    netByPlayer[p.id] = (pts * N - totalPoints) * dollarsPerPointCents
  }

  const lines = settlementLinesFromNet(players, netByPlayer) as SettlementLine[]

  return { netByPlayer, lines }
}
