"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPetMood } from "@/lib/pet";
import { usePetStore } from "@/store/usePetStore";
import { PetSprite } from "./PetSprite";

type StagePos = {
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
};

const MOVE_DURATION_MS = 2_600;
const MIN_X = 10;
const MAX_X = 88;
// Stage ±280px tinggi dan sprite utama ±180px, sehingga rentang vertikal
// perjalanan sengaja dibatasi agar sprite tidak terpotong tepi panggung.
const MIN_Y = 4;
const MAX_Y = 32;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nextTarget(prev: StagePos): StagePos {
  const x = MIN_X + Math.random() * (MAX_X - MIN_X);
  return {
    x,
    y: MIN_Y + Math.random() * (MAX_Y - MIN_Y),
    facing: x >= prev.x ? 1 : -1,
    moving: true,
  };
}

export function StagePet() {
  const pet = usePetStore((state) => state.pet);
  const reaction = usePetStore((state) => state.reaction);
  const mood = getPetMood(pet);

  const [pos, setPos] = useState<StagePos>({
    x: 50,
    y: 28,
    facing: 1,
    moving: false,
  });
  const [dragging, setDragging] = useState(false);

  const posRef = useRef(pos);
  posRef.current = pos;
  const stageElRef = useRef<HTMLElement | null>(null);
  const dragOffsetRef = useRef({ dx: 0, dy: 0 });
  const timersRef = useRef<{ stop: number; next: number }>({
    stop: 0,
    next: 0,
  });

  const clearTimers = useCallback(() => {
    window.clearTimeout(timersRef.current.stop);
    window.clearTimeout(timersRef.current.next);
  }, []);

  const scheduleWander = useCallback(
    (delay: number) => {
      clearTimers();
      timersRef.current.next = window.setTimeout(() => {
        setPos((prev) => nextTarget(prev));
        timersRef.current.stop = window.setTimeout(() => {
          setPos((prev) => ({ ...prev, moving: false }));
        }, MOVE_DURATION_MS + 150);
        scheduleWander(MOVE_DURATION_MS + 1_800 + Math.random() * 2_200);
      }, delay);
    },
    [clearTimers]
  );

  // Berjalan sendiri hanya saat reaksi sedang idle dan tidak sedang di-drag.
  useEffect(() => {
    if (dragging || reaction !== "idle") {
      clearTimers();
      setPos((prev) => ({ ...prev, moving: false }));
      return;
    }
    scheduleWander(1_000 + Math.random() * 1_500);
    return clearTimers;
  }, [dragging, reaction, scheduleWander, clearTimers]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const stage = e.currentTarget.closest("[data-stage]");
    if (!stage) return;
    stageElRef.current = stage as HTMLElement;
    const rect = stageElRef.current.getBoundingClientRect();
    const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
    dragOffsetRef.current = {
      dx: posRef.current.x - pointerX,
      dy: posRef.current.y - pointerY,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const stage = stageElRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
    const x = clamp(pointerX + dragOffsetRef.current.dx, MIN_X, MAX_X);
    const y = clamp(pointerY + dragOffsetRef.current.dy, MIN_Y, MAX_Y);
    setPos((prev) => ({
      ...prev,
      x,
      y,
      moving: true,
      facing: x >= prev.x ? 1 : -1,
    }));
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  const showReaction = reaction !== "idle";
  const animClass = dragging
    ? "animate-pet-walk"
    : pos.moving
      ? "animate-pet-walk"
      : mood === "sedih"
        ? "animate-pet-sad"
        : "animate-pet-idle";

  return (
    <div
      className="absolute -translate-x-1/2 transition-[left,top] ease-in-out"
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transitionDuration: dragging ? "0ms" : `${MOVE_DURATION_MS}ms`,
        zIndex: 10,
      }}
    >
      <div className="flex flex-col items-center">
        <div
          role="img"
          aria-label={`Monster ${pet.name} — bisa di-drag ke mana saja di panggung`}
          className="cursor-grab touch-none active:cursor-grabbing"
          style={{ transform: `scaleX(${pos.facing})` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {showReaction ? (
            <PetSprite
              pixels={pet.pixels}
              size={160}
              reaction={reaction}
              mood={mood}
              animated
            />
          ) : (
            <div className={animClass}>
              <PetSprite pixels={pet.pixels} size={160} animated={false} />
            </div>
          )}
        </div>
        <div className="-mt-1 h-4 w-28 rounded-full bg-[#1e1b2e]/20" />
      </div>
    </div>
  );
}
