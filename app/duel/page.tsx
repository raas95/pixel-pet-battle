"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PetSprite } from "@/components/PetSprite";
import { getDeviceId } from "@/lib/device";
import { DUEL_POLL_MS, submitDuelAnswer } from "@/lib/duelSync";
import { getLetterAudioPath, LETTERS } from "@/lib/letters";
import { createDefaultPixels } from "@/lib/pet";
import { useDuelStore } from "@/store/useDuelStore";
import { usePetStore } from "@/store/usePetStore";

const ROUND_MS = 12_000;
const CHARGE_NEEDED = 3;

type Fx =
  | { type: "hit"; byMe: boolean; round: number }
  | { type: "collision"; round: number }
  | null;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function DuelPage() {
  const router = useRouter();
  const duel = useDuelStore((state) => state.duel);
  const clearDuel = useDuelStore((state) => state.clearDuel);
  const myPet = usePetStore((state) => state.pet);
  const neighbors = usePetStore((state) => state.lanNeighbors);

  const myDeviceId = getDeviceId();
  const me = duel?.players.find((p) => p.deviceId === myDeviceId) ?? null;
  const opponent =
    duel?.players.find((p) => p.deviceId !== myDeviceId) ?? null;

  const opponentInfo = opponent
    ? neighbors.find((n) => n.deviceId === opponent.deviceId)
    : undefined;
  const opponentPixels = opponentInfo?.pixels ?? createDefaultPixels();

  const [fx, setFx] = useState<Fx>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(ROUND_MS);
  const submittedRoundRef = useRef(0);

  const command = duel?.command ?? null;

  // Mainkan suara instruksi setiap ronde baru.
  useEffect(() => {
    if (!command || duel?.status !== "active") return;
    new Audio(getLetterAudioPath(command)).play().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.id, duel?.round]);

  // Animasi + pesan dari hasil ronde terakhir.
  useEffect(() => {
    const event = duel?.lastEvent;
    if (!event || event.type === "none" || duel?.status !== "active") return;
    if (event.round <= submittedRoundRef.current && fx?.round === event.round) return;

    if (event.type === "collision") {
      setFx({ type: "collision", round: event.round });
      setMessage("💥 Kedua serangan bertabrakan dan batal!");
    } else if (event.type === "hit" && event.byDeviceId) {
      const byMe = event.byDeviceId === myDeviceId;
      setFx({ type: "hit", byMe, round: event.round });
      setMessage(
        byMe
          ? `🔥 Kena! Seranganmu mengenai ${opponent?.name ?? "lawan"} (-20)`
          : `💥 ${opponent?.name ?? "Lawan"} mengenaimu! (-20)`
      );
    }
    const t = window.setTimeout(() => setFx(null), 1_300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.lastEvent, duel?.status]);

  // Hitung mundur ronde.
  useEffect(() => {
    if (!duel?.roundEndsAt || duel.status !== "active") return;
    const update = () =>
      setRemainingMs(Math.max(0, duel.roundEndsAt! - Date.now()));
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [duel?.roundEndsAt, duel?.status]);

  const tiles = useMemo(() => {
    if (!command) return [];
    const others = LETTERS.filter((l) => l !== command);
    const picked: string[] = [command];
    while (picked.length < 6) {
      const candidate = others[Math.floor(Math.random() * others.length)];
      if (!picked.includes(candidate)) picked.push(candidate);
    }
    return shuffle(picked);
  }, [command]);

  const submit = (letter: string) => {
    if (!duel || duel.status !== "active" || !me || me.answered) return;
    if (submittedRoundRef.current >= duel.round) return;
    submittedRoundRef.current = duel.round;
    void submitDuelAnswer(duel.id, letter);
  };

  // Keyboard A-Z sebagai jawaban.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const letter = e.key.toUpperCase();
      if (/^[A-Z]$/.test(letter)) submit(letter);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel, me]);

  if (!duel) {
    return (
      <div className="pixel-card space-y-4 p-6 text-center">
        <h1 className="font-pixel text-xl font-extrabold text-[#1e1b2e]">
          ⚔️ Tidak Ada Duel Aktif
        </h1>
        <p className="text-sm font-medium text-slate-600">
          Klik monster tetangga di halaman Rawat untuk mengajak duel.
        </p>
        <Link
          href="/pet"
          className="pixel-btn font-pixel inline-block bg-[#fde047] px-5 py-2.5 text-sm font-bold text-[#1e1b2e] no-underline"
        >
          🐾 Ke Ruang Rawat
        </Link>
      </div>
    );
  }

  const finished = duel.status === "finished";
  const won = finished && duel.winner === myDeviceId;

  return (
    <div className="space-y-4">
      <div className="pixel-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-pixel text-lg font-extrabold text-[#1e1b2e] sm:text-xl">
            ⚔️ Duel — Ronde {duel.round}
          </h1>
          <button
            type="button"
            onClick={() => new Audio(getLetterAudioPath(command ?? "A")).play().catch(() => undefined)}
            className="pixel-btn font-pixel bg-[#e0e7ff] px-3 py-1 text-xs font-bold text-[#1e1b2e]"
          >
            🔊 Ulangi Suara
          </button>
        </div>

        {/* Arena */}
        <div className="relative min-h-[220px] overflow-hidden rounded-xl border-[3px] border-[#1e1b2e] bg-gradient-to-b from-[#dbeafe] via-[#eff6ff] to-[#fecaca] p-4">
          <div className="flex items-start justify-between gap-2">
            {/* Saya */}
            <div className="flex w-24 flex-col items-center gap-1 sm:w-32">
              <div className="font-pixel w-full truncate text-center text-xs font-extrabold text-[#1e1b2e]">
                {me?.name ?? "Kamu"}
                <span className="block text-[10px] font-medium text-slate-500">
                  (kamu)
                </span>
              </div>
              <div className={fx?.type === "hit" && !fx.byMe ? "animate-pet-sad" : ""}>
                <PetSprite
                  pixels={myPet.pixels}
                  size={72}
                  animated={false}
                  mood={me && me.hp <= 30 ? "sedih" : "biasa"}
                />
              </div>
              <HpBar hp={me?.hp ?? 0} />
              <ChargePips streak={me?.streak ?? 0} answered={me?.answered ?? false} />
            </div>

            <div className="font-pixel pt-8 text-2xl font-extrabold text-[#1e1b2e]/30">
              VS
            </div>

            {/* Lawan */}
            <div className="flex w-24 flex-col items-center gap-1 sm:w-32">
              <div className="font-pixel w-full truncate text-center text-xs font-extrabold text-[#1e1b2e]">
                {opponent?.name ?? "Lawan"}
              </div>
              <div className={fx?.type === "hit" && fx.byMe ? "animate-pet-sad" : ""}>
                <PetSprite
                  pixels={opponentPixels}
                  size={72}
                  animated={false}
                  mood={opponent && opponent.hp <= 30 ? "sedih" : "biasa"}
                />
              </div>
              <HpBar hp={opponent?.hp ?? 0} />
              <ChargePips streak={opponent?.streak ?? 0} answered={opponent?.answered ?? false} />
            </div>
          </div>

          {/* Animasi projektil */}
          {fx?.type === "hit" && (
            <span
              aria-hidden
              className="absolute top-[38%] text-3xl"
              style={{
                animation: `duelFly${fx.byMe ? "Right" : "Left"} 0.85s ease-in forwards`,
              }}
            >
              🔥
            </span>
          )}
          {fx?.type === "collision" && (
            <>
              <span
                aria-hidden
                className="absolute top-[38%] text-3xl"
                style={{ animation: "duelFlyCenterR 0.6s ease-in forwards" }}
              >
                🔥
              </span>
              <span
                aria-hidden
                className="absolute top-[38%] text-3xl"
                style={{ animation: "duelFlyCenterL 0.6s ease-in forwards" }}
              >
                🔥
              </span>
              <span
                aria-hidden
                className="absolute top-[36%] text-4xl"
                style={{ left: "47%", animation: "duelPop 0.5s ease-out 0.55s both" }}
              >
                💥
              </span>
            </>
          )}

          {/* Hasil akhir */}
          {finished && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#1e1b2e]/60 p-4">
              <div className="pixel-card bg-white px-6 py-4 text-center">
                <div className="font-pixel text-2xl font-extrabold text-[#1e1b2e]">
                  {won ? "🏆 Kamu Menang!" : "💀 Kamu Kalah!"}
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {won
                    ? `${opponent?.name ?? "Lawan"} kehabisan HP.`
                    : `${me?.name ?? "Monster"} kamu kehabisan HP.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearDuel();
                  router.push("/");
                }}
                className="pixel-btn font-pixel bg-[#fde047] px-5 py-2.5 text-sm font-bold text-[#1e1b2e]"
              >
                🏠 Kembali ke Beranda
              </button>
            </div>
          )}
        </div>

        {/* Instruksi & status */}
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full border-2 border-[#1e1b2e] bg-white">
            <div
              className="h-full bg-[#fbbf24] transition-[width] duration-200"
              style={{ width: `${(remainingMs / ROUND_MS) * 100}%` }}
            />
          </div>

          <p className="font-pixel text-center text-sm font-bold text-[#1e1b2e]">
            {finished
              ? "Duel selesai."
              : me?.answered
                ? "⏳ Menunggu lawan menjawab..."
                : command
                  ? <>Tekan huruf: <span className="text-xl text-[#4338ca]">{command}</span></>
                  : "Bersiap..."}
          </p>

          {message && !finished && (
            <p className="font-pixel text-center text-xs font-bold text-[#991b1b]">
              {message}
            </p>
          )}
        </div>

        {/* Pilihan huruf di layar */}
        {!finished && (
          <div className="mt-3 grid grid-cols-6 gap-2">
            {tiles.map((letter) => (
              <button
                key={letter}
                type="button"
                disabled={me?.answered ?? false}
                onClick={() => submit(letter)}
                className="pixel-btn font-pixel bg-white py-3 text-lg font-extrabold text-[#1e1b2e] disabled:opacity-50 sm:text-xl"
              >
                {letter}
              </button>
            ))}
          </div>
        )}

        <p className="mt-3 text-center text-[11px] font-medium text-slate-500">
          Jawab benar {CHARGE_NEEDED}× berturut untuk mengisi daya serangan;
          jawaban benar berikutnya meluncurkan 🔥 projektil. Proyektil yang
          bertabrakan batal. (Polling {DUEL_POLL_MS / 1000} detik — jawaban
          tampil setelah sinkron.)
        </p>
      </div>
    </div>
  );
}

function HpBar({ hp }: { hp: number }) {
  const pct = Math.max(0, Math.min(100, hp));
  const color = pct > 50 ? "bg-[#4ade80]" : pct > 25 ? "bg-[#fbbf24]" : "bg-[#ef4444]";
  return (
    <div className="h-3 w-full overflow-hidden rounded-full border-2 border-[#1e1b2e] bg-white">
      <div className={`h-full ${color} transition-[width]`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ChargePips({ streak, answered }: { streak: number; answered: boolean }) {
  return (
    <div className="flex items-center gap-0.5 text-sm" aria-label={`Daya serangan ${streak} dari ${CHARGE_NEEDED}`}>
      {Array.from({ length: CHARGE_NEEDED }, (_, i) => (
        <span key={i} className={i < streak ? "opacity-100" : "opacity-25"}>
          {i < streak ? "🔥" : "·"}
        </span>
      ))}
      <span className="font-pixel ml-1 text-[10px] font-bold text-slate-500">
        {streak >= CHARGE_NEEDED ? "SIAP!" : answered ? "..." : ""}
      </span>
    </div>
  );
}
