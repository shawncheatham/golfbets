import type { Player, PlayerId } from '../types'
import { computeWolfSettlement, type Settlement } from './wolfSettlement'

// BBB uses the same settlement model as Wolf when $/pt is enabled:
// net dollars = points * centsPerPoint.
export function computeBBBSettlement(players: Player[], pointsByPlayer: Record<PlayerId, number>, dollarsPerPointCents: number): Settlement {
  return computeWolfSettlement(players, pointsByPlayer, dollarsPerPointCents)
}
