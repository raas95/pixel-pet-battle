import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LAN_SYNC_POLL_MS,
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

  it("mengambil pet dari server ketika server lebih baru", async () => {
    const remote: PetData = { ...createDefaultPet(5_000), name: "Remote" };
    const local = createDefaultPet(1_000);
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ pet: remote, peers: 2, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onRemotePet = vi.fn();
    const onStatus = vi.fn();
    startLanSync({
      getLocalPet: () => local,
      onRemotePet,
      onStatus,
    });

    await vi.advanceTimersByTimeAsync(1);

    expect(onRemotePet).toHaveBeenCalledWith(remote);
    expect(lastStatus(onStatus)).toEqual(["online", 2]);
  });

  it("mengirim pet lokal ketika lokal lebih baru dari server", async () => {
    let serverPet: PetData | null = createDefaultPet(500);
    const local: PetData = { ...createDefaultPet(9_000), name: "Lokal" };
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { pet: PetData; deviceId: string };
        serverPet = body.pet;
        return jsonResponse({ pet: serverPet, peers: 1, now: 0, accepted: true });
      }
      return jsonResponse({ pet: serverPet, peers: 1, now: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => local,
      onRemotePet: vi.fn(),
      onStatus: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(1);

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBeGreaterThan(0);
    const body = JSON.parse(String((postCalls[0][1] as RequestInit).body)) as { pet: PetData };
    expect(body.pet.name).toBe("Lokal");
  });

  it("queueLanPush mengirim perubahan lokal dengan debounce", async () => {
    let serverPet: PetData | null = createDefaultPet(500);
    const local: PetData = { ...createDefaultPet(9_000), name: "DariAksi" };
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { pet: PetData };
        serverPet = body.pet;
        return jsonResponse({ pet: serverPet, peers: 1, now: 0, accepted: true });
      }
      return jsonResponse({ pet: serverPet, peers: 1, now: 0 });
    });
    vi.stubGlobal("fetch", fetchMock);

    startLanSync({
      getLocalPet: () => serverPet ?? local,
      onRemotePet: vi.fn(),
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(1);
    fetchMock.mockClear();

    queueLanPush(local);
    queueLanPush(local);
    await vi.advanceTimersByTimeAsync(900);

    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBe(1);
  });

  it("menandai offline ketika server tidak terjangkau", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const onStatus = vi.fn();

    startLanSync({
      getLocalPet: () => createDefaultPet(1_000),
      onRemotePet: vi.fn(),
      onStatus,
    });
    await vi.advanceTimersByTimeAsync(1);

    expect(lastStatus(onStatus)).toEqual(["offline", 0]);
  });

  it("tidak push atau pull saat updatedAt sama", async () => {
    const same = createDefaultPet(1_000);
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ pet: same, peers: 1, now: 0 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onRemotePet = vi.fn();
    startLanSync({
      getLocalPet: () => same,
      onRemotePet,
      onStatus: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(LAN_SYNC_POLL_MS * 2);

    expect(onRemotePet).not.toHaveBeenCalled();
    const postCalls = fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");
    expect(postCalls.length).toBe(0);
  });
});
