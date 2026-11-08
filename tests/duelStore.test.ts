import { beforeEach, describe, expect, it } from "vitest";
import { useDuelStore } from "@/store/useDuelStore";

const ACTIVE_DUEL = {
  id: "d1",
  status: "active" as const,
  round: 2,
  command: "A",
  roundEndsAt: 1,
  winner: null,
  lastEvent: null,
  players: [
    { deviceId: "me", name: "Piko", hp: 100, streak: 1, answered: false },
    { deviceId: "opp", name: "Budi", hp: 80, streak: 0, answered: false },
  ],
};

const FINISHED_DUEL = {
  ...ACTIVE_DUEL,
  status: "finished" as const,
  winner: "me",
};

function resetStore() {
  useDuelStore.setState({
    incoming: null,
    duel: null,
    declined: null,
    abandoned: null,
    firstSyncDone: false,
  });
}

describe("store/useDuelStore", () => {
  beforeEach(resetStore);

  it("firstSyncDone true setelah snapshot pertama", () => {
    expect(useDuelStore.getState().firstSyncDone).toBe(false);
    useDuelStore.getState().applySnapshot({ incoming: null, duel: null }, "me");
    expect(useDuelStore.getState().firstSyncDone).toBe(true);
  });

  it("duel aktif yang hilang (post-hysteresis) menghasilkan notice abandoned", () => {
    useDuelStore.getState().applySnapshot({ incoming: null, duel: ACTIVE_DUEL }, "me");
    expect(useDuelStore.getState().duel?.status).toBe("active");

    useDuelStore.getState().applySnapshot({ incoming: null, duel: null }, "me");
    const state = useDuelStore.getState();
    expect(state.duel).toBeNull();
    expect(state.abandoned).not.toBeNull();
    expect(state.abandoned!.message).toContain("duel");
  });

  it("hasil finished dipertahankan walau server sudah membersihkan duel", () => {
    useDuelStore.getState().applySnapshot({ incoming: null, duel: FINISHED_DUEL }, "me");
    useDuelStore.getState().applySnapshot({ incoming: null, duel: null }, "me");
    expect(useDuelStore.getState().duel?.status).toBe("finished");
    expect(useDuelStore.getState().abandoned).toBeNull();
  });

  it("snapshot kosong tanpa duel sebelumnya tidak dianggap abandoned", () => {
    useDuelStore.getState().applySnapshot({ incoming: null, duel: null }, "me");
    expect(useDuelStore.getState().abandoned).toBeNull();
    expect(useDuelStore.getState().duel).toBeNull();
  });
});
