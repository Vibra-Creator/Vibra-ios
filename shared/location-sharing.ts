export const LOCATION_SHARE_TTL_MS = 15 * 60 * 1000;
export const LOCATION_SHARE_HEARTBEAT_MS = 5 * 60 * 1000;
export const LOCATION_SHARE_CLEANUP_INTERVAL_MS = 60 * 1000;

export function getLocationShareCutoff(now: Date | number = Date.now()): Date {
  const nowMs = now instanceof Date ? now.getTime() : now;
  return new Date(nowMs - LOCATION_SHARE_TTL_MS);
}

export function isValidLocationCoordinates(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180;
}
