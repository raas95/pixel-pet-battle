"use client";

import {
  PetData,
  getEnergyLabel,
  getHappinessLabel,
  getHungerLabel,
  getPetMood,
} from "@/lib/pet";

type PetStatusProps = {
  pet: PetData;
  compact?: boolean;
};

type StatRowProps = {
  label: string;
  sublabel: string;
  value: number;
  statusText: string;
  icon: string;
};

function getBarColor(value: number): string {
  if (value >= 70) return "bg-[#22c55e]";
  if (value >= 35) return "bg-[#f59e0b]";
  return "bg-[#ef4444]";
}

function getBadgeStyle(value: number): string {
  if (value >= 70) return "bg-[#dcfce7] text-[#166534]";
  if (value >= 35) return "bg-[#fef3c7] text-[#92400e]";
  return "bg-[#fee2e2] text-[#991b1b]";
}

function StatBar({ label, sublabel, value, statusText, icon }: StatRowProps) {
  const barColor = getBarColor(value);
  const badgeStyle = getBadgeStyle(value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">{icon}</span>
          <span className="font-pixel font-bold text-[#1e1b2e]">{label}</span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            ({sublabel})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded border border-[#1e1b2e]/30 px-1.5 py-0.5 text-[11px] font-bold ${badgeStyle}`}
          >
            {statusText}
          </span>
          <span className="font-pixel w-12 text-right text-xs font-bold text-[#1e1b2e]">
            {value}/100
          </span>
        </div>
      </div>

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-5 w-full overflow-hidden rounded-md border-2 border-[#1e1b2e] bg-[#f1f5f9] p-0.5"
      >
        <div
          className={`h-full rounded-sm transition-all duration-300 ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function PetStatus({ pet, compact = false }: PetStatusProps) {
  const mood = getPetMood(pet);
  const moodLabel =
    mood === "senang"
      ? "Kondisi Prima"
      : mood === "biasa"
        ? "Cukup Baik"
        : "Butuh Perhatian!";
  const moodColor =
    mood === "senang"
      ? "bg-[#dcfce7] text-[#166534]"
      : mood === "biasa"
        ? "bg-[#e0e7ff] text-[#3730a3]"
        : "bg-[#fee2e2] text-[#991b1b]";

  return (
    <div className="pixel-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-slate-300 pb-3">
        <div>
          <h2 className="font-pixel text-base font-bold text-[#1e1b2e] sm:text-lg">
            Status {pet.name}
          </h2>
          {!compact && (
            <p className="text-xs text-slate-600">
              Nilai dijaga otomatis antara 0–100 dan tersimpan di browser.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-pixel rounded-md border-2 border-[#1e1b2e] px-2.5 py-1 text-xs font-bold ${moodColor}`}
          >
            {moodLabel}
          </span>
          <span className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-[#fef08a] px-2.5 py-1 text-xs font-bold text-[#1e1b2e]">
            Rekor: {pet.highScore}
          </span>
        </div>
      </div>

      <div className="space-y-3.5">
        <StatBar
          icon="🍖"
          label="Lapar"
          sublabel="Kenyang"
          value={pet.hunger}
          statusText={getHungerLabel(pet.hunger)}
        />
        <StatBar
          icon="💖"
          label="Bahagia"
          sublabel="Mood"
          value={pet.happiness}
          statusText={getHappinessLabel(pet.happiness)}
        />
        <StatBar
          icon="⚡"
          label="Energi"
          sublabel="Stamina"
          value={pet.energy}
          statusText={getEnergyLabel(pet.energy)}
        />
      </div>
    </div>
  );
}

