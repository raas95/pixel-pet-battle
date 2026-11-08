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

  it("GET awal mengembalikan pet null dan menghitung device sebagai peer", async () => {
    const res = await route.GET(makeGet("dev-a"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.pet).toBeNull();
    expect(data.peers).toBe(1);
  });

  it("POST menyimpan pet dan GET mengembalikannya", async () => {
    const pet = { ...createDefaultPet(1_000), name: "Bimo" };
    const postRes = await route.POST(makePost({ pet }));
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.accepted).toBe(true);

    const getRes = await route.GET(makeGet("dev-a"));
    const getData = await getRes.json();
    expect(getData.pet.name).toBe("Bimo");
    expect(getData.pet.updatedAt).toBe(1_000);
  });

  it("konflik ditutup dengan last-write-wins berdasarkan updatedAt", async () => {
    const older = { ...createDefaultPet(500), name: "Lama" };
    const newer = { ...createDefaultPet(2_000), name: "Baru" };

    await route.POST(makePost({ pet: newer }));
    const staleRes = await route.POST(makePost({ pet: older }));
    expect((await staleRes.json()).accepted).toBe(false);

    const getRes = await route.GET(makeGet("dev-a"));
    expect((await getRes.json()).pet.name).toBe("Baru");
  });

  it("POST dengan data lebih baru menimpa data lama", async () => {
    const older = { ...createDefaultPet(100), name: "Lama" };
    const newer = { ...createDefaultPet(9_000), name: "Menang" };

    await route.POST(makePost({ pet: older }));
    const res = await route.POST(makePost({ pet: newer }));
    expect((await res.json()).accepted).toBe(true);

    const getRes = await route.GET(makeGet("dev-a"));
    expect((await getRes.json()).pet.name).toBe("Menang");
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
    await route.POST(makePost({ pet: weird }));
    const getRes = await route.GET(makeGet("dev-a"));
    const pet = (await getRes.json()).pet;
    expect(pet.hunger).toBe(100);
    expect(pet.energy).toBe(0);
  });

  it("menghitung banyak device unik sebagai peer", async () => {
    await route.GET(makeGet("dev-a"));
    await route.GET(makeGet("dev-b"));
    await route.GET(makeGet("dev-a"));

    const res = await route.GET(makeGet("dev-c"));
    expect((await res.json()).peers).toBe(3);
  });
});
