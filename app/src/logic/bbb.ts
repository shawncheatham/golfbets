import type { HoleNumber, Player, PlayerId, Round } from '../types'

export type BBBAwardType = 'bingo' | 'bango' | 'bongo'

export type BBBHoleAwards = {
  bingo: PlayerId | null
  bango: PlayerId | null
  bongo: PlayerId | null
}

export type BBBSummary = {
  through: number
  pointsByPlayer: Record<PlayerId, number>
  holeAwards: Record<HoleNumber, BBBHoleAwards>
}

export function emptyHoleAwards(): BBBHoleAwards {
  return { bingo: null, bango: null, bongo: null }
}

export function computeBBB(round: Round): BBBSummary {
  const pointsByPlayer: Record<PlayerId, number> = {}
  for (const p of round.players) pointsByPlayer[p.id] = 0

  const holeAwards = (round.bbbAwardsByHole || {}) as Record<HoleNumber, BBBHoleAwards>

  let through = 0
  for (let h = 1 as HoleNumber; h <= 18; h = (h + 1) as HoleNumber) {
    const a = holeAwards[h]
    if (!a) break

    // Through is defined as “hole has at least one award assigned or explicitly present”
    // (So a fully empty hole record still counts as entered if the record exists.)
    through = h

    for (const key of ['bingo', 'bango', 'bongo'] as const) {
      const winner = a[key]
      if (winner && pointsByPlayer[winner] != null) pointsByPlayer[winner] += 1
    }
  }

  return { through, pointsByPlayer, holeAwards }
}

export function playerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function bbbStatusText(players: Player[], through: number, pointsByPlayer: Record<PlayerId, number>): string {
  const sorted = players
    .map((p) => ({ name: p.name, pts: pointsByPlayer[p.id] || 0 }))
    .sort((a, b) => b.pts - a.pts)

  const leader = sorted[0]
  const leaderLine = leader ? `Leader: ${leader.name} (${leader.pts})` : ''
  const inline = sorted.map((x) => `${x.name} ${x.pts}`).join(' • ')

  return `BBB — Through ${through}/18\n${leaderLine}\n${inline}`
}
