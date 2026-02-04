import type { Player, PlayerId } from '../types'

export type SettlementLine = {
  from: Player
  to: Player
  amountCents: number
}

export type Settlement = {
  netByPlayer: Record<PlayerId, number> // + is owed to them; - they owe
  lines: SettlementLine[]
}

function cloneNet(players: Player[], netById: Record<PlayerId, number>) {
  return players.map((p) => ({ p, net: netById[p.id] || 0 }))
}

// Convert point standings to suggested payments given $/point.
export function computeWolfSettlement(players: Player[], pointsByPlayer: Record<PlayerId, number>, dollarsPerPointCents: number): Settlement {
  const netByPlayer: Record<PlayerId, number> = {}
  for (const p of players) {
    const pts = pointsByPlayer[p.id] || 0
    netByPlayer[p.id] = pts * dollarsPerPointCents
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
