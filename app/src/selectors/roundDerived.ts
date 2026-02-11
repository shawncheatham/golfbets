import type { BBBSummary } from '../logic/bbb'
import type { WolfSummary } from '../logic/wolf'
import type { HoleNumber, Player, PlayerId, Round, SkinsSummary } from '../types'

export const HOLES_18: HoleNumber[] = Array.from({ length: 18 }, (_, i) => (i + 1) as HoleNumber)

export function playerNameMap(players: Player[]): Record<PlayerId, string> {
  const byId = {} as Record<PlayerId, string>
  for (const p of players) byId[p.id] = p.name
  return byId
}

export function enteredStrokeCountByHole(round: Round): Record<HoleNumber, number> {
  const out = {} as Record<HoleNumber, number>
  for (const hole of HOLES_18) {
    const by = round.strokesByHole[hole]
    let n = 0
    for (const p of round.players) {
      if (typeof by?.[p.id] === 'number') n += 1
    }
    out[hole] = n
  }
  return out
}

export function holeCompletionByHole(round: Round, enteredByHole: Record<HoleNumber, number>): Record<HoleNumber, boolean> {
  const out = {} as Record<HoleNumber, boolean>
  for (const hole of HOLES_18) {
    if (round.game === 'bbb') {
      const a = round.bbbAwardsByHole?.[hole]
      out[hole] = !!a && ['bingo', 'bango', 'bongo'].every((k) => k in a)
    } else {
      out[hole] = enteredByHole[hole] === round.players.length
    }
  }
  return out
}

export function lastCompletedHoleFromMap(completionByHole: Record<HoleNumber, boolean>): number {
  for (let h = 18; h >= 1; h--) {
    if (completionByHole[h as HoleNumber]) return h
  }
  return 0
}

export function roundIsComplete(completionByHole: Record<HoleNumber, boolean>): boolean {
  for (const hole of HOLES_18) {
    if (!completionByHole[hole]) return false
  }
  return true
}

export function firstIncompleteHoleFromMap(completionByHole: Record<HoleNumber, boolean>): number {
  for (const hole of HOLES_18) {
    if (!completionByHole[hole]) return hole
  }
  return 18
}

export function nextIncompleteHoleFromMap(fromHole: number, completionByHole: Record<HoleNumber, boolean>): number | null {
  for (let h = Math.min(18, fromHole + 1); h <= 18; h++) {
    if (!completionByHole[h as HoleNumber]) return h
  }
  for (let h = 1; h <= Math.max(1, fromHole); h++) {
    if (!completionByHole[h as HoleNumber]) return h
  }
  return null
}

export function anyIncompleteHole(completionByHole: Record<HoleNumber, boolean>): boolean {
  for (const hole of HOLES_18) {
    if (!completionByHole[hole]) return true
  }
  return false
}

export function skinsResultByHoleMap(skins: SkinsSummary | null): Record<HoleNumber, SkinsSummary['holeResults'][number]> {
  const out = {} as Record<HoleNumber, SkinsSummary['holeResults'][number]>
  if (!skins) return out
  for (const hr of skins.holeResults) out[hr.hole as HoleNumber] = hr
  return out
}

export function wolfResultByHoleMap(wolf: WolfSummary | null): Record<HoleNumber, WolfSummary['holeResults'][number]> {
  const out = {} as Record<HoleNumber, WolfSummary['holeResults'][number]>
  if (!wolf) return out
  for (const hr of wolf.holeResults) out[hr.hole as HoleNumber] = hr
  return out
}

export function bbbThrough(round: Round, bbb: BBBSummary | null): number {
  if (round.game === 'bbb') return bbb?.through ?? 0
  return 0
}
