"use client";

import { create } from "zustand";
import { DuelSnapshot, DuelView } from "@/lib/duelSync";

export type DuelChallenge = {
  duelId: string;
  fromName: string;
};

export type DuelDeclinedNotice = {
  opponentName: string;
};

type DuelStoreState = {
  incoming: DuelChallenge | null;
  duel: DuelView | null;
  declined: DuelDeclinedNotice | null;

  applySnapshot: (snapshot: DuelSnapshot, myDeviceId: string) => void;
  clearDuel: () => void;
  clearDeclined: () => void;
};

export const useDuelStore = create<DuelStoreState>((set, get) => ({
  incoming: null,
  duel: null,
  declined: null,

  applySnapshot: (snapshot, myDeviceId) => {
    const next: Partial<DuelStoreState> = {
      incoming: snapshot.incoming,
    };

    const duel = snapshot.duel;
    if (duel?.status === "declined") {
      // Hanya penantang (players[0]) yang perlu diberi tahu bahwa
      // tantangannya ditolak; si penolak sudah tahu karena dia yang menolak.
      if (duel.players[0]?.deviceId === myDeviceId) {
        next.declined = { opponentName: duel.players[1]?.name ?? "Lawan" };
      }
      next.duel = null;
    } else if (duel) {
      next.duel = duel;
    } else if (get().duel?.status === "finished") {
      // Server sudah membersihkan duel lama — pertahankan hasil akhir di
      // store agar layar hasil tidak hilang sebelum pengguna menutupnya.
      next.duel = get().duel ?? null;
    } else {
      next.duel = null;
    }

    set(next);
  },

  clearDuel: () => {
    set({ duel: null, incoming: null });
  },

  clearDeclined: () => {
    set({ declined: null });
  },
}));
