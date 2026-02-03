import type { HoleNumber, PlayerId, Round, SkinsSummary } from '../types';

function holes18(): HoleNumber[] {
  return Array.from({ length: 18 }, (_, i) => (i + 1) as HoleNumber);
}

export function stakeLabel(stakeCents: number): string {
  const dollars = stakeCents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function computeSkins(round: Round): SkinsSummary {
  const skinsWon: Record<PlayerId, number> = {};
  for (const p of round.players) skinsWon[p.id] = 0;

  const holeResults = [] as SkinsSummary['holeResults'];
  let carry = 0;

  for (const hole of holes18()) {
    const strokes = round.strokesByHole[hole] || {};
    const entries = round.players
      .map((p) => ({ id: p.id, v: strokes[p.id] }))
      .filter((e) => typeof e.v === 'number') as { id: PlayerId; v: number }[];

    // If hole not fully entered, treat as no result yet.
    // (We still report carry so UI can show it.)
    if (entries.length < round.players.length) {
      holeResults.push({ hole, carrySkins: carry, winnerId: null, wonSkins: 0 });
      continue;
    }

    const min = Math.min(...entries.map((e) => e.v));
    const winners = entries.filter((e) => e.v === min);

    if (winners.length === 1) {
      const winnerId = winners[0].id;
      const wonSkins = 1 + carry;
      skinsWon[winnerId] += wonSkins;
      holeResults.push({ hole, carrySkins: carry, winnerId, wonSkins });
      carry = 0;
    } else {
      // tie low: carry to next hole
      holeResults.push({ hole, carrySkins: carry, winnerId: null, wonSkins: 0 });
      carry += 1;
    }
  }

  return {
    holeResults,
    skinsWon,
    carryToNext: carry,
  };
}
