import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { PetData } from "@/lib/pet";
import { migratePetData } from "@/lib/storage";

export const dynamic = "force-dynamic";

const PEER_TIMEOUT_MS = 10_000;
const DATA_DIR = process.env.PET_SYNC_DATA_DIR ?? path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "pet-sync.json");

type SyncStore = {
  pet: PetData | null;
  peers: Map<string, number>;
};

function loadPersistedPet(): PetData | null {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    const record = parsed as Record<string, unknown>;
    if (!record || typeof record !== "object" || !record.pet) return null;
    return migratePetData(record.pet);
  } catch {
    return null;
  }
}

function persistPet(pet: PetData): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ pet }));
  } catch {
    // Persistence is best-effort; in-memory state keeps serving clients.
  }
}

// globalThis so dev HMR does not wipe the shared pet on every edit.
const globalRef = globalThis as unknown as { __petSyncStore?: SyncStore };
const store: SyncStore = (globalRef.__petSyncStore ??= {
  pet: loadPersistedPet(),
  peers: new Map(),
});

function touchPeer(deviceId: string | null): void {
  if (deviceId) {
    store.peers.set(deviceId, Date.now());
  }
}

function prunePeers(now: number): void {
  for (const [id, lastSeen] of store.peers) {
    if (now - lastSeen > PEER_TIMEOUT_MS) {
      store.peers.delete(id);
    }
  }
}

export function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  touchPeer(deviceId);

  const now = Date.now();
  prunePeers(now);

  return NextResponse.json({
    pet: store.pet,
    peers: store.peers.size,
    now,
  });
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
  const isNewer = !store.pet || incoming.updatedAt > store.pet.updatedAt;
  if (isNewer) {
    store.pet = incoming;
    persistPet(incoming);
  }

  const now = Date.now();
  prunePeers(now);

  return NextResponse.json({
    pet: store.pet,
    peers: store.peers.size,
    accepted: isNewer,
    now,
  });
}
