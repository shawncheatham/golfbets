import type { Player, PlayerId } from '../types'

type SettlementLineShape = {
  from: Player
  to: Player
  amountCents: number
}

function cloneNet(players: Player[], netById: Record<PlayerId, number>) {
  return players.map((p) => ({ p, net: netById[p.id] || 0 }))
}

// Greedy debtor/creditor matcher used by all money settlement modes.
export function settlementLinesFromNet(players: Player[], netByPlayer: Record<PlayerId, number>): SettlementLineShape[] {
  const creditors = cloneNet(players, netByPlayer)
    .filter((x) => x.net > 0)
    .sort((a, b) => b.net - a.net)
  const debtors = cloneNet(players, netByPlayer)
    .filter((x) => x.net < 0)
    .sort((a, b) => a.net - b.net)

  const lines: SettlementLineShape[] = []
  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]

    const pay = Math.min(-d.net, c.net)
    if (pay > 0) {
      lines.push({ from: d.p, to: c.p, amountCents: pay })
      d.net += pay
      c.net -= pay
    }

    if (d.net === 0) i += 1
    if (c.net === 0) j += 1
  }

  return lines
}
