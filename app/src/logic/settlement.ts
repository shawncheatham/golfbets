import type { Player, PlayerId, Round } from '../types';
import { computeSkins } from './skins';
import { settlementLinesFromNet } from './settlementMatcher';

export type SettlementLine = {
  from: Player;
  to: Player;
  amountCents: number;
};

export type Settlement = {
  netByPlayer: Record<PlayerId, number>; // + is owed to them; - they owe
  lines: SettlementLine[];
};

export function computeSettlement(round: Round): Settlement {
  const skins = computeSkins(round);
  const potPerSkin = round.stakeCents || 0;

  const netByPlayer: Record<PlayerId, number> = {};
  for (const p of round.players) {
    const won = skins.skinsWon[p.id] || 0;
    const gross = won * potPerSkin;
    // Everyone pays into pot: stake per decided skin *? In skins, each skin is a bet between all players.
    // For simple MVP: value transfers are relative to average.
    // Net = gross - (totalPot / N)
    netByPlayer[p.id] = gross;
  }

  // Total pot equals total decided skins * stakeCents * N? Actually in a common skins game,
  // each skin is worth stakeCents per opponent (or per player). Rules vary.
  // For MVP, we model: each skin pays stakeCents from each losing player to the winner.
  // => winner receives stakeCents*(N-1), each loser pays stakeCents.
  // We can compute this directly.
  const N = round.players.length;
  const net2: Record<PlayerId, number> = {};
  for (const p of round.players) net2[p.id] = 0;

  for (const hr of skins.holeResults) {
    if (!hr.winnerId || hr.wonSkins <= 0) continue;
    const winnerId = hr.winnerId;
    const unit = round.stakeCents || 0;
    const skinsCount = hr.wonSkins;

    net2[winnerId] += unit * skinsCount * (N - 1);
    for (const p of round.players) {
      if (p.id === winnerId) continue;
      net2[p.id] -= unit * skinsCount;
    }
  }

  const lines = settlementLinesFromNet(round.players, net2) as SettlementLine[];

  return { netByPlayer: net2, lines };
}
