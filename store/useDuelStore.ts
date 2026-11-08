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

export type DuelAbandonedNotice = {
  message: string;
};

type DuelStoreState = {
  incoming: DuelChallenge | null;
  duel: DuelView | null;
  declined: DuelDeclinedNotice | null;
  abandoned: DuelAbandonedNotice | null;
  /** True setelah snapshot polling pertama diteruskan ke store. */
  firstSyncDone: boolean;

  applySnapshot: (snapshot: DuelSnapshot, myDeviceId: string) => void;
  clearDuel: () => void;
  clearDeclined: () => void;
  clearAbandoned: () => void;
};

export const useDuelStore = create<DuelStoreState>((set, get) => ({
  incoming: null,
  duel: null,
  declined: null,
  abandoned: null,
  firstSyncDone: false,

  applySnapshot: (snapshot, myDeviceId) => {
    const next: Partial<DuelStoreState> = {
      incoming: snapshot.incoming,
      firstSyncDone: true,
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
      // Snapshot kosong diteruskan ke sini hanya setelah hysteresis
      // duelSync lewati — artinya duel benar-benar tidak ada lagi di server.
      if (get().duel?.status === "active") {
        next.abandoned = {
          message:
            "Koneksi duel terputus: server tidak lagi menyimpan duel ini setelah beberapa kali percobaan.",
        };
      }
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

  clearAbandoned: () => {
    set({ abandoned: null });
  },
}));
