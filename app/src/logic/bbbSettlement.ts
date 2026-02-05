import type { Player, PlayerId } from '../types'
import type { Settlement, SettlementLine } from './wolfSettlement'

function cloneNet(players: Player[], netById: Record<PlayerId, number>) {
  return players.map((p) => ({ p, net: netById[p.id] || 0 }))
}

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
