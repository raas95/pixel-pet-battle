"use client";

import { useEffect, useState } from "react";
import { challengePet } from "@/lib/duelSync";
import { LanNeighbor, usePetStore } from "@/store/usePetStore";
import { PetSprite } from "./PetSprite";

type WanderPos = {
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
};

const MOVE_DURATION_MS = 2_600;
const MAX_WANDERERS = 6;

function nextTarget(prev: WanderPos): WanderPos {
  const x = 6 + Math.random() * 78;
  return {
    x,
    y: 8 + Math.random() * 38,
    facing: x >= prev.x ? 1 : -1,
    moving: true,
  };
}

function Wanderer({
  neighbor,
  onSelect,
}: {
  neighbor: LanNeighbor;
  onSelect: (neighbor: LanNeighbor) => void;
}) {
  const [pos, setPos] = useState<WanderPos>(() => ({
    x: 8 + Math.random() * 68,
    y: 12 + Math.random() * 32,
    facing: 1,
    moving: false,
  }));

  useEffect(() => {
    let cancelled = false;
    let stopTimer = 0;
    let nextTimer = 0;

    const scheduleNext = (delay: number) => {
      nextTimer = window.setTimeout(() => {
        if (cancelled) return;
        setPos((prev) => nextTarget(prev));
        stopTimer = window.setTimeout(() => {
          if (!cancelled) setPos((prev) => ({ ...prev, moving: false }));
        }, MOVE_DURATION_MS + 150);
        scheduleNext(MOVE_DURATION_MS + 1_500 + Math.random() * 2_500);
      }, delay);
    };

    scheduleNext(600 + Math.random() * 1_200);
    return () => {
      cancelled = true;
      window.clearTimeout(stopTimer);
      window.clearTimeout(nextTimer);
    };
  }, []);

  const animClass = pos.moving
    ? "animate-pet-walk"
    : neighbor.mood === "sedih"
      ? "animate-pet-sad"
      : "animate-pet-idle";

  return (
    <div
      className="absolute -translate-x-1/2 transition-[left,top] ease-in-out"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transitionDuration: `${MOVE_DURATION_MS}ms`,
        zIndex: 5,
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(neighbor)}
        className="flex cursor-pointer flex-col items-center gap-0.5"
        aria-label={`Monster ${neighbor.name} — klik untuk opsi`}
      >
        <div style={{ transform: `scaleX(${pos.facing})` }}>
          <div className={animClass}>
            <PetSprite pixels={neighbor.pixels} size={60} animated={false} />
          </div>
        </div>
        <div className="-mt-0.5 h-1.5 w-9 rounded-full bg-[#1e1b2e]/15" />
        <span className="font-pixel rounded border-2 border-[#1e1b2e] bg-white/90 px-1.5 py-px text-[10px] font-bold leading-tight text-[#1e1b2e]">
          {neighbor.name}
        </span>
      </button>
    </div>
  );
}

export function NeighborWanderers() {
  const neighbors = usePetStore((state) => state.lanNeighbors);
  const myName = usePetStore((state) => state.pet.name);
  const [selected, setSelected] = useState<LanNeighbor | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (neighbors.length === 0 && !notice) return null;

  const handleChallenge = async (neighbor: LanNeighbor) => {
    setSending(true);
    const result = await challengePet({
      deviceId: neighbor.deviceId,
      name: neighbor.name,
      myName,
    });
    setSending(false);
    setSelected(null);
    setNotice(
      result.ok
        ? `⚔️ Tantangan terkirim ke ${neighbor.name}! Menunggu respons...`
        : `⚠️ ${result.error ?? "Tantangan gagal dikirim."}`
    );
    window.setTimeout(() => setNotice(null), 6_000);
  };

  return (
    <>
      {neighbors.slice(0, MAX_WANDERERS).map((neighbor) => (
        <Wanderer
          key={neighbor.deviceId}
          neighbor={neighbor}
          onSelect={setSelected}
        />
      ))}

      {selected && (
        <div className="absolute inset-x-0 top-2 z-30 flex justify-center px-3">
          <div className="pixel-card flex flex-wrap items-center justify-center gap-2 bg-white px-3 py-2">
            <span className="font-pixel text-xs font-bold text-[#1e1b2e]">
              ⚔️ Ajak <span className="text-[#4338ca]">{selected.name}</span>{" "}
              duel?
            </span>
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleChallenge(selected)}
              className="pixel-btn font-pixel bg-[#fde047] px-3 py-1 text-xs font-bold text-[#1e1b2e] disabled:opacity-50"
            >
              {sending ? "Mengirim..." : "Kirim Tantangan"}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="pixel-btn font-pixel bg-white px-3 py-1 text-xs font-bold text-[#1e1b2e]"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3">
          <div className="pixel-card bg-white/95 px-3 py-2">
            <span className="font-pixel text-xs font-bold text-[#1e1b2e]">
              {notice}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
