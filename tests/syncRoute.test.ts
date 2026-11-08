import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultPet } from "@/lib/pet";

type RouteModule = typeof import("@/app/api/pet/route");

const tempDirs: string[] = [];

async function importFreshRoute(): Promise<RouteModule> {
  vi.resetModules();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pet-sync-test-"));
  tempDirs.push(dir);
  process.env.PET_SYNC_DATA_DIR = dir;
  delete (globalThis as unknown as { __petSyncStore?: unknown }).__petSyncStore;
  return import("@/app/api/pet/route");
}

function makeGet(deviceId: string) {
  return new NextRequest(`http://localhost/api/pet?deviceId=${deviceId}`);
}

function makePost(body: unknown, deviceId = "dev-test") {
  return new NextRequest("http://localhost/api/pet", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...((body as object) ?? {}), deviceId }),
  });
}

afterAll(() => {
  delete process.env.PET_SYNC_DATA_DIR;
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("route sinkronisasi LAN /api/pet", () => {
  let route: RouteModule;

  beforeEach(async () => {
    route = await importFreshRoute();
  });

  it("GET awal mengembalikan daftar pet kosong dan menghitung device sebagai peer", async () => {
    const res = await route.GET(makeGet("dev-a"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pets).toEqual([]);
    expect(data.peers).toBe(1);
  });

  it("POST menyimpan pet per device dan device lain bisa melihatnya", async () => {
    const petA = { ...createDefaultPet(1_000), name: "Andi" };
    await route.POST(makePost({ pet: petA }, "dev-a"));

    const res = await route.GET(makeGet("dev-b"));
    const data = await res.json();
    expect(data.peers).toBe(2);
    expect(data.pets).toHaveLength(1);
    expect(data.pets[0].deviceId).toBe("dev-a");
    expect(data.pets[0].pet.name).toBe("Andi");
  });

  it("tiap device menyimpan pet sendiri tanpa saling menimpa", async () => {
    const petA = { ...createDefaultPet(1_000), name: "Andi" };
    const petB = { ...createDefaultPet(2_000), name: "Budi" };

    await route.POST(makePost({ pet: petA }, "dev-a"));
    await route.POST(makePost({ pet: petB }, "dev-b"));

    const res = await route.GET(makeGet("dev-c"));
    const data = await res.json();
    const names = data.pets.map((entry: { pet: { name: string } }) => entry.pet.name);
    expect(names.sort()).toEqual(["Andi", "Budi"]);
  });

  it("konflik per device ditutup dengan last-write-wins berdasarkan updatedAt", async () => {
    const newer = { ...createDefaultPet(2_000), name: "Baru" };
    const older = { ...createDefaultPet(500), name: "Lama" };

    await route.POST(makePost({ pet: newer }, "dev-a"));
    const staleRes = await route.POST(makePost({ pet: older }, "dev-a"));
    expect((await staleRes.json()).accepted).toBe(false);

    const getRes = await route.GET(makeGet("dev-a"));
    const entry = (await getRes.json()).pets[0];
    expect(entry.pet.name).toBe("Baru");
  });

  it("menolak body tanpa field pet", async () => {
    const res = await route.POST(makePost(null));
    expect(res.status).toBe(400);
  });

  it("menormalkan nilai status di luar rentang 0-100", async () => {
    const weird = {
      ...createDefaultPet(3_000),
      hunger: 500,
      energy: -20,
    };
    await route.POST(makePost({ pet: weird }, "dev-a"));

    const getRes = await route.GET(makeGet("dev-b"));
    const entry = (await getRes.json()).pets[0];
    expect(entry.pet.hunger).toBe(100);
    expect(entry.pet.energy).toBe(0);
  });

  it("pet milik sendiri ikut tercantum di daftar (client yang menyaringnya)", async () => {
    const petA = { ...createDefaultPet(1_000), name: "Andi" };
    await route.POST(makePost({ pet: petA }, "dev-a"));

    const res = await route.GET(makeGet("dev-a"));
    const data = await res.json();
    expect(data.pets.map((e: { deviceId: string }) => e.deviceId)).toContain("dev-a");
  });
});
