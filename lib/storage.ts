import {
  PET_DATA_VERSION,
  PetData,
  applyTimeDecay,
  clampStat,
  createDefaultPet,
  normalizePixels,
  sanitizePetName,
} from "./pet";

export const PET_STORAGE_KEY = "pixel_virtual_pet_v1";

export function migratePetData(raw: unknown, now: number = Date.now()): PetData {
  if (!raw || typeof raw !== "object") {
    return createDefaultPet(now);
  }

  const record = raw as Record<string, unknown>;
  const defaults = createDefaultPet(now);

  const name =
    typeof record.name === "string" ? sanitizePetName(record.name) : defaults.name;

  const pixels = normalizePixels(record.pixels);

  const hunger =
    typeof record.hunger === "number" ? clampStat(record.hunger) : defaults.hunger;
  const happiness =
    typeof record.happiness === "number"
      ? clampStat(record.happiness)
      : defaults.happiness;
  const energy =
    typeof record.energy === "number" ? clampStat(record.energy) : defaults.energy;
  const highScore =
    typeof record.highScore === "number" && Number.isFinite(record.highScore)
      ? Math.max(0, Math.floor(record.highScore))
      : defaults.highScore;
  const updatedAt =
    typeof record.updatedAt === "number" && Number.isFinite(record.updatedAt)
      ? record.updatedAt
      : now;

  return {
    version: PET_DATA_VERSION,
    name,
    pixels,
    hunger,
    happiness,
    energy,
    highScore,
    updatedAt,
  };
}

export function savePetData(pet: PetData): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(PET_STORAGE_KEY, JSON.stringify(pet));
    return true;
  } catch {
    return false;
  }
}

export function loadPetData(now: number = Date.now()): PetData {
  if (typeof window === "undefined") {
    return createDefaultPet(now);
  }

  try {
    const raw = window.localStorage.getItem(PET_STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultPet(now);
      savePetData(initial);
      return initial;
    }

    const parsed: unknown = JSON.parse(raw);
    const migrated = migratePetData(parsed, now);
    const decayed = applyTimeDecay(migrated, now);

    if (
      decayed.hunger !== migrated.hunger ||
      decayed.happiness !== migrated.happiness ||
      decayed.energy !== migrated.energy ||
      (parsed as Record<string, unknown>)?.version !== PET_DATA_VERSION
    ) {
      savePetData(decayed);
    }

    return decayed;
  } catch {
    const fallback = createDefaultPet(now);
    savePetData(fallback);
    return fallback;
  }
}

export function resetPetData(now: number = Date.now()): PetData {
  const fresh = createDefaultPet(now);
  savePetData(fresh);
  return fresh;
}

