export const DUEL_MAX_HP = 100;
export const DUEL_DAMAGE = 20;
export const DUEL_CHARGE_NEEDED = 3;
export const DUEL_ROUND_MS = 12_000;
export const DUEL_PENDING_EXPIRY_MS = 30_000;
export const DUEL_FINISHED_RETENTION_MS = 60_000;

export type DuelPlayer = {
  deviceId: string;
  name: string;
  hp: number;
  streak: number;
  answer: string | null;
};

export type DuelEvent = {
  type: "none" | "collision" | "hit";
  byDeviceId: string | null;
  round: number;
};

export type Duel = {
  id: string;
  status: "pending" | "active" | "finished" | "declined";
  players: [DuelPlayer, DuelPlayer];
  round: number;
  /** Perintah huruf per pemain — commands[0] untuk players[0], berbeda satu sama lain. */
  commands: [string | null, string | null];
  roundEndsAt: number | null;
  winner: string | null;
  lastEvent: DuelEvent | null;
  updatedAt: number;
};
