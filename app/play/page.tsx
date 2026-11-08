"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { LetterButtons } from "@/components/LetterButtons";
import type { MiniGameController } from "@/game/createGame";
import { MAX_LIVES, TOTAL_ROUNDS } from "@/lib/letters";
import { usePetStore } from "@/store/usePetStore";

const GameCanvas = dynamic(
  () => import("@/components/GameCanvas").then((mod) => mod.GameCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-[2/1] w-full items-center justify-center rounded-xl border-[3px] border-[#1e1b2e] bg-[#dbeafe] shadow-[4px_4px_0_#1e1b2e]">
        <span className="font-pixel text-sm font-bold text-[#1e1b2e]">
          Memuat kanvas permainan...
        </span>
      </div>
    ),
  }
);

export default function PlayMiniGamePage() {
  const [controller, setController] = useState<MiniGameController | null>(null);
  const [showTextAssist, setShowTextAssist] = useState(false);

  const pet = usePetStore((state) => state.pet);
  const gameState = usePetStore((state) => state.gameState);
  const round = usePetStore((state) => state.round);
  const score = usePetStore((state) => state.score);
  const lives = usePetStore((state) => state.lives);
  const currentTarget = usePetStore((state) => state.currentTarget);
  const gameOutcome = usePetStore((state) => state.gameOutcome);
  const lastReward = usePetStore((state) => state.lastReward);
  const audioFallbackUsed = usePetStore((state) => state.audioFallbackUsed);
  const gameHint = usePetStore((state) => state.gameHint);

  const isRoundActive =
    gameState === "MEMUTAR_SUARA" ||
    gameState === "MENUNGGU_JAWABAN" ||
    gameState === "MEMPROSES_JAWABAN";

  const showPromptText =
    (showTextAssist || audioFallbackUsed) && currentTarget && isRoundActive;

  return (
    <div className="space-y-5">
      {/* Top HUD */}
      <section className="pixel-card flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-lg border-2 border-[#1e1b2e] bg-[#eef2ff] px-3 py-1.5">
            <span className="font-pixel text-xs font-bold text-slate-600">
              RONDE{" "}
            </span>
            <span className="font-pixel text-sm font-extrabold text-[#1e1b2e]">
              {round}/{TOTAL_ROUNDS}
            </span>
          </div>

          <div className="rounded-lg border-2 border-[#1e1b2e] bg-[#fef08a] px-3 py-1.5">
            <span className="font-pixel text-xs font-bold text-slate-700">
              SKOR{" "}
            </span>
            <span className="font-pixel text-sm font-extrabold text-[#1e1b2e]">
              {score}
            </span>
          </div>

          <div className="rounded-lg border-2 border-[#1e1b2e] bg-white px-3 py-1.5">
            <span className="font-pixel text-xs font-bold text-slate-600">
              REKOR{" "}
            </span>
            <span className="font-pixel text-sm font-extrabold text-[#1e1b2e]">
              {pet.highScore}
            </span>
          </div>
        </div>

        <div
          aria-label={`Sisa nyawa ${lives} dari ${MAX_LIVES}`}
          className="flex items-center gap-1.5 rounded-lg border-2 border-[#1e1b2e] bg-[#fff1f2] px-3 py-1.5"
        >
          <span className="font-pixel mr-1 text-xs font-bold text-[#9f1239]">
            NYAWA
          </span>
          {Array.from({ length: MAX_LIVES }).map((_, idx) => (
            <span
              key={idx}
              aria-hidden="true"
              className={`text-base transition-transform ${
                idx < lives ? "scale-100" : "opacity-30 grayscale"
              }`}
            >
              ❤️
            </span>
          ))}
        </div>
      </section>

      {/* Phaser Mini-Game Canvas */}
      <GameCanvas onControllerReady={setController} />

      {/* Audio & Accessibility Controls */}
      <section className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={gameState !== "MENUNGGU_JAWABAN" || !controller}
            onClick={() => controller?.replayAudio()}
            className="pixel-btn font-pixel bg-white px-3.5 py-2 text-xs font-bold text-[#1e1b2e]"
          >
            🔊 Putar Ulang Suara
          </button>

          <button
            type="button"
            onClick={() => setShowTextAssist((v) => !v)}
            className={`pixel-btn font-pixel px-3.5 py-2 text-xs font-bold text-[#1e1b2e] ${
              showTextAssist ? "bg-[#bbf7d0]" : "bg-white"
            }`}
          >
            Aa Teks Bantuan: {showTextAssist ? "Nyala" : "Mati"}
          </button>
        </div>

        {gameHint && (
          <p
            role="status"
            aria-live="polite"
            className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-[#fef9c3] px-3 py-1.5 text-xs font-bold text-[#1e1b2e]"
          >
            {gameHint}
          </p>
        )}
      </section>

      {showPromptText && (
        <div
          role="status"
          className="pixel-card flex items-center justify-center gap-2 bg-[#e0f2fe] px-4 py-2.5 text-center"
        >
          <span className="font-pixel text-sm font-bold text-[#075985]">
            {audioFallbackUsed && !showTextAssist
              ? `Mode Cadangan Suara — Instruksi: "Tekan ${currentTarget}"`
              : `Teks Bantuan — Instruksi: "Tekan ${currentTarget}"`}
          </span>
        </div>
      )}

      {/* Letter Choice Buttons or End Result Card */}
      {gameState !== "PERMAINAN_SELESAI" ? (
        <section className="pixel-card p-4 sm:p-5">
          <LetterButtons
            onSelectLetter={(letter) => controller?.submitAnswer(letter)}
          />
        </section>
      ) : (
        <section
          className={`pixel-card space-y-4 p-5 sm:p-6 ${
            gameOutcome === "won" ? "bg-[#f0fdf4]" : "bg-[#fff1f2]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-pixel text-xl font-extrabold text-[#1e1b2e]">
              {gameOutcome === "won"
                ? `🎉 Menang! ${pet.name} Berhasil!`
                : `💥 Nyawa Habis! Coba Lagi ya!`}
            </h2>
            {lastReward?.isNewHighScore && (
              <span className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-[#fde047] px-3 py-1 text-xs font-bold">
                🏆 Rekor Baru!
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border-2 border-[#1e1b2e] bg-white p-3">
              <div className="text-xs text-slate-600">Skor Akhir</div>
              <div className="font-pixel text-xl font-extrabold">{score}</div>
            </div>
            <div className="rounded-lg border-2 border-[#1e1b2e] bg-white p-3">
              <div className="text-xs text-slate-600">Sisa Nyawa</div>
              <div className="font-pixel text-xl font-extrabold">
                {lives}/{MAX_LIVES}
              </div>
            </div>
            {lastReward && (
              <div className="col-span-2 rounded-lg border-2 border-[#1e1b2e] bg-white p-3 sm:col-span-1">
                <div className="text-xs text-slate-600">Hadiah Monster</div>
                <div className="font-pixel text-sm font-bold text-[#15803d]">
                  +{lastReward.happinessGain} Bahagia • -{lastReward.energyCost}{" "}
                  Energi
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => controller?.startGame()}
              className="pixel-btn font-pixel bg-[#fde047] px-5 py-3 text-sm font-bold text-[#1e1b2e]"
            >
              🔁 Main Lagi
            </button>
            <Link
              href="/pet"
              className="pixel-btn font-pixel bg-[#4ade80] px-5 py-3 text-sm font-bold text-[#1e1b2e] no-underline"
            >
              🐾 Rawat {pet.name}
            </Link>
            <Link
              href="/pet/draw"
              className="pixel-btn font-pixel bg-white px-5 py-3 text-sm font-bold text-[#1e1b2e] no-underline"
            >
              🎨 Ubah Monster
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

