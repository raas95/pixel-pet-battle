"use client";

import { useEffect } from "react";
import { usePetStore } from "@/store/usePetStore";
import { getDeviceId } from "@/lib/device";
import { getPetMood } from "@/lib/pet";
import { startLanSync } from "@/lib/lanSync";

export function StoreHydrator() {
  const hydrate = usePetStore((state) => state.hydrate);
  const syncTimeDecay = usePetStore((state) => state.syncTimeDecay);

  useEffect(() => {
    hydrate();

    const ownDeviceId = getDeviceId();
    const stopLanSync = startLanSync({
      getLocalPet: () => usePetStore.getState().pet,
      onNeighbors: (entries) =>
        usePetStore
          .getState()
          .setLanNeighbors(
            entries
              .filter((entry) => entry.deviceId !== ownDeviceId)
              .map((entry) => ({
                deviceId: entry.deviceId,
                name: entry.pet.name,
                pixels: entry.pet.pixels,
                hunger: entry.pet.hunger,
                happiness: entry.pet.happiness,
                energy: entry.pet.energy,
                mood: getPetMood(entry.pet),
                updatedAt: entry.pet.updatedAt,
              }))
          ),
      onStatus: (status, peers) =>
        usePetStore.getState().setLanStatus(status, peers),
    });

    const intervalId = window.setInterval(() => {
      syncTimeDecay();
    }, 30_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncTimeDecay();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopLanSync();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hydrate, syncTimeDecay]);

  return null;
}
