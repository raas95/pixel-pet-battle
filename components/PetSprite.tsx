"use client";

import { useEffect, useRef } from "react";
import { GRID_SIZE, PetReaction } from "@/lib/pet";

type PetSpriteProps = {
  pixels: string[][];
  size?: number;
  reaction?: PetReaction;
  mood?: "senang" | "biasa" | "sedih";
  animated?: boolean;
  className?: string;
};

const REACTION_BADGE: Record<PetReaction, string | null> = {
  idle: null,
  happy: "✨",
  sad: "💧",
  eating: "🍖",
  playing: "🎵",
  sleeping: "Zzz",
};

export function PetSprite({
  pixels,
  size = 128,
  reaction = "idle",
  mood = "biasa",
  animated = true,
  className = "",
}: PetSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = pixels[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = row[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, [pixels]);

  let animClass = "";
  if (animated) {
    if (reaction === "happy") animClass = "animate-pet-happy";
    else if (reaction === "eating") animClass = "animate-pet-eating";
    else if (reaction === "playing") animClass = "animate-pet-playing";
    else if (reaction === "sleeping") animClass = "animate-pet-sleeping";
    else if (reaction === "sad" || mood === "sedih") animClass = "animate-pet-sad";
    else animClass = "animate-pet-idle";
  }

  const badge = REACTION_BADGE[reaction];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {badge && (
        <span
          aria-hidden="true"
          className="font-pixel absolute -top-3 right-0 z-10 animate-bounce rounded-md border-2 border-[#1e1b2e] bg-[#fef08a] px-1.5 py-0.5 text-xs font-bold text-[#1e1b2e] shadow-[2px_2px_0_#1e1b2e]"
        >
          {badge}
        </span>
      )}
      <canvas
        ref={canvasRef}
        width={GRID_SIZE}
        height={GRID_SIZE}
        aria-label="Sprite monster pixel"
        className={`pixelated block ${animClass}`}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

