import type { HoleNumber, PlayerId, Round } from '../types'

export type WolfHoleResult = {
  hole: HoleNumber
  wolfId: PlayerId
  partnerId: PlayerId | null // null = lone wolf
  status: 'incomplete' | 'tie' | 'wolfWin' | 'wolfLose'
  pointsDeltaByPlayer: Record<PlayerId, number>
}

export type WolfSummary = {
  pointsByPlayer: Record<PlayerId, number>
  holeResults: WolfHoleResult[]
}

function holes18(): HoleNumber[] {
  return Array.from({ length: 18 }, (_, i) => (i + 1) as HoleNumber)
}

export function wolfLabel(pointsPerHole?: number): string {
  const p = typeof pointsPerHole === 'number' ? pointsPerHole : 1
  return `${p} pt/hole`
}

function getWolfId(round: Round, hole: HoleNumber): PlayerId {
  const start = typeof round.wolfStartingIndex === 'number' ? round.wolfStartingIndex : 0
  const idx = (start + (hole - 1)) % round.players.length
  return round.players[idx].id
}

export function computeWolf(round: Round): WolfSummary {
  const pointsByPlayer: Record<PlayerId, number> = {}
  for (const p of round.players) pointsByPlayer[p.id] = 0

  const holeResults: WolfHoleResult[] = []

  const pts = typeof round.wolfPointsPerHole === 'number' ? round.wolfPointsPerHole : 1
  const loneMult = typeof round.wolfLoneMultiplier === 'number' ? round.wolfLoneMultiplier : 2

  for (const hole of holes18()) {
    const wolfId = getWolfId(round, hole)
    const partnerId = (round.wolfPartnerByHole?.[hole] ?? null) as PlayerId | null

    const strokes = round.strokesByHole[hole] || {}
    const allEntered = round.players.every((p) => typeof strokes[p.id] === 'number')

    const pointsDeltaByPlayer: Record<PlayerId, number> = {}
    for (const p of round.players) pointsDeltaByPlayer[p.id] = 0

    if (!allEntered) {
      holeResults.push({ hole, wolfId, partnerId, status: 'incomplete', pointsDeltaByPlayer })
      continue
    }

    // If partner not chosen, treat as lone wolf.
    if (!partnerId || partnerId === wolfId) {
      const wolfScore = strokes[wolfId] as number
      const others = round.players.filter((p) => p.id !== wolfId)
      const othersBest = Math.min(...others.map((p) => strokes[p.id] as number))

      if (wolfScore < othersBest) {
        pointsDeltaByPlayer[wolfId] += pts * loneMult
        holeResults.push({ hole, wolfId, partnerId: null, status: 'wolfWin', pointsDeltaByPlayer })
      } else if (wolfScore > othersBest) {
        pointsDeltaByPlayer[wolfId] -= pts * loneMult
        holeResults.push({ hole, wolfId, partnerId: null, status: 'wolfLose', pointsDeltaByPlayer })
      } else {
        holeResults.push({ hole, wolfId, partnerId: null, status: 'tie', pointsDeltaByPlayer })
      }
    } else {
      // 2v2 best-ball
      const wolfTeam = [wolfId, partnerId]
      const otherTeam = round.players.map((p) => p.id).filter((id) => id !== wolfId && id !== partnerId)

      const wolfBest = Math.min(...wolfTeam.map((id) => strokes[id] as number))
      const otherBest = Math.min(...otherTeam.map((id) => strokes[id] as number))

      if (wolfBest < otherBest) {
        for (const id of wolfTeam) pointsDeltaByPlayer[id] += pts
        for (const id of otherTeam) pointsDeltaByPlayer[id] -= pts
        holeResults.push({ hole, wolfId, partnerId, status: 'wolfWin', pointsDeltaByPlayer })
      } else if (wolfBest > otherBest) {
        for (const id of wolfTeam) pointsDeltaByPlayer[id] -= pts
        for (const id of otherTeam) pointsDeltaByPlayer[id] += pts
        holeResults.push({ hole, wolfId, partnerId, status: 'wolfLose', pointsDeltaByPlayer })
      } else {
        holeResults.push({ hole, wolfId, partnerId, status: 'tie', pointsDeltaByPlayer })
      }
    }

    // apply
    for (const [id, d] of Object.entries(pointsDeltaByPlayer)) {
      pointsByPlayer[id as PlayerId] = (pointsByPlayer[id as PlayerId] || 0) + d
    }
  }

  return { pointsByPlayer, holeResults }
}

export function wolfForHole(round: Round, hole: HoleNumber): { wolfId: PlayerId } {
  return { wolfId: getWolfId(round, hole) }
}
