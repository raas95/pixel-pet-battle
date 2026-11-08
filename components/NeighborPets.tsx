"use client";

import { useState } from "react";
import { usePetStore } from "@/store/usePetStore";
import { challengePet } from "@/lib/duelSync";
import {
  getHappinessLabel,
  getHungerLabel,
  getEnergyLabel,
} from "@/lib/pet";
import { PetSprite } from "./PetSprite";

export function NeighborPets() {
  const neighbors = usePetStore((state) => state.lanNeighbors);
  const lanStatus = usePetStore((state) => state.lanStatus);
  const myName = usePetStore((state) => state.pet.name);
  const [notice, setNotice] = useState<string | null>(null);

  const handleChallenge = async (deviceId: string, name: string) => {
    const result = await challengePet({ deviceId, name, myName });
    setNotice(
      result.ok
        ? `⚔️ Tantangan terkirim ke ${name}! Menunggu respons...`
        : `⚠️ ${result.error ?? "Tantangan gagal dikirim."}`
    );
    window.setTimeout(() => setNotice(null), 6_000);
  };

  return (
    <section className="pixel-card p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-pixel text-base font-extrabold text-[#1e1b2e] sm:text-lg">
          👥 Monster Tetangga
        </h2>
        <span className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-[#eef2ff] px-2 py-0.5 text-xs font-bold text-[#1e1b2e]">
          {neighbors.length > 0
            ? `${neighbors.length} online`
            : lanStatus === "online"
              ? "0 online"
              : "LAN off"}
        </span>
      </div>

      {notice && (
        <p className="font-pixel mb-3 rounded-md border-2 border-[#1e1b2e] bg-[#fef9c3] px-3 py-1.5 text-xs font-bold text-[#1e1b2e]">
          {notice}
        </p>
      )}

      {neighbors.length === 0 ? (
        <p className="text-sm font-medium text-slate-600">
          {lanStatus === "online"
            ? "Belum ada monster tetangga yang online. Buka aplikasi ini dari device lain di WiFi yang sama — pet mereka akan muncul di sini."
            : "Sinkronisasi LAN tidak aktif. Buka aplikasi lewat IP jaringan (bukan localhost) agar bisa melihat monster dari device lain."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {neighbors.map((neighbor) => (
            <li
              key={neighbor.deviceId}
              className="flex items-center gap-3 rounded-xl border-2 border-[#1e1b2e] bg-white p-3 shadow-[3px_3px_0_#1e1b2e]"
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border-2 border-[#1e1b2e] bg-[#eff6ff]">
                <PetSprite
                  pixels={neighbor.pixels}
                  size={64}
                  mood={neighbor.mood}
                  animated
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-pixel truncate text-sm font-extrabold text-[#1e1b2e]">
                  {neighbor.name}
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Lapar: {getHungerLabel(neighbor.hunger)}
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Hati: {getHappinessLabel(neighbor.happiness)}
                </div>
                <div className="text-xs font-medium text-slate-600">
                  Energi: {getEnergyLabel(neighbor.energy)}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void handleChallenge(neighbor.deviceId, neighbor.name)
                  }
                  className="pixel-btn font-pixel mt-1.5 bg-[#fde047] px-2 py-0.5 text-[11px] font-bold text-[#1e1b2e]"
                >
                  ⚔️ Duel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
