import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultPet, createEmptyPixels } from "@/lib/pet";
import { PET_STORAGE_KEY, loadPetData, resetPetData, savePetData } from "@/lib/storage";
import { usePetStore } from "@/store/usePetStore";

describe("lib/storage and usePetStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("initializes and persists default pet when localStorage is empty", () => {
    const pet = loadPetData(10_000);
    expect(pet.name).toBe("Piko");
    expect(window.localStorage.getItem(PET_STORAGE_KEY)).not.toBeNull();
  });

  it("recovers safely from corrupted JSON in localStorage", () => {
    window.localStorage.setItem(PET_STORAGE_KEY, "{not-valid-json");
    const pet = loadPetData(20_000);
    expect(pet.name).toBe("Piko");
    expect(pet.version).toBe(1);
  });

  it("persists custom pixel art and rejects empty canvas saves in store", () => {
    usePetStore.getState().hydrate();
    const empty = createEmptyPixels();
    expect(usePetStore.getState().updatePixels(empty)).toBe(false);

    const custom = createEmptyPixels();
    custom[5][5] = "#ff0055";
    expect(usePetStore.getState().updatePixels(custom)).toBe(true);

    const reloaded = loadPetData(Date.now());
    expect(reloaded.pixels[5][5]).toBe("#ff0055");
  });

  it("resets data back to default cleanly", () => {
    const custom = createDefaultPet(1000);
    custom.name = "Momo";
    custom.highScore = 100;
    savePetData(custom);

    const reset = resetPetData(2000);
    expect(reset.name).toBe("Piko");
    expect(reset.highScore).toBe(0);
  });
});

