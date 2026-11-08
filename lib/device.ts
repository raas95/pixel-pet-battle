const DEVICE_ID_KEY = "pixel_pet_device_id";

/**
 * Stable per-browser identifier used to count distinct devices on the sync server.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    window.localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}
