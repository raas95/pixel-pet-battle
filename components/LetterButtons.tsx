"use client";

import { usePetStore } from "@/store/usePetStore";

type LetterButtonsProps = {
  onSelectLetter: (letter: string) => void;
};

export function LetterButtons({ onSelectLetter }: LetterButtonsProps) {
  const gameState = usePetStore((state) => state.gameState);
  const currentOptions = usePetStore((state) => state.currentOptions);
  const lastAnswerFeedback = usePetStore((state) => state.lastAnswerFeedback);

  const canAnswer = gameState === "MENUNGGU_JAWABAN";

  if (currentOptions.length === 0) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((slot) => (
          <div
            key={slot}
            className="font-pixel flex h-20 items-center justify-center rounded-lg border-[3px] border-dashed border-slate-400 bg-white/60 text-xl font-bold text-slate-400"
          >
            ?
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {currentOptions.map((letter) => {
          let bgClass = "bg-white hover:bg-[#eef2ff]";
          if (
            gameState === "MEMPROSES_JAWABAN" &&
            lastAnswerFeedback
          ) {
            if (letter === lastAnswerFeedback.target) {
              bgClass = "bg-[#86efac]";
            } else if (
              letter === lastAnswerFeedback.selected &&
              !lastAnswerFeedback.correct
            ) {
              bgClass = "bg-[#fca5a5]";
            }
          }

          return (
            <button
              key={letter}
              type="button"
              disabled={!canAnswer}
              onClick={() => onSelectLetter(letter)}
              aria-label={`Pilih huruf ${letter}`}
              className={`pixel-btn font-pixel flex h-20 flex-col items-center justify-center text-3xl font-extrabold text-[#1e1b2e] sm:h-24 ${bgClass}`}
            >
              <span>{letter}</span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Tombol {letter}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs font-medium text-slate-600">
        Sentuh salah satu tombol di atas atau tekan huruf{" "}
        <span className="font-pixel rounded border border-slate-400 bg-white px-1.5 py-0.5 font-bold">
          A–Z
        </span>{" "}
        di keyboard.
      </p>
    </div>
  );
}

