import { PetData } from "./pet";
import { getDeviceId } from "./device";

export type LanSyncStatus = "connecting" | "online" | "offline";

export const LAN_SYNC_POLL_MS = 3_000;
export const LAN_RE_PUSH_MS = 60_000;
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
let lastPushSuccessAt = 0;
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

  const hasNewData = pet.updatedAt > lastPushedUpdatedAt;
  const registrationStale = Date.now() - lastPushSuccessAt >= LAN_RE_PUSH_MS;
  if (!hasNewData && !registrationStale) return;

  try {
    await request("POST", pet);
    lastPushedUpdatedAt = Math.max(lastPushedUpdatedAt, pet.updatedAt);
    lastPushSuccessAt = Date.now();
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

  // Push new changes, and re-register periodically so the pet stays visible
  // even after the sync server restarts or loses its stored data.
  await pushNow(callbacks.getLocalPet());
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
  lastPushSuccessAt = 0;
}
