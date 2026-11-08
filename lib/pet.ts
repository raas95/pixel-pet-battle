export const PET_DATA_VERSION = 1;
export const GRID_SIZE = 32;
export const STAT_MIN = 0;
export const STAT_MAX = 100;

/**
 * Maximum offline elapsed time considered for time-based stat decay (2 hours).
 * Prevents stats from collapsing completely when the player returns after a long break.
 */
export const MAX_OFFLINE_MS = 2 * 60 * 60 * 1000;

export type PetData = {
  version: number;
  name: string;
  pixels: string[][];
  hunger: number;
  happiness: number;
  energy: number;
  highScore: number;
  updatedAt: number;
};

export type PetReaction = "idle" | "happy" | "sad" | "eating" | "playing" | "sleeping";

export type CareActionResult = {
  pet: PetData;
  reaction: PetReaction;
  message: string;
  changed: boolean;
};

export type MiniGameResult = {
  won: boolean;
  score: number;
  roundsCompleted: number;
  livesRemaining: number;
};

export function clampStat(value: number): number {
  if (!Number.isFinite(value)) return STAT_MIN;
  return Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(value)));
}

export function createEmptyPixels(size: number = GRID_SIZE): string[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
}

export function clonePixels(pixels: string[][]): string[][] {
  return pixels.map((row) => [...row]);
}

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizePixels(raw: unknown): string[][] {
  if (!Array.isArray(raw) || raw.length !== GRID_SIZE) {
    return createDefaultPixels();
  }

  const normalized: string[][] = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = raw[y];
    if (!Array.isArray(row) || row.length !== GRID_SIZE) {
      return createDefaultPixels();
    }
    const cleanRow: string[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = row[x];
      if (cell === "" || cell === null || cell === undefined) {
        cleanRow.push("");
      } else if (isValidHexColor(cell)) {
        cleanRow.push(cell.toLowerCase());
      } else {
        cleanRow.push("");
      }
    }
    normalized.push(cleanRow);
  }

  return hasPaintedPixels(normalized) ? normalized : createDefaultPixels();
}

export function countPaintedPixels(pixels: string[][]): number {
  let count = 0;
  for (const row of pixels) {
    for (const cell of row) {
      if (cell !== "") count++;
    }
  }
  return count;
}

export function hasPaintedPixels(pixels: string[][]): boolean {
  return countPaintedPixels(pixels) > 0;
}

/**
 * Cute 32x32 starter pixel monster ("Piko") with dark outline, highlights,
 * rosy cheeks, big glossy eyes, and little feet.
 */
const DEFAULT_MONSTER_ART: string[] = [
  "................................",
  "................................",
  "................................",
  ".........ooo........ooo.........",
  "........oyyyo......oyyyo........",
  "........oyyyo......oyyyo........",
  ".........oooo......oooo.........",
  "........obbbbooooobbbbbo........",
  ".......obllllllllllllllbo.......",
  "......obllbbbbbbbbbbbbllbo......",
  ".....obllbbbbbbbbbbbbbbllbo.....",
  ".....obbbbbbbbbbbbbbbbbbbbo.....",
  "....obbbbbbbbbbbbbbbbbbbbbbo....",
  "....obbbbooobbbbbbbbooobbbbo....",
  "....obbbowwobbbbbbbowwobbbbo....",
  "....obbbowwobbbbbbbowwobbbbo....",
  "....obbbbooobbbbbbbbooobbbbo....",
  "....obppbbbbbbboobbbbbbpppbo....",
  "....obppbbbbbbboobbbbbbpppbo....",
  ".....obbbbbbbbyyyybbbbbbbbo.....",
  ".....obbbbbbbyyyyyybbbbbbbo.....",
  "......obsssbyyyyyyyybbssbo......",
  "......obsssbyyyyyyyybbssbo......",
  ".......obsssbbbbbbbbsssbo.......",
  "........oossssssssssssoo........",
  ".........oobbbo..obbboo.........",
  ".........oobbbo..obbboo.........",
  ".........oooooo..oooooo.........",
  "................................",
  "................................",
  "................................",
  "................................",
];

const DEFAULT_PALETTE: Record<string, string> = {
  ".": "",
  o: "#1e1b2e",
  b: "#5b6ee1",
  l: "#8c9eff",
  s: "#3f4eb8",
  w: "#ffffff",
  p: "#f472b6",
  y: "#fde047",
};

export function createDefaultPixels(): string[][] {
  return DEFAULT_MONSTER_ART.map((row) =>
    row.split("").map((ch) => DEFAULT_PALETTE[ch] ?? "")
  );
}

export function sanitizePetName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "Piko";
  return trimmed.slice(0, 20);
}

export function createDefaultPet(now: number = Date.now()): PetData {
  return {
    version: PET_DATA_VERSION,
    name: "Piko",
    pixels: createDefaultPixels(),
    hunger: 75,
    happiness: 80,
    energy: 85,
    highScore: 0,
    updatedAt: now,
  };
}

