"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/device";
import { respondDuel, startDuelSync } from "@/lib/duelSync";
import { useDuelStore } from "@/store/useDuelStore";

export function DuelManager() {
  const router = useRouter();
  const pathname = usePathname();

  const incoming = useDuelStore((state) => state.incoming);
  const duel = useDuelStore((state) => state.duel);
  const declined = useDuelStore((state) => state.declined);
  const clearDeclined = useDuelStore((state) => state.clearDeclined);

  useEffect(() => {
    const myDeviceId = getDeviceId();
    return startDuelSync((snapshot) =>
      useDuelStore.getState().applySnapshot(snapshot, myDeviceId)
    );
  }, []);

  // Kedua pemain dibawa ke arena duel begitu duel aktif.
  useEffect(() => {
    if (duel?.status === "active" && pathname !== "/duel") {
      router.push("/duel");
    }
    if (!duel && pathname === "/duel") {
      router.push("/");
    }
  }, [duel, pathname, router]);

  if (incoming) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1e1b2e]/50 p-4">
        <div className="pixel-card w-full max-w-sm space-y-4 bg-white p-5 text-center">
          <div className="font-pixel text-lg font-extrabold text-[#1e1b2e]">
            ⚔️ Tantangan Duel!
          </div>
          <p className="text-sm font-medium text-slate-700">
            <span className="font-bold">{incoming.fromName}</span> mengajak
            monster kamu berduel. Terima tantangannya?
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => void respondDuel(incoming.duelId, true)}
              className="pixel-btn font-pixel bg-[#4ade80] px-4 py-2 text-xs font-bold text-[#1e1b2e]"
            >
              ⚔️ Terima
            </button>
            <button
              type="button"
              onClick={() => void respondDuel(incoming.duelId, false)}
              className="pixel-btn font-pixel bg-[#fee2e2] px-4 py-2 text-xs font-bold text-[#991b1b]"
            >
              🙅 Tolak
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1e1b2e]/50 p-4">
        <div className="pixel-card w-full max-w-sm space-y-4 bg-white p-5 text-center">
          <div className="font-pixel text-lg font-extrabold text-[#1e1b2e]">
            🙅 Duel Ditolak
          </div>
          <p className="text-sm font-medium text-slate-700">
            <span className="font-bold">{declined.opponentName}</span> menolak
            tantangan duelmu. Duel dibatalkan.
          </p>
          <button
            type="button"
            onClick={clearDeclined}
            className="pixel-btn font-pixel bg-[#fde047] px-4 py-2 text-xs font-bold text-[#1e1b2e]"
          >
            OK
          </button>
        </div>
      </div>
    );
  }

  return null;
}
