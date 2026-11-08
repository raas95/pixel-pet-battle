"use client";

import Link from "next/link";
import { useState } from "react";
import { NeighborPets } from "@/components/NeighborPets";
import { PetSprite } from "@/components/PetSprite";
import { PetStatus } from "@/components/PetStatus";
import { getPetMood } from "@/lib/pet";
import { usePetStore } from "@/store/usePetStore";

export default function HomePage() {
  const pet = usePetStore((state) => state.pet);
  const hydrated = usePetStore((state) => state.hydrated);
  const resetAllData = usePetStore((state) => state.resetAllData);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);

  const mood = getPetMood(pet);

  return (
    <div className="space-y-6">
      {/* Hero Showcase */}
      <section className="pixel-card overflow-hidden p-5 sm:p-7">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <div className="inline-block rounded-md border-2 border-[#1e1b2e] bg-[#fde047] px-3 py-1 font-pixel text-xs font-bold">
              GAME VIRTUAL PET PIXEL
            </div>
            <h1 className="font-pixel text-2xl font-extrabold leading-snug text-[#1e1b2e] sm:text-3xl">
              Halo, {hydrated ? pet.name : "Piko"} siap bermain bersamamu!
            </h1>
            <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
              Gambar monster pixel buatanmu sendiri, jaga kondisi lapar, bahagia,
              serta energinya, lalu uji refleksmu di mini-game suara huruf A–Z!
            </p>

            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                href="/pet"
                className="pixel-btn font-pixel bg-[#4ade80] px-5 py-3 text-sm font-bold text-[#1e1b2e] no-underline"
              >
                🐾 Rawat Monster
              </Link>
              <Link
                href="/play"
                className="pixel-btn font-pixel bg-[#fde047] px-5 py-3 text-sm font-bold text-[#1e1b2e] no-underline"
              >
                🎮 Main Mini-Game
              </Link>
              <Link
                href="/pet/draw"
                className="pixel-btn font-pixel bg-[#e0e7ff] px-5 py-3 text-sm font-bold text-[#1e1b2e] no-underline"
              >
                🎨 Gambar Monster
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border-[3px] border-[#1e1b2e] bg-gradient-to-b from-[#dbeafe] via-[#eff6ff] to-[#bbf7d0] p-5 shadow-[3px_3px_0_#1e1b2e]">
            <PetSprite
              pixels={pet.pixels}
              size={144}
              mood={mood}
              reaction={mood === "senang" ? "happy" : "idle"}
              animated
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="font-pixel rounded border-2 border-[#1e1b2e] bg-white px-2.5 py-0.5 text-xs font-bold">
                {pet.name}
              </span>
              <span className="font-pixel rounded border-2 border-[#1e1b2e] bg-[#fef08a] px-2.5 py-0.5 text-xs font-bold">
                Skor Terbaik: {pet.highScore}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Current Pet Status Preview */}
      <PetStatus pet={pet} compact />

      {/* Game Flow Guide */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="pixel-card space-y-2 p-4">
          <div className="font-pixel text-sm font-bold text-[#4338ca]">
            1. Gambar Pixel
          </div>
          <p className="text-xs leading-relaxed text-slate-700">
            Buka editor 32 × 32 untuk menggambar monstermu sendiri dengan pensil,
            penghapus, fill warna, dan undo.
          </p>
        </div>
        <div className="pixel-card space-y-2 p-4">
          <div className="font-pixel text-sm font-bold text-[#15803d]">
            2. Rawat Monster
          </div>
          <p className="text-xs leading-relaxed text-slate-700">
            Beri makan, ajak bermain, dan tidurkan monster supaya tetap bugar dan
            bahagia setiap saat.
          </p>
        </div>
        <div className="pixel-card space-y-2 p-4">
          <div className="font-pixel text-sm font-bold text-[#b45309]">
            3. Mini-Game Suara
          </div>
          <p className="text-xs leading-relaxed text-slate-700">
            Dengarkan instruksi huruf, pilih dari 4 tombol di layar atau keyboard.
            Selesaikan 10 ronde dengan 3 nyawa!
          </p>
        </div>
      </section>

      {/* Neighbor Monsters on the Same Network */}
      <NeighborPets />

      {/* Local Data Reset Utility (Testing / Fresh Start) */}
      <section className="pixel-card flex flex-wrap items-center justify-between gap-3 bg-[#fffaf0] p-4">
        <div className="space-y-0.5">
          <h2 className="font-pixel text-sm font-bold text-[#1e1b2e]">
            Penyimpanan Lokal Browser
          </h2>
          <p className="text-xs text-slate-600">
            Data monster tersimpan otomatis di browser ini. Gunakan tombol reset
            untuk memulai ulang dari awal.
          </p>
          {resetNotice && (
            <p className="text-xs font-bold text-emerald-700" role="status">
              Data monster berhasil dikembalikan ke setelan awal!
            </p>
          )}
        </div>

        {!confirmReset ? (
          <button
            type="button"
            onClick={() => {
              setConfirmReset(true);
              setResetNotice(false);
            }}
            className="pixel-btn font-pixel bg-[#fee2e2] px-3.5 py-2 text-xs font-bold text-[#991b1b]"
          >
            🔄 Reset Data
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                resetAllData();
                setConfirmReset(false);
                setResetNotice(true);
              }}
              className="pixel-btn font-pixel bg-[#ef4444] px-3.5 py-2 text-xs font-bold text-white"
            >
              Ya, Reset Sekarang
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="pixel-btn font-pixel bg-white px-3.5 py-2 text-xs font-bold text-[#1e1b2e]"
            >
              Batal
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

