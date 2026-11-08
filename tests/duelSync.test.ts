import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DUEL_POLL_MS, DuelSnapshot, startDuelSync } from "@/lib/duelSync";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const ACTIVE_DUEL = {
  incoming: null,
  duel: {
    id: "d1",
    status: "active",
    round: 1,
    command: "A",
    roundEndsAt: 1,
    winner: null,
    lastEvent: null,
    players: [],
  },
};
const EMPTY: DuelSnapshot = { incoming: null, duel: null };

describe("lib/duelSync hysteresis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("snapshot kosong ditahan 3x setelah duel aktif sebelum diteruskan", async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      return jsonResponse(call === 1 ? ACTIVE_DUEL : EMPTY);
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshots: DuelSnapshot[] = [];
    startDuelSync((s) => snapshots.push(s));

    await vi.advanceTimersByTimeAsync(1);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].duel?.status).toBe("active");

    // Dua snapshot kosong pertama ditahan (loop redirect tercegah).
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(1);

    // Snapshot kosong ke-3 diteruskan: store boleh menutup duel.
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].duel).toBeNull();
  });

  it("snapshot dengan incoming diteruskan langsung walau duel kosong", async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) return jsonResponse(ACTIVE_DUEL);
      return jsonResponse({
        incoming: { duelId: "d2", fromName: "Citra" },
        duel: null,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshots: DuelSnapshot[] = [];
    startDuelSync((s) => snapshots.push(s));

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].incoming?.fromName).toBe("Citra");
  });

  it("duel yang kembali muncul menghentikan streak kosong", async () => {
    let call = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      call += 1;
      // 1: active, 2-3: kosong (ditahan), 4: active lagi (JSON identik),
      // 5-6: kosong lagi, 7: kosong ke-3 sejak pemulihan -> diteruskan.
      if (call === 1 || call === 4) return jsonResponse(ACTIVE_DUEL);
      return jsonResponse(EMPTY);
    });
    vi.stubGlobal("fetch", fetchMock);

    const snapshots: DuelSnapshot[] = [];
    startDuelSync((s) => snapshots.push(s));

    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS); // kosong #1 ditahan
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS); // kosong #2 ditahan
    expect(snapshots).toHaveLength(1);

    // Active lagi dengan JSON identik: tidak perlu diteruskan ulang (store
    // masih memegang duel), tetapi streak kosong ter-reset.
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(1);

    // Dua kosong berikutnya ditahan lagi dari nol...
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(1);

    // ...dan kosong ke-3 diteruskan.
    await vi.advanceTimersByTimeAsync(DUEL_POLL_MS);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[1].duel).toBeNull();
  });
});
