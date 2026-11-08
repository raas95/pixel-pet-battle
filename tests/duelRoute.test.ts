import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUEL_DAMAGE, DUEL_MAX_HP, DUEL_ROUND_MS } from "@/lib/duel";

type RouteModule = typeof import("@/app/api/duel/route");

async function importFreshRoute(): Promise<RouteModule> {
  vi.resetModules();
  delete (globalThis as unknown as { __duelStore?: unknown }).__duelStore;
  return import("@/app/api/duel/route");
}

function postJson(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/duel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getStatus(deviceId: string) {
  return new NextRequest(`http://localhost/api/duel?deviceId=${deviceId}`);
}

describe("route duel /api/duel", () => {
  let route: RouteModule;

  beforeEach(() => {
    vi.useRealTimers();
    return importFreshRoute().then((r) => {
      route = r;
    });
  });

  async function setupActiveDuel() {
    const challenge = await route.POST(
      postJson({
        action: "challenge",
        deviceId: "dev-a",
        name: "Andi",
        targetDeviceId: "dev-b",
        targetName: "Budi",
      })
    );
    const { duelId } = await challenge.json();
    const respond = await route.POST(
      postJson({ action: "respond", deviceId: "dev-b", duelId, accept: true })
    );
    const { duel } = await respond.json();
    return { duelId, command: duel.command as string };
  }

  it("tantangan muncul sebagai incoming di device target", async () => {
    await route.POST(
      postJson({
        action: "challenge",
        deviceId: "dev-a",
        name: "Andi",
        targetDeviceId: "dev-b",
        targetName: "Budi",
      })
    );
    const res = await route.GET(getStatus("dev-b"));
    const data = await res.json();
    expect(data.incoming).not.toBeNull();
    expect(data.incoming.fromName).toBe("Andi");
    expect(data.duel).toBeNull();
  });

  it("menolak tantangan mengubah status jadi declined", async () => {
    const challenge = await route.POST(
      postJson({
        action: "challenge",
        deviceId: "dev-a",
        name: "Andi",
        targetDeviceId: "dev-b",
        targetName: "Budi",
      })
    );
    const { duelId } = await challenge.json();
    await route.POST(
      postJson({ action: "respond", deviceId: "dev-b", duelId, accept: false })
    );
    const res = await route.GET(getStatus("dev-a"));
    const data = await res.json();
    expect(data.duel.status).toBe("declined");
  });

  it("menerima tantangan memulai duel dengan perintah huruf", async () => {
    const { command } = await setupActiveDuel();
    expect(command).toMatch(/^[A-Z]$/);
  });

  it("jawaban benar menambah streak; jawaban salah mengurangi satu", async () => {
    const { duelId, command } = await setupActiveDuel();
    const wrong = command === "A" ? "B" : "A";

    // Ronde 1: A benar (streak 1), B salah (tetap 0).
    await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
    await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: wrong }));

    // Ronde 2: A benar (streak 2), B benar (streak 1).
    let res = await route.GET(getStatus("dev-a"));
    let { duel } = await res.json();
    const command2 = duel.command as string;
    const wrong2 = command2 === "A" ? "B" : "A";
    await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command2 }));
    await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: command2 }));

    // Ronde 3: A salah (streak 2 -> 1), B benar (streak 2).
    res = await route.GET(getStatus("dev-a"));
    duel = (await res.json()).duel;
    const command3 = duel.command as string;
    const wrong3 = command3 === "A" ? "B" : "A";
    await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: wrong3 }));
    await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: command3 }));

    res = await route.GET(getStatus("dev-a"));
    duel = (await res.json()).duel;
    const a = duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-a");
    const b = duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-b");
    expect(a.streak).toBe(1);
    expect(b.streak).toBe(2);
    expect(a.hp).toBe(DUEL_MAX_HP);
    expect(duel.lastEvent.type).toBe("none");
    void wrong2;
  });

  it("jawaban benar ke-4 meluncurkan projektil dan mereset streak ke 0", async () => {
    const { duelId } = await setupActiveDuel();
    // 3 ronde: A selalu benar -> streak 3; B selalu salah.
    for (let round = 0; round < 3; round++) {
      const res = await route.GET(getStatus("dev-a"));
      const { duel } = await res.json();
      const command = duel.command as string;
      const wrong = command === "A" ? "B" : "A";
      await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
      await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: wrong }));
    }

    // Ronde 4: A benar lagi (streak 3 -> luncurkan, reset 0); B salah.
    let res = await route.GET(getStatus("dev-a"));
    let duel = (await res.json()).duel;
    expect(duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-a").streak).toBe(3);

    const command = duel.command as string;
    const wrong = command === "A" ? "B" : "A";
    await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
    await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: wrong }));

    res = await route.GET(getStatus("dev-a"));
    duel = (await res.json()).duel;
    const a = duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-a");
    const b = duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-b");
    expect(a.streak).toBe(0);
    expect(b.hp).toBe(DUEL_MAX_HP - DUEL_DAMAGE);
    expect(duel.lastEvent.type).toBe("hit");
    expect(duel.lastEvent.byDeviceId).toBe("dev-a");
  });

  it("dua projektil di ronde yang sama bertabrakan dan batal", async () => {
    const { duelId } = await setupActiveDuel();
    // Kedua pemain benar 3 ronde -> streak 3-3.
    for (let round = 0; round < 3; round++) {
      const res = await route.GET(getStatus("dev-a"));
      const { duel } = await res.json();
      const command = duel.command as string;
      await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
      await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: command }));
    }
    // Ronde 4: keduanya benar -> keduanya meluncurkan -> tabrakan.
    let res = await route.GET(getStatus("dev-a"));
    let duel = (await res.json()).duel;
    const command = duel.command as string;
    await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
    await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: command }));

    res = await route.GET(getStatus("dev-a"));
    duel = (await res.json()).duel;
    expect(duel.lastEvent.type).toBe("collision");
    expect(duel.players.every((p: { hp: number }) => p.hp === DUEL_MAX_HP)).toBe(true);
    expect(duel.players.every((p: { streak: number }) => p.streak === 0)).toBe(true);
  });

  it("HP habis menandai duel selesai dengan pemenang yang tepat", async () => {
    const { duelId } = await setupActiveDuel();
    // A selalu benar (serangan tiap 4 ronde), B selalu salah.
    // Damage 20 dari HP 100 -> 5 serangan -> 20 ronde.
    for (let round = 0; round < 20; round++) {
      const res = await route.GET(getStatus("dev-a"));
      const { duel } = await res.json();
      if (duel.status === "finished") break;
      const command = duel.command as string;
      const wrong = command === "A" ? "B" : "A";
      await route.POST(postJson({ action: "answer", deviceId: "dev-a", duelId, answer: command }));
      await route.POST(postJson({ action: "answer", deviceId: "dev-b", duelId, answer: wrong }));
    }
    const res = await route.GET(getStatus("dev-a"));
    const { duel } = await res.json();
    expect(duel.status).toBe("finished");
    expect(duel.winner).toBe("dev-a");
    const b = duel.players.find((p: { deviceId: string }) => p.deviceId === "dev-b");
    expect(b.hp).toBe(0);
  });

  it("menolak jawaban dari device yang bukan pemain", async () => {
    const { duelId, command } = await setupActiveDuel();
    const res = await route.POST(
      postJson({ action: "answer", deviceId: "dev-x", duelId, answer: command })
    );
    expect(res.status).toBe(403);
  });

  it("device yang sudah punya duel tidak bisa menerima tantangan baru", async () => {
    await setupActiveDuel();
    const res = await route.POST(
      postJson({
        action: "challenge",
        deviceId: "dev-c",
        name: "Citra",
        targetDeviceId: "dev-a",
        targetName: "Andi",
      })
    );
    expect(res.status).toBe(409);
  });

  it("ronde yang tidak dijawab kedua pemain selesai lewat timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now());
    const { duelId } = await setupActiveDuel();

    vi.setSystemTime(Date.now() + DUEL_ROUND_MS + 500);
    const res = await route.GET(getStatus("dev-a"));
    const { duel } = await res.json();

    // Timeout dianggap salah: streak turun satu dari 0 tetap 0, HP utuh.
    expect(duel.round).toBe(2);
    expect(duel.players.every((p: { hp: number }) => p.hp === DUEL_MAX_HP)).toBe(true);
    vi.useRealTimers();
    void duelId;
  });
});
