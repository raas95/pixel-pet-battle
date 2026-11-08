"use client";

import { useEffect, useState } from "react";
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

function Wanderer({ neighbor }: { neighbor: LanNeighbor }) {
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
      className="pointer-events-none absolute -translate-x-1/2 transition-[left,top] ease-in-out"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transitionDuration: `${MOVE_DURATION_MS}ms`,
        zIndex: 5,
      }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div style={{ transform: `scaleX(${pos.facing})` }}>
          <div className={animClass}>
            <PetSprite pixels={neighbor.pixels} size={60} animated={false} />
          </div>
        </div>
        <div className="-mt-0.5 h-1.5 w-9 rounded-full bg-[#1e1b2e]/15" />
        <span className="font-pixel rounded border-2 border-[#1e1b2e] bg-white/90 px-1.5 py-px text-[10px] font-bold leading-tight text-[#1e1b2e]">
          {neighbor.name}
        </span>
      </div>
    </div>
  );
}

export function NeighborWanderers() {
  const neighbors = usePetStore((state) => state.lanNeighbors);

  if (neighbors.length === 0) return null;

  return (
    <>
      {neighbors.slice(0, MAX_WANDERERS).map((neighbor) => (
        <Wanderer key={neighbor.deviceId} neighbor={neighbor} />
      ))}
    </>
  );
}
