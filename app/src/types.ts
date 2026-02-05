export type PlayerId = string;

export type Player = {
  id: PlayerId;
  name: string;
};

export type HoleNumber = number; // 1..18

export type GameType = 'skins' | 'wolf' | 'bbb';

export type BBBHoleAwards = {
  bingo: PlayerId | null;
  bango: PlayerId | null;
  bongo: PlayerId | null;
};

export type Round = {
  id: string;
  game: GameType;
  name: string;

  // Skins
  stakeCents?: number; // per skin

  // Wolf (4 players v1)
  wolfPointsPerHole?: number; // match-play points
  wolfLoneMultiplier?: number; // e.g. 2x
  wolfDollarsPerPointCents?: number; // optional: $ per point (money common)
  wolfStartingIndex?: number; // 0..3 (which player is Wolf on hole 1)
  wolfPartnerByHole?: Record<HoleNumber, PlayerId | null>; // partner id, or null for lone wolf

  // BBB (award-entry)
  bbbDollarsPerPointCents?: number; // optional: $ per point
  // Winner for each award per hole; use null when unknown/unclear.
  bbbAwardsByHole?: Record<HoleNumber, BBBHoleAwards>;

  players: Player[];
  strokesByHole: Record<HoleNumber, Record<PlayerId, number | null>>;
  createdAt: number;
  locked?: boolean;
};

export type SkinsHoleResult = {
  hole: HoleNumber;
  carrySkins: number;
  winnerId: PlayerId | null;
  wonSkins: number; // includes carry
};

export type SkinsSummary = {
  holeResults: SkinsHoleResult[];
  skinsWon: Record<PlayerId, number>;
  carryToNext: number;
};
