import { NextRequest, NextResponse } from "next/server";
import { LETTERS } from "@/lib/letters";
import {
  DUEL_CHARGE_NEEDED,
  DUEL_DAMAGE,
  DUEL_FINISHED_RETENTION_MS,
  DUEL_MAX_HP,
  DUEL_PENDING_EXPIRY_MS,
  DUEL_ROUND_MS,
  Duel,
  DuelEvent,
} from "@/lib/duel";

export const dynamic = "force-dynamic";

type DuelStore = {
  duels: Map<string, Duel>;
};

/** Sepasang huruf acak yang berbeda untuk kedua pemain. */
function randomCommandPair(): [string, string] {
  const first = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const rest = LETTERS.filter((letter) => letter !== first);
  const second = rest[Math.floor(Math.random() * rest.length)];
  return [first, second];
}

// globalThis so dev HMR does not wipe ongoing duels on every edit.
const globalRef = globalThis as unknown as { __duelStore?: DuelStore };
const store: DuelStore = (globalRef.__duelStore ??= { duels: new Map() });

function prune(now: number): void {
  for (const [id, duel] of store.duels) {
    const age = now - duel.updatedAt;
    if (duel.status === "pending" && age > DUEL_PENDING_EXPIRY_MS) {
      store.duels.delete(id);
    } else if (
      (duel.status === "finished" || duel.status === "declined") &&
      age > DUEL_FINISHED_RETENTION_MS
    ) {
      store.duels.delete(id);
    }
  }
}

/**
 * Memilih duel yang relevan untuk sebuah device: duel aktif diprioritaskan,
 * lalu pending, lalu hasil akhir terbaru. Dengan ini duel lama yang masih
 * disimpan sementara tidak pernah menaungi duel yang sedang berjalan.
 */
function findRelevantDuel(deviceId: string): Duel | null {
  let best: Duel | null = null;
  let bestRank = -1;
  for (const duel of store.duels.values()) {
    if (!duel.players.some((p) => p.deviceId === deviceId)) continue;
    const rank =
      duel.status === "active" ? 2 : duel.status === "pending" ? 1 : 0;
    if (
      rank > bestRank ||
      (rank === bestRank && best !== null && duel.updatedAt > best.updatedAt)
    ) {
      best = duel;
      bestRank = rank;
    }
  }
  return best;
}

