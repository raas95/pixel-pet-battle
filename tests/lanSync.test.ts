import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAN_RE_PUSH_MS,
  LAN_SYNC_POLL_MS,
  LanNeighborEntry,
  LanSyncStatus,
  queueLanPush,
  startLanSync,
  stopLanSync,
} from "@/lib/lanSync";
import { PetData, createDefaultPet } from "@/lib/pet";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function lastStatus(
  mock: ReturnType<typeof vi.fn>
): [LanSyncStatus, number] | undefined {
  const calls = mock.mock.calls.filter((c) => c[0] === "online" || c[0] === "offline" || c[0] === "connecting");
  return calls.length ? (calls[calls.length - 1] as [LanSyncStatus, number]) : undefined;
}

describe("lib/lanSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    stopLanSync();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("meneruskan daftar tetangga dari server ke callback", async () => {
    const neighbors: LanNeighborEntry[] = [
      { deviceId: "dev-x", pet: { ...createDefaultPet(1), name: "X" } },
    ];
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({ pets: neighbors, peers: 2, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onNeighbors = vi.fn();
    const onStatus = vi.fn();
    startLanSync({
      getLocalPet: () => createDefaultPet(1_000),
      onNeighbors,
      onStatus,
    });

    await vi.advanceTimersByTimeAsync(1);

    expect(onNeighbors).toHaveBeenCalledWith(neighbors);
    expect(lastStatus(onStatus)).toEqual(["online", 2]);
  });

  it("mengirim pet lokal saat poll pertama karena belum pernah terkirim", async () => {
    const local: PetData = { ...createDefaultPet(9_000), name: "Lokal" };
    let serverPets: LanNeighborEntry[] = [];
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { pet: PetData; deviceId: string };
        serverPets = [{ deviceId: body.deviceId, pet: body.pet }];
        return jsonResponse({ pets: serverPets, peers: 1, now: 0, accepted: true });
      }
      return jsonResponse({ pets: serverPets, peers: 1, now: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => local,
      onNeighbors: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1);

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBe(1);
    const body = JSON.parse(String((postCalls[0][1] as RequestInit).body)) as { pet: PetData };
    expect(body.pet.name).toBe("Lokal");
  });

  it("queueLanPush mengirim perubahan lokal dengan debounce", async () => {
    const local: PetData = { ...createDefaultPet(9_000), name: "DariAksi" };
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({ pets: [], peers: 1, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => local,
      onNeighbors: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1);
    fetchMock.mockClear();

    // Simulasi aksi lokal: pet berubah (updatedAt lebih baru) lalu di-push.
    const updated: PetData = { ...local, updatedAt: 9_500 };
    queueLanPush(updated);
    queueLanPush(updated);
    await vi.advanceTimersByTimeAsync(900);

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBe(1);
    const body = JSON.parse(String((postCalls[0][1] as RequestInit).body)) as { pet: PetData };
    expect(body.pet.updatedAt).toBe(9_500);
  });

  it("mengirim ulang pendaftaran secara berkala meski data tidak berubah", async () => {
    const local = createDefaultPet(1_000);
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({ pets: [], peers: 1, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => local,
      onNeighbors: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(LAN_SYNC_POLL_MS);

    const countPosts = () =>
      fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST").length;

    expect(countPosts()).toBe(1);

    // Belum sampai interval re-push: tidak ada POST tambahan.
    await vi.advanceTimersByTimeAsync(LAN_RE_PUSH_MS - LAN_SYNC_POLL_MS * 2);
    expect(countPosts()).toBe(1);

    // Lewat interval re-push: pendaftaran dikirim ulang.
    await vi.advanceTimersByTimeAsync(LAN_SYNC_POLL_MS * 2);
    expect(countPosts()).toBe(2);
  });

  it("menandai offline ketika server tidak terjangkau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const onStatus = vi.fn();

    startLanSync({
      getLocalPet: () => createDefaultPet(1_000),
      onNeighbors: vi.fn(),
      onStatus,
    });
    await vi.advanceTimersByTimeAsync(1);

    expect(lastStatus(onStatus)).toEqual(["offline", 0]);
  });

  it("tidak mengirim ulang pet yang sudah terkirim", async () => {
    const local = createDefaultPet(1_000);
    const fetchMock = vi.fn().mockImplementation(async () =>
      jsonResponse({ pets: [], peers: 1, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => local,
      onNeighbors: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(LAN_SYNC_POLL_MS * 3);

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBe(1);
  });
});
