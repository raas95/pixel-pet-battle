import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PetData } from "@/lib/pet";
import { migratePetData } from "@/lib/storage";

export const dynamic = "force-dynamic";

const PEER_TIMEOUT_MS = 10_000;
const NEIGHBOR_TIMEOUT_MS = 30_000;
const DATA_DIR = process.env.PET_SYNC_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "pet-sync.json");

type SyncStore = {
  pets: Map<string, PetData>;
  lastSeen: Map<string, number>;
};

function loadPersistedPets(): Map<string, PetData> {
  const pets = new Map<string, PetData>();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const record = parsed as Record<string, unknown>;
    if (!record || typeof record !== "object" || !record.pets) return pets;
    const entries = record.pets as Record<string, unknown>;
    for (const [deviceId, pet] of Object.entries(entries)) {
      pets.set(deviceId, migratePetData(pet));
    }
  } catch {
    // Missing or corrupt file starts fresh.
  }
  return pets;
}

function persistPets(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const entries = Object.fromEntries(store.pets);
    fs.writeFileSync(DATA_FILE, JSON.stringify({ pets: entries }));
  } catch {
    // Persistence is best-effort; in-memory state keeps serving clients.
  }
}

// globalThis so dev HMR does not wipe the registry on every edit.
const globalRef = globalThis as unknown as { __petSyncStore?: SyncStore };
const store: SyncStore = (globalRef.__petSyncStore ??= {
  pets: loadPersistedPets(),
  lastSeen: new Map(),
});

function touchPeer(deviceId: string | null): void {
  if (deviceId) {
    store.lastSeen.set(deviceId, Date.now());
  }
}

function prunePeers(now: number): void {
  for (const [id, lastSeen] of store.lastSeen) {
    if (now - lastSeen > PEER_TIMEOUT_MS) {
      store.lastSeen.delete(id);
    }
  }
}

function buildPayload(now: number) {
  prunePeers(now);
  const pets = Array.from(store.pets.entries())
    .filter(
      ([deviceId]) =>
        now - (store.lastSeen.get(deviceId) ?? 0) <= NEIGHBOR_TIMEOUT_MS
    )
    .map(([deviceId, pet]) => ({ deviceId, pet }));

  return {
    pets,
    peers: store.lastSeen.size,
    now,
  };
}

export function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  touchPeer(deviceId);

  return NextResponse.json(buildPayload(Date.now()));
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  if (!record || typeof record !== "object" || !record.pet) {
    return NextResponse.json({ error: "Field 'pet' wajib ada." }, { status: 400 });
  }

  const deviceId = typeof record.deviceId === "string" ? record.deviceId : null;
  touchPeer(deviceId);

  const incoming = migratePetData(record.pet);
  const existing = deviceId ? store.pets.get(deviceId) : undefined;
  const accepted = !existing || incoming.updatedAt > existing.updatedAt;
  if (deviceId && accepted) {
    store.pets.set(deviceId, incoming);
    persistPets();
  }

  const payload = buildPayload(Date.now());
  return NextResponse.json({ ...payload, accepted });
}