function isBusy(deviceId: string): boolean {
  for (const duel of store.duels.values()) {
    if (
      (duel.status === "pending" || duel.status === "active") &&
      duel.players.some((p) => p.deviceId === deviceId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolves the current round once both players answered or the timer expired.
 * Streak rules: correct answer +1 streak (capped at charge), wrong answer -1;
 * a correct answer while fully charged launches a projectile and resets the
 * streak to 0. Projectiles launched in the same round collide and cancel out.
 * Setiap pemain dinilai terhadap perintah hurufnya sendiri.
 */
function resolveRound(duel: Duel, now: number): void {
  const [commandA, commandB] = duel.commands;
  if (duel.status !== "active" || !commandA || !commandB || !duel.roundEndsAt) {
    return;
  }

  const [a, b] = duel.players;
  const bothAnswered = a.answer !== null && b.answer !== null;
  const timedOut = now >= duel.roundEndsAt;
  if (!bothAnswered && !timedOut) return;

  const aCorrect = a.answer !== null && a.answer === commandA;
  const bCorrect = b.answer !== null && b.answer === commandB;

  let aLaunches = false;
  let bLaunches = false;

  if (aCorrect) {
    if (a.streak >= DUEL_CHARGE_NEEDED) {
      aLaunches = true;
      a.streak = 0;
    } else {
      a.streak += 1;
    }
  } else {
    a.streak = Math.max(0, a.streak - 1);
  }

  if (bCorrect) {
    if (b.streak >= DUEL_CHARGE_NEEDED) {
      bLaunches = true;
      b.streak = 0;
    } else {
      b.streak += 1;
    }
  } else {
    b.streak = Math.max(0, b.streak - 1);
  }

  let event: DuelEvent = { type: "none", byDeviceId: null, round: duel.round };

  if (aLaunches && bLaunches) {
    event = { type: "collision", byDeviceId: null, round: duel.round };
  } else if (aLaunches || bLaunches) {
    const attacker = aLaunches ? a : b;
    const defender = aLaunches ? b : a;
    defender.hp = Math.max(0, defender.hp - DUEL_DAMAGE);
    event = { type: "hit", byDeviceId: attacker.deviceId, round: duel.round };
  }

  duel.lastEvent = event;
  duel.updatedAt = now;

  if (a.hp === 0 || b.hp === 0) {
    duel.status = "finished";
    duel.winner = a.hp === 0 ? b.deviceId : a.deviceId;
    duel.commands = [null, null];
    duel.roundEndsAt = null;
    return;
  }

  duel.round += 1;
  duel.commands = randomCommandPair();
  duel.roundEndsAt = now + DUEL_ROUND_MS;
  a.answer = null;
  b.answer = null;
}

function toPublicDuel(duel: Duel, forDeviceId?: string) {
  const myIndex = forDeviceId
    ? duel.players.findIndex((p) => p.deviceId === forDeviceId)
    : -1;
  return {
    id: duel.id,
    status: duel.status,
    round: duel.round,
    // Perintah huruf spesifik untuk peminta; penonton lain tidak melihatnya.
    command:
      duel.status === "active" && myIndex >= 0 ? duel.commands[myIndex] : null,
    roundEndsAt: duel.status === "active" ? duel.roundEndsAt : null,
    winner: duel.winner,
    lastEvent: duel.lastEvent,
    players: duel.players.map((p) => ({
      deviceId: p.deviceId,
      name: p.name,
      hp: p.hp,
      streak: p.streak,
      answered: p.answer !== null,
    })),
  };
}

export function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  const now = Date.now();
  prune(now);

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId wajib ada." }, { status: 400 });
  }

  const duel = findRelevantDuel(deviceId);
  if (duel) resolveRound(duel, now);

  let incoming = null;
  if (duel && duel.status === "pending" && duel.players[1].deviceId === deviceId) {
    incoming = { duelId: duel.id, fromName: duel.players[0].name };
  }

  const active =
    duel &&
    (duel.status === "active" ||
      duel.status === "finished" ||
      duel.status === "declined")
      ? toPublicDuel(duel, deviceId)
      : null;

  return NextResponse.json({ incoming, duel: active });
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const action = typeof record?.action === "string" ? record.action : null;
  const deviceId = typeof record?.deviceId === "string" ? record.deviceId : null;
  if (!action || !deviceId) {
    return NextResponse.json(
      { error: "Field 'action' dan 'deviceId' wajib ada." },
      { status: 400 }
    );
  }

  const now = Date.now();
  prune(now);

  if (action === "challenge") {
    const targetDeviceId =
      typeof record.targetDeviceId === "string" ? record.targetDeviceId : null;
    const name = typeof record.name === "string" ? record.name.slice(0, 20) : "Monster";
    const targetName =
      typeof record.targetName === "string" ? record.targetName.slice(0, 20) : "Lawan";
    if (!targetDeviceId || targetDeviceId === deviceId) {
      return NextResponse.json({ error: "Target duel tidak valid." }, { status: 400 });
    }
    if (isBusy(deviceId) || isBusy(targetDeviceId)) {
      return NextResponse.json(
        { error: "Salah satu pemain sudah punya duel aktif." },
        { status: 409 }
      );
    }
    const duel: Duel = {
      id: `duel-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      players: [
        { deviceId, name, hp: DUEL_MAX_HP, streak: 0, answer: null },
        { deviceId: targetDeviceId, name: targetName, hp: DUEL_MAX_HP, streak: 0, answer: null },
      ],
      round: 1,
      commands: [null, null],
      roundEndsAt: null,
      winner: null,
      lastEvent: null,
      updatedAt: now,
    };
    store.duels.set(duel.id, duel);
    return NextResponse.json({ duelId: duel.id, status: duel.status });
  }

  if (action === "respond") {
    const duelId = typeof record.duelId === "string" ? record.duelId : null;
    const accept = record.accept === true;
    const duel = duelId ? store.duels.get(duelId) : undefined;
    if (!duel || duel.status !== "pending" || duel.players[1].deviceId !== deviceId) {
      return NextResponse.json({ error: "Tantangan tidak ditemukan." }, { status: 404 });
    }
    if (accept) {
      duel.status = "active";
      duel.round = 1;
      duel.commands = randomCommandPair();
      duel.roundEndsAt = now + DUEL_ROUND_MS;
      duel.updatedAt = now;
      return NextResponse.json({
        status: duel.status,
        duel: toPublicDuel(duel, deviceId),
      });
    }
    duel.status = "declined";
    duel.updatedAt = now;
    return NextResponse.json({ status: duel.status });
  }

  if (action === "answer") {
    const duelId = typeof record.duelId === "string" ? record.duelId : null;
    const raw = typeof record.answer === "string" ? record.answer.toUpperCase() : "";
    const answer = raw.length > 0 ? raw[0] : null;
    const duel = duelId ? store.duels.get(duelId) : undefined;
    if (!duel || duel.status !== "active" || !answer) {
      return NextResponse.json({ error: "Duel tidak aktif." }, { status: 404 });
    }
    const player = duel.players.find((p) => p.deviceId === deviceId);
    if (!player) {
      return NextResponse.json({ error: "Kamu bukan pemain duel ini." }, { status: 403 });
    }
    if (player.answer !== null || !duel.roundEndsAt || now >= duel.roundEndsAt) {
      return NextResponse.json({ error: "Ronde sudah ditutup." }, { status: 409 });
    }
    player.answer = answer;
    resolveRound(duel, now);
    return NextResponse.json({
      status: duel.status,
      duel: toPublicDuel(duel, deviceId),
    });
  }

  return NextResponse.json({ error: "Action tidak dikenal." }, { status: 400 });
}
