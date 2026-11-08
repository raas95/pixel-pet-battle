import { describe, expect, it } from "vitest";
import {
  GRID_SIZE,
  STAT_MAX,
  STAT_MIN,
  applyMiniGameReward,
  applyTimeDecay,
  clampStat,
  createDefaultPet,
  createEmptyPixels,
  feedPet,
  getPetMood,
  hasPaintedPixels,
  playWithPet,
  sanitizePetName,
  sleepPet,
} from "@/lib/pet";

describe("lib/pet", () => {
  it("creates a valid 32x32 starter monster with bounded initial stats", () => {
    const pet = createDefaultPet(1000);
    expect(pet.version).toBe(1);
    expect(pet.name).toBe("Piko");
    expect(pet.pixels).toHaveLength(GRID_SIZE);
    for (const row of pet.pixels) {
      expect(row).toHaveLength(GRID_SIZE);
    }
    expect(hasPaintedPixels(pet.pixels)).toBe(true);
    expect(pet.hunger).toBeGreaterThanOrEqual(STAT_MIN);
    expect(pet.hunger).toBeLessThanOrEqual(STAT_MAX);
    expect(pet.happiness).toBeGreaterThanOrEqual(STAT_MIN);
    expect(pet.happiness).toBeLessThanOrEqual(STAT_MAX);
    expect(pet.energy).toBeGreaterThanOrEqual(STAT_MIN);
    expect(pet.energy).toBeLessThanOrEqual(STAT_MAX);
  });

  it("rejects empty 32x32 pixel grid check", () => {
    const empty = createEmptyPixels();
    expect(empty).toHaveLength(GRID_SIZE);
    expect(hasPaintedPixels(empty)).toBe(false);
    empty[10][12] = "#ff0000";
    expect(hasPaintedPixels(empty)).toBe(true);
  });

  it("clamps all stats strictly within 0..100", () => {
    expect(clampStat(-50)).toBe(0);
    expect(clampStat(0)).toBe(0);
    expect(clampStat(54.6)).toBe(55);
    expect(clampStat(150)).toBe(100);
    expect(clampStat(Number.NaN)).toBe(0);
  });

  it("updates stats properly on feed, play, and sleep without exceeding 0..100", () => {
    let pet = {
      ...createDefaultPet(1000),
      hunger: 50,
      happiness: 50,
      energy: 50,
    };

    const fed = feedPet(pet, 2000);
    expect(fed.changed).toBe(true);
    expect(fed.pet.hunger).toBe(75);
    expect(fed.pet.happiness).toBe(55);

    const played = playWithPet(fed.pet, 3000);
    expect(played.changed).toBe(true);
    expect(played.pet.happiness).toBe(75);
    expect(played.pet.energy).toBe(35);
    expect(played.pet.hunger).toBe(70);

    const slept = sleepPet(played.pet, 4000);
    expect(slept.changed).toBe(true);
    expect(slept.pet.energy).toBe(70);

    // Repeated feed & sleep clamp at 100
    pet = { ...slept.pet, hunger: 95, happiness: 99, energy: 95 };
    const overFed = feedPet(pet, 5000);
    expect(overFed.pet.hunger).toBe(100);
    expect(overFed.pet.happiness).toBe(100);

    const overSlept = sleepPet(overFed.pet, 6000);
    expect(overSlept.pet.energy).toBe(100);
  });

  it("blocks playing when energy is critically low (< 10) and keeps values >= 0", () => {
    const tiredPet = { ...createDefaultPet(1000), energy: 5 };
    const result = playWithPet(tiredPet, 2000);
    expect(result.changed).toBe(false);
    expect(result.reaction).toBe("sad");
    expect(result.pet.energy).toBe(5);
  });

  it("caps offline time decay so long absences do not over-decay", () => {
    const start = createDefaultPet(0);
    const thirtyMinutesLater = 30 * 60 * 1000;
    const after30Min = applyTimeDecay(start, thirtyMinutesLater);
    expect(after30Min.hunger).toBe(start.hunger - 7); // floor(30 * 0.25)

    // 10 days later should be capped at 2-hour max decay window
    const tenDaysLater = 10 * 24 * 60 * 60 * 1000;
    const after10Days = applyTimeDecay(start, tenDaysLater);
    expect(after10Days.hunger).toBe(start.hunger - 30);
    expect(after10Days.happiness).toBe(start.happiness - 30);
    expect(after10Days.energy).toBe(start.energy - 24);
  });

  it("applies mini-game rewards and updates highScore safely", () => {
    const pet = { ...createDefaultPet(1000), happiness: 60, energy: 5, highScore: 40 };
    const rewarded = applyMiniGameReward(
      pet,
      { won: true, score: 90, roundsCompleted: 10, livesRemaining: 2 },
      2000
    );
    expect(rewarded.isNewHighScore).toBe(true);
    expect(rewarded.pet.highScore).toBe(90);
    expect(rewarded.pet.happiness).toBe(80);
    expect(rewarded.pet.energy).toBe(0); // clamped >= 0
  });

  it("sanitizes pet name and derives mood", () => {
    expect(sanitizePetName("   ")).toBe("Piko");
    expect(sanitizePetName("  Mochi   Bola  ")).toBe("Mochi Bola");
    expect(getPetMood({ ...createDefaultPet(), hunger: 10 })).toBe("sedih");
    expect(
      getPetMood({ ...createDefaultPet(), hunger: 80, happiness: 85, energy: 80 })
    ).toBe("senang");
  });
});

