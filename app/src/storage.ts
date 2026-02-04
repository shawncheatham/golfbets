import type { Round } from './types';

const KEY = 'rubislabs:golf-bets:rounds:v1';
const MAX = 25;

export type StoredRounds = {
  activeRoundId?: string;
  rounds: Round[];
};

export function loadRounds(): StoredRounds {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { rounds: [] };
    const parsed = JSON.parse(raw) as StoredRounds;
    if (!parsed || !Array.isArray(parsed.rounds)) return { rounds: [] };

    // Lightweight migration for older stored rounds.
    const rounds = parsed.rounds.map((r: any) => {
      if (!r || typeof r !== 'object') return r;
      if (!r.game) {
        // legacy = skins
        return { ...r, game: 'skins', stakeCents: typeof r.stakeCents === 'number' ? r.stakeCents : 500 };
      }
      if (r.game === 'skins') {
        return { ...r, stakeCents: typeof r.stakeCents === 'number' ? r.stakeCents : 500 };
      }
      if (r.game === 'wolf') {
        return {
          ...r,
          wolfPointsPerHole: typeof r.wolfPointsPerHole === 'number' ? r.wolfPointsPerHole : 1,
          wolfLoneMultiplier: typeof r.wolfLoneMultiplier === 'number' ? r.wolfLoneMultiplier : 2,
          wolfDollarsPerPointCents:
            typeof r.wolfDollarsPerPointCents === 'number'
              ? r.wolfDollarsPerPointCents
              : typeof r.dollarsPerPointCents === 'number'
                ? r.dollarsPerPointCents
                : 0,
          wolfStartingIndex: typeof r.wolfStartingIndex === 'number' ? r.wolfStartingIndex : 0,
          wolfPartnerByHole: r.wolfPartnerByHole && typeof r.wolfPartnerByHole === 'object' ? r.wolfPartnerByHole : {},
        };
      }
      return r;
    });

    return {
      activeRoundId: parsed.activeRoundId,
      rounds,
    };
  } catch {
    return { rounds: [] };
  }
}

export function saveRounds(data: StoredRounds) {
  const rounds = data.rounds
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, MAX);
  const payload: StoredRounds = {
    activeRoundId: data.activeRoundId,
    rounds,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function upsertRound(data: StoredRounds, round: Round): StoredRounds {
  const idx = data.rounds.findIndex((r) => r.id === round.id);
  const nextRounds = data.rounds.slice();
  if (idx >= 0) nextRounds[idx] = round;
  else nextRounds.push(round);
  return { ...data, rounds: nextRounds, activeRoundId: round.id };
}

export function deleteRound(data: StoredRounds, roundId: string): StoredRounds {
  const rounds = data.rounds.filter((r) => r.id !== roundId);
  const activeRoundId = data.activeRoundId === roundId ? rounds[0]?.id : data.activeRoundId;
  return { rounds, activeRoundId };
}
