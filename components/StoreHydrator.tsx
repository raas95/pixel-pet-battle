"use client";

import { useEffect } from "react";
import { usePetStore } from "@/store/usePetStore";
import { startLanSync } from "@/lib/lanSync";

export function StoreHydrator() {
  const hydrate = usePetStore((state) => state.hydrate);
  const syncTimeDecay = usePetStore((state) => state.syncTimeDecay);

  useEffect(() => {
    hydrate();

    const stopLanSync = startLanSync({
      getLocalPet: () => usePetStore.getState().pet,
      onRemotePet: (pet) => usePetStore.getState().applyRemotePet(pet),
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
