import { PetData } from "./pet";
import { getDeviceId } from "./device";

export type LanSyncStatus = "connecting" | "online" | "offline";

export const LAN_SYNC_POLL_MS = 3_000;
const PUSH_DEBOUNCE_MS = 800;

export type LanNeighborEntry = {
  deviceId: string;
  pet: PetData;
};

type SyncServerResponse = {
  pets: LanNeighborEntry[];
  peers: number;
  now: number;
};

type LanSyncCallbacks = {
  getLocalPet: () => PetData;
  onNeighbors: (neighbors: LanNeighborEntry[]) => void;
  onStatus: (status: LanSyncStatus, peers: number) => void;
};

let activeCallbacks: LanSyncCallbacks | null = null;
let lastPushedUpdatedAt = 0;
let pollTimer: number | null = null;
let pushTimer: number | null = null;

async function request(
  method: "GET" | "POST",
  pet?: PetData
): Promise<SyncServerResponse> {
  const deviceId = encodeURIComponent(getDeviceId());
  const response = await fetch(`/api/pet?deviceId=${deviceId}`, {
    method,
    cache: "no-store",
    headers: pet ? { "Content-Type": "application/json" } : undefined,
    body: pet
      ? JSON.stringify({ pet, deviceId: getDeviceId() })
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`Sync server merespons ${response.status}`);
  }
  return (await response.json()) as SyncServerResponse;
}

async function pushNow(pet: PetData): Promise<void> {
  if (!activeCallbacks) return;
  if (pet.updatedAt <= lastPushedUpdatedAt) return;
  try {
    await request("POST", pet);
    lastPushedUpdatedAt = pet.updatedAt;
  } catch {
    // Status offline is handled by the poll loop.
  }
}

/**
 * Queues a local pet push, debounced so rapid successive actions send one request.
 */
export function queueLanPush(pet: PetData): void {
  if (!activeCallbacks) return;

  if (pushTimer !== null) {
    window.clearTimeout(pushTimer);
  }
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    void pushNow(pet);
  }, PUSH_DEBOUNCE_MS);
}

async function pollTick(): Promise<void> {
  if (!activeCallbacks) return;
  const callbacks = activeCallbacks;

  let data: SyncServerResponse;
  try {
    data = await request("GET");
  } catch {
    callbacks.onStatus("offline", 0);
    return;
  }

  callbacks.onStatus("online", data.peers);
  callbacks.onNeighbors(data.pets);

  // Catch up changes made while pushes were failing or before sync started.
  const local = callbacks.getLocalPet();
  if (local.updatedAt > lastPushedUpdatedAt) {
    await pushNow(local);
  }
}

/**
 * Starts the LAN sync loop. Returns a stop function.
 * All store interaction happens through callbacks to avoid circular imports.
 */
export function startLanSync(callbacks: LanSyncCallbacks): () => void {
  stopLanSync();
  activeCallbacks = callbacks;
  callbacks.onStatus("connecting", 0);

  void pollTick();
  pollTimer = window.setInterval(() => {
    void pollTick();
  }, LAN_SYNC_POLL_MS);

  return stopLanSync;
}

export function stopLanSync(): void {
  if (pollTimer !== null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
  if (pushTimer !== null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
  activeCallbacks = null;
  lastPushedUpdatedAt = 0;
}
