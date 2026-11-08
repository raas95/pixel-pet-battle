"use client";

import { useEffect } from "react";
import { usePetStore } from "@/store/usePetStore";

export function PetActions() {
  const pet = usePetStore((state) => state.pet);
  const reaction = usePetStore((state) => state.reaction);
  const feedbackMessage = usePetStore((state) => state.feedbackMessage);
  const feed = usePetStore((state) => state.feed);
  const playCare = usePetStore((state) => state.playCare);
  const sleep = usePetStore((state) => state.sleep);
  const clearReaction = usePetStore((state) => state.clearReaction);

  useEffect(() => {
    if (reaction === "idle") return;
    const timer = window.setTimeout(() => {
      clearReaction();
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [reaction, clearReaction]);

  return (
    <div className="pixel-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-pixel text-base font-bold text-[#1e1b2e] sm:text-lg">
          Tindakan Perawatan
        </h2>
        <span className="text-xs font-medium text-slate-500">
          Pilih aksi untuk merawat {pet.name}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={feed}
          className="pixel-btn flex flex-col items-center justify-center gap-1 bg-[#bbf7d0] px-4 py-3 text-[#1e1b2e]"
        >
          <span className="text-2xl" aria-hidden="true">
            🍖
          </span>
          <span className="font-pixel text-sm font-bold">Beri Makan</span>
          <span className="text-[11px] font-medium text-emerald-900">
            +25 Kenyang, +5 Bahagia
          </span>
        </button>

        <button
          type="button"
          onClick={playCare}
          className="pixel-btn flex flex-col items-center justify-center gap-1 bg-[#fde047] px-4 py-3 text-[#1e1b2e]"
        >
          <span className="text-2xl" aria-hidden="true">
            ⚽
          </span>
          <span className="font-pixel text-sm font-bold">Ajak Bermain</span>
          <span className="text-[11px] font-medium text-amber-950">
            +20 Bahagia, -15 Energi
          </span>
        </button>

        <button
          type="button"
          onClick={sleep}
          className="pixel-btn flex flex-col items-center justify-center gap-1 bg-[#c7d2fe] px-4 py-3 text-[#1e1b2e]"
        >
          <span className="text-2xl" aria-hidden="true">
            💤
          </span>
          <span className="font-pixel text-sm font-bold">Tidur / Istirahat</span>
          <span className="text-[11px] font-medium text-indigo-950">
            +35 Energi
          </span>
        </button>
      </div>

      {feedbackMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border-2 border-[#1e1b2e] bg-[#fef9c3] px-3.5 py-2.5 text-sm font-semibold text-[#1e1b2e]"
        >
          {feedbackMessage}
        </div>
      )}
    </div>
  );
}

