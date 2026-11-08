import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DUEL_DAMAGE, DUEL_MAX_HP, DUEL_ROUND_MS } from "@/lib/duel";

type RouteModule = typeof import("@/app/api/duel/route");

type PublicDuel = {
  status: string;
  round: number;
  command: string | null;
  winner: string | null;
  lastEvent: { type: string; byDeviceId: string | null; round: number } | null;
  players: {
    deviceId: string;
    name: string;
    hp: number;
    streak: number;
    answered: boolean;
  }[];
};

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

function wrongLetter(command: string): string {
  return command === "A" ? "B" : "A";
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
    await route.POST(
      postJson({ action: "respond", deviceId: "dev-b", duelId, accept: true })
    );
    return duelId;
  }

  async function getDuel(deviceId: string): Promise<PublicDuel> {
    const res = await route.GET(getStatus(deviceId));
    return (await res.json()).duel;
  }

  /** Jawab satu ronde; benarA/benarB menentukan jawaban tiap pemain. */
  async function playRound(
    duelId: string,
    benarA: boolean,
    benarB: boolean
  ): Promise<PublicDuel> {
    const cmdA = (await getDuel("dev-a")).command!;
    const cmdB = (await getDuel("dev-b")).command!;
    await route.POST(
      postJson({
        action: "answer",
        deviceId: "dev-a",
        duelId,
        answer: benarA ? cmdA : wrongLetter(cmdA),
      })
    );
    await route.POST(
      postJson({
        action: "answer",
        deviceId: "dev-b",
        duelId,
        answer: benarB ? cmdB : wrongLetter(cmdB),
      })
    );
    return getDuel("dev-a");
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

  it("perintah ronde kedua pemain berbeda satu sama lain", async () => {
    const duelId = await setupActiveDuel();
    const cmdA = (await getDuel("dev-a")).command;
    const cmdB = (await getDuel("dev-b")).command;
    expect(cmdA).toMatch(/^[A-Z]$/);
    expect(cmdB).toMatch(/^[A-Z]$/);
    expect(cmdA).not.toBe(cmdB);

    // Tetap berbeda setelah ronde berganti.
    await playRound(duelId, true, true);
    const nextA = (await getDuel("dev-a")).command;
    const nextB = (await getDuel("dev-b")).command;
    expect(nextA).not.toBe(nextB);
  });

  it("jawaban benar menambah streak; jawaban salah mengurangi satu", async () => {
    const duelId = await setupActiveDuel();

    // Ronde 1: A benar (streak 1), B salah (tetap 0).
    await playRound(duelId, true, false);
    // Ronde 2: A benar (streak 2), B benar (streak 1).
    await playRound(duelId, true, true);
    // Ronde 3: A salah (streak 2 -> 1), B benar (streak 2).
    const duel = await playRound(duelId, false, true);

    const a = duel.players.find((p) => p.deviceId === "dev-a")!;
    const b = duel.players.find((p) => p.deviceId === "dev-b")!;
    expect(a.streak).toBe(1);
    expect(b.streak).toBe(2);
    expect(a.hp).toBe(DUEL_MAX_HP);
    expect(duel.lastEvent!.type).toBe("none");
  });

  it("jawaban benar ke-4 meluncurkan projektil dan mereset streak ke 0", async () => {
    const duelId = await setupActiveDuel();
    // 3 ronde A benar -> streak 3; B selalu salah.
    for (let i = 0; i < 3; i++) {
      await playRound(duelId, true, false);
    }
    let duel = await getDuel("dev-a");
    expect(duel.players.find((p) => p.deviceId === "dev-a")!.streak).toBe(3);

    // Ronde 4: A benar lagi -> luncurkan, reset 0; B salah.
    duel = await playRound(duelId, true, false);

    const a = duel.players.find((p) => p.deviceId === "dev-a")!;
    const b = duel.players.find((p) => p.deviceId === "dev-b")!;
    expect(a.streak).toBe(0);
    expect(b.hp).toBe(DUEL_MAX_HP - DUEL_DAMAGE);
    expect(duel.lastEvent!.type).toBe("hit");
    expect(duel.lastEvent!.byDeviceId).toBe("dev-a");
  });

  it("dua projektil di ronde yang sama bertabrakan dan batal", async () => {
    const duelId = await setupActiveDuel();
    // Kedua pemain benar 3 ronde -> streak 3-3.
    for (let i = 0; i < 3; i++) {
      await playRound(duelId, true, true);
    }
    // Ronde 4: keduanya benar -> keduanya meluncurkan -> tabrakan.
    const duel = await playRound(duelId, true, true);

    expect(duel.lastEvent!.type).toBe("collision");
    expect(duel.players.every((p) => p.hp === DUEL_MAX_HP)).toBe(true);
    expect(duel.players.every((p) => p.streak === 0)).toBe(true);
  });

  it("HP habis menandai duel selesai dengan pemenang yang tepat", async () => {
    const duelId = await setupActiveDuel();
    // A selalu benar (serangan tiap 4 ronde), B selalu salah.
    // Damage 20 dari HP 100 -> 5 serangan -> 20 ronde.
    for (let round = 0; round < 20; round++) {
      const duel = await getDuel("dev-a");
      if (duel.status === "finished") break;
      await playRound(duelId, true, false);
    }
    const duel = await getDuel("dev-a");
    expect(duel.status).toBe("finished");
    expect(duel.winner).toBe("dev-a");
    expect(duel.players.find((p) => p.deviceId === "dev-b")!.hp).toBe(0);
  });

  it("duel baru tetap terliwal walau duel lama masih disimpan", async () => {
    // Duel pertama selesai (masih disimpan 60 detik).
    const firstId = await setupActiveDuel();
    for (let i = 0; i < 20; i++) {
      const duel = await getDuel("dev-a");
      if (duel.status === "finished") break;
      await playRound(firstId, true, false);
    }

    // Duel kedua antara pemain yang sama harus tetap terlihat sebagai aktif.
    const secondId = await setupActiveDuel();
    const duel = await getDuel("dev-a");
    expect(secondId).not.toBe(firstId);
    expect(duel.status).toBe("active");
    expect(duel.players.every((p) => p.hp === DUEL_MAX_HP)).toBe(true);
  });

  it("menolak jawaban dari device yang bukan pemain", async () => {
    const duelId = await setupActiveDuel();
    const cmdA = (await getDuel("dev-a")).command!;
    const res = await route.POST(
      postJson({ action: "answer", deviceId: "dev-x", duelId, answer: cmdA })
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
    await setupActiveDuel();

    vi.setSystemTime(Date.now() + DUEL_ROUND_MS + 500);
    const duel = await getDuel("dev-a");

    // Timeout dianggap salah: streak turun satu dari 0 tetap 0, HP utuh.
    expect(duel.round).toBe(2);
    expect(duel.players.every((p) => p.hp === DUEL_MAX_HP)).toBe(true);
    vi.useRealTimers();
  });
});
