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
    return {
      activeRoundId: parsed.activeRoundId,
      rounds: parsed.rounds,
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
