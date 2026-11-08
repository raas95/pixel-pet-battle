import { getDeviceId } from "./device";

export const DUEL_POLL_MS = 1_500;

export type DuelPlayerView = {
  deviceId: string;
  name: string;
  hp: number;
  streak: number;
  answered: boolean;
};

export type DuelEventView = {
  type: "none" | "collision" | "hit";
  byDeviceId: string | null;
  round: number;
};

export type DuelView = {
  id: string;
  status: "active" | "finished" | "declined";
  round: number;
  command: string | null;
  roundEndsAt: number | null;
  winner: string | null;
  lastEvent: DuelEventView | null;
  players: DuelPlayerView[];
};

export type DuelSnapshot = {
  incoming: { duelId: string; fromName: string } | null;
  duel: DuelView | null;
};

async function post(body: Record<string, unknown>): Promise<Response> {
  return fetch("/api/duel", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, deviceId: getDeviceId() }),
  });
}

/** Mengirim tantangan duel ke monster tetangga. */
export async function challengePet(target: {
  deviceId: string;
  name: string;
  myName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await post({
    action: "challenge",
    targetDeviceId: target.deviceId,
    targetName: target.name,
    name: target.myName,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { ok: false, error: data?.error ?? `Server merespons ${response.status}` };
  }
  return { ok: true };
}

/** Menerima atau menolak tantangan duel yang masuk. */
export async function respondDuel(
  duelId: string,
  accept: boolean
): Promise<boolean> {
  const response = await post({ action: "respond", duelId, accept });
  return response.ok;
}

/** Mengirim jawaban untuk ronde duel yang sedang berjalan. */
export async function submitDuelAnswer(
  duelId: string,
  answer: string
): Promise<void> {
  await post({ action: "answer", duelId, answer }).catch(() => undefined);
}

/**
 * Memulai polling state duel. Hanya memanggil onSnapshot saat ada perubahan
 * data (JSON berubah), agar store tidak di-render ulang terus-menerus.
 *
 * Hysteresis: bila snapshot terakhir yang diteruskan punya duel aktif,
 * snapshot kosong (duel + incoming null) ditahan dulu sampai
 * DUEL_MISS_TOLERANCE kali berurutan. Ini mencegah redirect liar ketika
 * sebuah request mendarat di instance server yang kebetulan tidak menyimpan
 * state duel (umum di serverless), sambil tetap mengakhiri duel yang
 * benar-benar hilang.
 */
export const DUEL_MISS_TOLERANCE = 3;

export function startDuelSync(onSnapshot: (snapshot: DuelSnapshot) => void): () => void {
  let lastJson = "";
  let stopped = false;
  let lastHadActiveDuel = false;
  let emptyStreak = 0;

  const tick = async () => {
    try {
      const deviceId = encodeURIComponent(getDeviceId());
      const response = await fetch(`/api/duel?deviceId=${deviceId}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Duel server merespons ${response.status}`);
      const json = await response.text();
      if (stopped) return;
      if (json === lastJson) {
        // Respons identik dengan state terakhir yang diteruskan: konfirmasi
        // state baik — reset penghitung snapshot kosong.
        if (lastHadActiveDuel) emptyStreak = 0;
        return;
      }

      const snapshot = JSON.parse(json) as DuelSnapshot;
      const isEmpty = !snapshot.duel && !snapshot.incoming;
      if (isEmpty && lastHadActiveDuel) {
        emptyStreak += 1;
        if (emptyStreak < DUEL_MISS_TOLERANCE) return;
      } else {
        emptyStreak = 0;
      }
      lastHadActiveDuel = snapshot.duel?.status === "active";

      lastJson = json;
      onSnapshot(snapshot);
    } catch {
      // Abaikan error jaringan; state lama dipertahankan dan polling
      // berikutnya mencoba lagi (fetch gagal tidak pernah mengosongkan duel).
    }
  };

  void tick();
  const timer = window.setInterval(() => {
    void tick();
  }, DUEL_POLL_MS);

  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
