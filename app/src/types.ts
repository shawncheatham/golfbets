export type PlayerId = string;

export type Player = {
  id: PlayerId;
  name: string;
};

export type HoleNumber = number; // 1..18

export type Round = {
  id: string;
  name: string;
  stakeCents: number; // per skin
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
