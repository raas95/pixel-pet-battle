"use client";

import { usePetStore } from "@/store/usePetStore";
import {
  getHappinessLabel,
  getHungerLabel,
  getEnergyLabel,
} from "@/lib/pet";
import { PetSprite } from "./PetSprite";

export function NeighborPets() {
  const neighbors = usePetStore((state) => state.lanNeighbors);
  const lanStatus = usePetStore((state) => state.lanStatus);

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
              <div className="min-w-0">
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