export function applyTimeDecay(pet: PetData, now: number = Date.now()): PetData {
  const elapsedMs = Math.max(0, now - pet.updatedAt);
  const cappedMs = Math.min(elapsedMs, MAX_OFFLINE_MS);
  const minutes = cappedMs / 60_000;

  const hungerDrop = Math.floor(minutes * 0.25);
  const happinessDrop = Math.floor(minutes * 0.25);
  const energyDrop = Math.floor(minutes * 0.2);

  if (hungerDrop === 0 && happinessDrop === 0 && energyDrop === 0) {
    return pet;
  }

  return {
    ...pet,
    hunger: clampStat(pet.hunger - hungerDrop),
    happiness: clampStat(pet.happiness - happinessDrop),
    energy: clampStat(pet.energy - energyDrop),
    updatedAt: now,
  };
}

export function feedPet(pet: PetData, now: number = Date.now()): CareActionResult {
  if (pet.hunger >= STAT_MAX) {
    return {
      pet: { ...pet, updatedAt: now },
      reaction: "happy",
      message: `${pet.name} sudah sangat kenyang!`,
      changed: false,
    };
  }

  const nextPet: PetData = {
    ...pet,
    hunger: clampStat(pet.hunger + 25),
    happiness: clampStat(pet.happiness + 5),
    updatedAt: now,
  };

  return {
    pet: nextPet,
    reaction: "eating",
    message: `Nyam! ${pet.name} senang sekali diberi makan.`,
    changed: true,
  };
}

export function playWithPet(pet: PetData, now: number = Date.now()): CareActionResult {
  if (pet.energy < 10) {
    return {
      pet: { ...pet, updatedAt: now },
      reaction: "sad",
      message: `${pet.name} terlalu lelah untuk bermain! Istirahatkan dulu ya.`,
      changed: false,
    };
  }

  const nextPet: PetData = {
    ...pet,
    happiness: clampStat(pet.happiness + 20),
    energy: clampStat(pet.energy - 15),
    hunger: clampStat(pet.hunger - 5),
    updatedAt: now,
  };

  return {
    pet: nextPet,
    reaction: "playing",
    message: `Asyik! ${pet.name} melompat kegirangan saat bermain.`,
    changed: true,
  };
}

export function sleepPet(pet: PetData, now: number = Date.now()): CareActionResult {
  if (pet.energy >= STAT_MAX) {
    return {
      pet: { ...pet, updatedAt: now },
      reaction: "happy",
      message: `${pet.name} sudah bugar dan penuh energi!`,
      changed: false,
    };
  }

  const nextPet: PetData = {
    ...pet,
    energy: clampStat(pet.energy + 35),
    updatedAt: now,
  };

  return {
    pet: nextPet,
    reaction: "sleeping",
    message: `Zzz... ${pet.name} tidur nyenyak dan energinya pulih.`,
    changed: true,
  };
}

export function applyMiniGameReward(
  pet: PetData,
  result: MiniGameResult,
  now: number = Date.now()
): { pet: PetData; happinessGain: number; energyCost: number; isNewHighScore: boolean } {
  const isNewHighScore = result.score > pet.highScore;
  const happinessGain = result.won
    ? 20
    : Math.max(4, Math.min(14, Math.floor(result.score / 10) * 2));
  const energyCost = 10;

  const nextPet: PetData = {
    ...pet,
    happiness: clampStat(pet.happiness + happinessGain),
    energy: clampStat(pet.energy - energyCost),
    hunger: clampStat(pet.hunger - 5),
    highScore: Math.max(pet.highScore, result.score),
    updatedAt: now,
  };

  return {
    pet: nextPet,
    happinessGain,
    energyCost,
    isNewHighScore,
  };
}

export function getPetMood(pet: PetData): "senang" | "biasa" | "sedih" {
  if (pet.hunger < 25 || pet.happiness < 25 || pet.energy < 20) {
    return "sedih";
  }
  if (pet.hunger >= 70 && pet.happiness >= 70 && pet.energy >= 60) {
    return "senang";
  }
  return "biasa";
}

export function getHungerLabel(hunger: number): string {
  if (hunger >= 75) return "Kenyang";
  if (hunger >= 45) return "Cukup";
  if (hunger >= 20) return "Lapar";
  return "Kelaparan!";
}

export function getHappinessLabel(happiness: number): string {
  if (happiness >= 75) return "Sangat Senang";
  if (happiness >= 45) return "Ceria";
  if (happiness >= 20) return "Murung";
  return "Sedih!";
}

export function getEnergyLabel(energy: number): string {
  if (energy >= 75) return "Bugar";
  if (energy >= 45) return "Cukup";
  if (energy >= 20) return "Lelah";
  return "Mengantuk!";
}

