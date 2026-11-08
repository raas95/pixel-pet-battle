"use client";

import { create } from "zustand";
import { GameDifficulty, MAX_LIVES } from "@/lib/letters";
import {
  MiniGameResult,
  PetData,
  PetReaction,
  applyMiniGameReward,
  applyTimeDecay,
  createDefaultPet,
  feedPet,
  hasPaintedPixels,
  playWithPet,
  sanitizePetName,
  sleepPet,
} from "@/lib/pet";
import { loadPetData, resetPetData, savePetData } from "@/lib/storage";
import { LanSyncStatus, queueLanPush } from "@/lib/lanSync";

export type MiniGameState =
  | "MENUNGGU_MULAI"
  | "MEMUTAR_SUARA"
  | "MENUNGGU_JAWABAN"
  | "MEMPROSES_JAWABAN"
  | "RONDE_BERIKUTNYA"
  | "PERMAINAN_SELESAI";

export type MiniGameFeedback = {
  selected: string;
  target: string;
  correct: boolean;
};

export type MiniGameRewardSummary = {
  happinessGain: number;
  energyCost: number;
  isNewHighScore: boolean;
};

type MiniGameSnapshot = {
  gameState: MiniGameState;
  round: number;
  score: number;
  lives: number;
  currentOptions: string[];
  currentTarget: string | null;
  lastAnswerFeedback: MiniGameFeedback | null;
  gameOutcome: "won" | "lost" | null;
  audioFallbackUsed: boolean;
  gameHint: string | null;
};

type PetStoreState = {
  pet: PetData;
  hydrated: boolean;
  reaction: PetReaction;
  feedbackMessage: string | null;

  lanStatus: LanSyncStatus;
  lanPeers: number;

  gameState: MiniGameState;
  round: number;
  score: number;
  lives: number;
  currentOptions: string[];
  currentTarget: string | null;
  lastAnswerFeedback: MiniGameFeedback | null;
  gameOutcome: "won" | "lost" | null;
  lastReward: MiniGameRewardSummary | null;
  audioFallbackUsed: boolean;
  gameHint: string | null;
  difficulty: GameDifficulty;

  hydrate: () => void;
  syncTimeDecay: () => void;
  renamePet: (name: string) => void;
  updatePixels: (pixels: string[][]) => boolean;
  feed: () => void;
  playCare: () => void;
  sleep: () => void;
  clearReaction: () => void;
  resetAllData: () => void;

  setLanStatus: (status: LanSyncStatus, peers: number) => void;
  applyRemotePet: (pet: PetData) => void;

  resetMiniGameSession: () => void;
  setMiniGameSnapshot: (patch: Partial<MiniGameSnapshot>) => void;
  completeMiniGame: (result: MiniGameResult) => void;
  setDifficulty: (diff: GameDifficulty) => void;
};

const INITIAL_GAME_STATE = {
  gameState: "MENUNGGU_MULAI" as MiniGameState,
  round: 1,
  score: 0,
  lives: MAX_LIVES,
  currentOptions: [] as string[],
  currentTarget: null as string | null,
  lastAnswerFeedback: null as MiniGameFeedback | null,
  gameOutcome: null as "won" | "lost" | null,
  lastReward: null as MiniGameRewardSummary | null,
  audioFallbackUsed: false,
  gameHint: null as string | null,
  difficulty: "santai" as GameDifficulty,
};

export const usePetStore = create<PetStoreState>((set, get) => ({
  pet: createDefaultPet(0),
  hydrated: false,
  reaction: "idle",
  feedbackMessage: null,

  lanStatus: "offline",
  lanPeers: 0,

  ...INITIAL_GAME_STATE,

  hydrate: () => {
    const loaded = loadPetData(Date.now());
    set({
      pet: loaded,
      hydrated: true,
    });
  },

  syncTimeDecay: () => {
    if (!get().hydrated) return;
    const current = get().pet;
    const decayed = applyTimeDecay(current, Date.now());
    if (decayed !== current) {
      savePetData(decayed);
      queueLanPush(decayed);
      set({ pet: decayed });
    }
  },

  renamePet: (name: string) => {
    const current = get().pet;
    const sanitized = sanitizePetName(name);
    const updated: PetData = {
      ...current,
      name: sanitized,
      updatedAt: Date.now(),
    };
    savePetData(updated);
    queueLanPush(updated);
    set({
      pet: updated,
      reaction: "happy",
      feedbackMessage: `Nama monster diubah menjadi ${sanitized}!`,
    });
  },

  updatePixels: (pixels: string[][]) => {
    if (!hasPaintedPixels(pixels)) {
      return false;
    }
    const current = get().pet;
    const cloned = pixels.map((row) => [...row]);
    const updated: PetData = {
      ...current,
      pixels: cloned,
      updatedAt: Date.now(),
    };
    savePetData(updated);
    queueLanPush(updated);
    set({
      pet: updated,
      reaction: "happy",
      feedbackMessage: `Tampilan ${updated.name} berhasil disimpan!`,
    });
    return true;
  },

  feed: () => {
    const result = feedPet(get().pet, Date.now());
    if (result.changed) {
      savePetData(result.pet);
      queueLanPush(result.pet);
    }
    set({
      pet: result.pet,
      reaction: result.reaction,
      feedbackMessage: result.message,
    });
  },

  playCare: () => {
    const result = playWithPet(get().pet, Date.now());
    if (result.changed) {
      savePetData(result.pet);
      queueLanPush(result.pet);
    }
    set({
      pet: result.pet,
      reaction: result.reaction,
      feedbackMessage: result.message,
    });
  },

  sleep: () => {
    const result = sleepPet(get().pet, Date.now());
    if (result.changed) {
      savePetData(result.pet);
      queueLanPush(result.pet);
    }
    set({
      pet: result.pet,
      reaction: result.reaction,
      feedbackMessage: result.message,
    });
  },

  clearReaction: () => {
    set({ reaction: "idle" });
  },

  resetAllData: () => {
    const fresh = resetPetData(Date.now());
    queueLanPush(fresh);
    set({
      pet: fresh,
      hydrated: true,
      reaction: "idle",
      feedbackMessage: "Data monster berhasil direset ke awal.",
      ...INITIAL_GAME_STATE,
    });
  },

  setLanStatus: (status, peers) => {
    set({ lanStatus: status, lanPeers: peers });
  },

  applyRemotePet: (pet) => {
    const decayed = applyTimeDecay(pet, Date.now());
    savePetData(decayed);
    set({ pet: decayed, hydrated: true });
  },

  resetMiniGameSession: () => {
    set((state) => ({ ...INITIAL_GAME_STATE, difficulty: state.difficulty }));
  },

  setDifficulty: (difficulty: GameDifficulty) => {
    set({ difficulty });
  },

  setMiniGameSnapshot: (patch) => {
    set((state) => ({
      ...state,
      ...patch,
    }));
  },

  completeMiniGame: (result: MiniGameResult) => {
    const { pet, happinessGain, energyCost, isNewHighScore } =
      applyMiniGameReward(get().pet, result, Date.now());
    savePetData(pet);
    queueLanPush(pet);
    set({
      pet,
      gameState: "PERMAINAN_SELESAI",
      gameOutcome: result.won ? "won" : "lost",
      score: result.score,
      lives: result.livesRemaining,
      lastReward: {
        happinessGain,
        energyCost,
        isNewHighScore,
      },
    });
  },
}));
