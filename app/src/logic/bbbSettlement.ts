import type { Player, PlayerId } from '../types'
import type { Settlement, SettlementLine } from './wolfSettlement'

function cloneNet(players: Player[], netById: Record<PlayerId, number>) {
  return players.map((p) => ({ p, net: netById[p.id] || 0 }))
}

// BBB points are non-negative, so a naive (points * $/pt) model is not zero-sum.
// For v1 we settle relative to the table average so total net = 0:
// net = (points - avgPoints) * centsPerPoint.
export function computeBBBSettlement(players: Player[], pointsByPlayer: Record<PlayerId, number>, dollarsPerPointCents: number): Settlement {
  const N = players.length
  if (N <= 1) return { netByPlayer: {}, lines: [] }

  const totalPoints = players.reduce((sum, p) => sum + (pointsByPlayer[p.id] || 0), 0)
  const avg = totalPoints / N

  const netByPlayer: Record<PlayerId, number> = {}
  for (const p of players) {
    const pts = pointsByPlayer[p.id] || 0
    // Round to cents to avoid fractions from avg.
    netByPlayer[p.id] = Math.round((pts - avg) * dollarsPerPointCents)
  }

  // Fix any rounding drift so the total is exactly 0.
  const drift = Object.values(netByPlayer).reduce((s, x) => s + x, 0)
  if (drift !== 0) {
    // Adjust the current leader (highest net) to absorb drift.
    const leader = players
      .slice()
      .sort((a, b) => (netByPlayer[b.id] || 0) - (netByPlayer[a.id] || 0))[0]
    if (leader) netByPlayer[leader.id] = (netByPlayer[leader.id] || 0) - drift
  }

  const creditors = cloneNet(players, netByPlayer)
    .filter((x) => x.net > 0)
    .sort((a, b) => b.net - a.net)
  const debtors = cloneNet(players, netByPlayer)
    .filter((x) => x.net < 0)
    .sort((a, b) => a.net - b.net)

  const lines: SettlementLine[] = []
  let i = 0,
    j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]

    const pay = Math.min(-d.net, c.net)
    if (pay > 0) {
      lines.push({ from: d.p, to: c.p, amountCents: pay })
      d.net += pay
      c.net -= pay
    }

    if (d.net === 0) i++
    if (c.net === 0) j++
  }

  return { netByPlayer, lines }
}
