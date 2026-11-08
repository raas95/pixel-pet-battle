"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PetActions } from "@/components/PetActions";
import { NeighborPets } from "@/components/NeighborPets";
import { PetSprite } from "@/components/PetSprite";
import { PetStatus } from "@/components/PetStatus";
import { getPetMood } from "@/lib/pet";
import { usePetStore } from "@/store/usePetStore";

export default function PetCarePage() {
  const pet = usePetStore((state) => state.pet);
  const hydrated = usePetStore((state) => state.hydrated);
  const reaction = usePetStore((state) => state.reaction);
  const renamePet = usePetStore((state) => state.renamePet);

  const [nameInput, setNameInput] = useState(pet.name);
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (hydrated && !editingName) {
      setNameInput(pet.name);
    }
  }, [hydrated, pet.name, editingName]);

  const mood = getPetMood(pet);

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    renamePet(nameInput);
    setEditingName(false);
  };

  return (
    <div className="space-y-6">
      {/* Stage & Name Header */}
      <section className="pixel-card overflow-hidden p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {!editingName ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-pixel text-xl font-extrabold text-[#1e1b2e] sm:text-2xl">
                {pet.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(pet.name);
                  setEditingName(true);
                }}
                className="pixel-btn font-pixel bg-white px-2.5 py-1 text-xs font-bold"
              >
                ✏️ Ubah Nama
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleRenameSubmit}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                type="text"
                maxLength={20}
                aria-label="Nama monster"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-white px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#fde047]"
                autoFocus
              />
              <button
                type="submit"
                className="pixel-btn font-pixel bg-[#4ade80] px-3 py-1.5 text-xs font-bold"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="pixel-btn font-pixel bg-white px-3 py-1.5 text-xs font-bold"
              >
                Batal
              </button>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/pet/draw"
              className="pixel-btn font-pixel bg-[#e0e7ff] px-3.5 py-2 text-xs font-bold text-[#1e1b2e] no-underline"
            >
              🎨 Gambar Ulang
            </Link>
            <Link
              href="/play"
              className="pixel-btn font-pixel bg-[#fde047] px-3.5 py-2 text-xs font-bold text-[#1e1b2e] no-underline"
            >
              🎮 Main Mini-Game
            </Link>
          </div>
        </div>

        {/* Monster Room Stage */}
        <div className="relative flex min-h-[240px] flex-col items-center justify-center rounded-xl border-[3px] border-[#1e1b2e] bg-gradient-to-b from-[#dbeafe] via-[#eff6ff] to-[#86efac] p-6">
          <div className="mb-2 flex items-center justify-center">
            <PetSprite
              pixels={pet.pixels}
              size={160}
              reaction={reaction}
              mood={mood}
              animated
            />
          </div>
          <div
            aria-hidden="true"
            className="-mt-2 h-4 w-28 rounded-full bg-[#1e1b2e]/20"
          />
          <p className="font-pixel mt-4 rounded-md border-2 border-[#1e1b2e] bg-white/90 px-3 py-1 text-xs font-bold text-[#1e1b2e]">
            Suasana hati:{" "}
            {mood === "senang"
              ? "Senang dan bersemangat!"
              : mood === "biasa"
                ? "Tenang dan santai"
                : "Sedih, butuh perawatanmu!"}
          </p>
        </div>
      </section>

      {/* Status Bars */}
      <PetStatus pet={pet} />

      {/* Care Buttons */}
      <PetActions />

      {/* Neighbor Monsters on the Same Network */}
      <NeighborPets />
    </div>
  );
}

