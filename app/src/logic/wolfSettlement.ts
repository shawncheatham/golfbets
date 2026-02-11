import type { Player, PlayerId } from '../types'
import { settlementLinesFromNet } from './settlementMatcher'

export type SettlementLine = {
  from: Player
  to: Player
  amountCents: number
}

export type Settlement = {
  netByPlayer: Record<PlayerId, number> // + is owed to them; - they owe
  lines: SettlementLine[]
}

// Convert point standings to suggested payments given $/point.
export function computeWolfSettlement(players: Player[], pointsByPlayer: Record<PlayerId, number>, dollarsPerPointCents: number): Settlement {
  const netByPlayer: Record<PlayerId, number> = {}
  for (const p of players) {
    const pts = pointsByPlayer[p.id] || 0
    netByPlayer[p.id] = pts * dollarsPerPointCents
  }

  const lines = settlementLinesFromNet(players, netByPlayer) as SettlementLine[]

  return { netByPlayer, lines }
}
