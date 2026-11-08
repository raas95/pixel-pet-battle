"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameController } from "@/game/createGame";
import { usePetStore } from "@/store/usePetStore";

type GameCanvasProps = {
  onControllerReady?: (controller: MiniGameController | null) => void;
};

export function GameCanvas({ onControllerReady }: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<MiniGameController | null>(null);
  const onControllerReadyRef = useRef(onControllerReady);
  onControllerReadyRef.current = onControllerReady;

  const hydrated = usePetStore((state) => state.hydrated);
  const petPixels = usePetStore((state) => state.pet.pixels);
  const gameState = usePetStore((state) => state.gameState);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!hydrated || !containerRef.current) return;

    let disposed = false;

    const initPhaser = async () => {
      const { createGame } = await import("@/game/createGame");
      if (disposed || !containerRef.current) return;

      const controller = createGame(containerRef.current);
      if (disposed) {
        controller.destroy();
        return;
      }

      controllerRef.current = controller;
      onControllerReadyRef.current?.(controller);
      setIsReady(true);
    };

    void initPhaser();

    return () => {
      disposed = true;
      setIsReady(false);
      onControllerReadyRef.current?.(null);
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, [hydrated]);

  // Keep Phaser pet texture synced if pixels change
  useEffect(() => {
    if (isReady && controllerRef.current) {
      controllerRef.current.updatePetPixels(petPixels);
    }
  }, [isReady, petPixels]);

  return (
    <div className="relative overflow-hidden rounded-xl border-[3px] border-[#1e1b2e] bg-[#dbeafe] shadow-[4px_4px_0_#1e1b2e]">
      <div
        ref={containerRef}
        className="aspect-[2/1] w-full [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full"
      />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#dbeafe]">
          <span className="font-pixel text-sm font-bold text-[#1e1b2e]">
            Menyiapkan arena mini-game...
          </span>
        </div>
      )}

      {isReady && gameState === "MENUNGGU_MULAI" && (
        <div className="absolute inset-0 flex flex-col items-center justify-end bg-[#1e1b2e]/15 p-4 sm:p-6">
          <button
            type="button"
            onClick={() => controllerRef.current?.startGame()}
            className="pixel-btn font-pixel bg-[#fde047] px-8 py-3 text-base font-extrabold text-[#1e1b2e] sm:text-lg"
          >
            ▶ Mulai Permainan
          </button>
        </div>
      )}
    </div>
  );
}
