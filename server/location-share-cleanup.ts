import { LOCATION_SHARE_CLEANUP_INTERVAL_MS } from "@shared/location-sharing";
import { storage } from "./storage";
import { safeErrorType } from "./http-hardening";

let cleanupStarted = false;

export function startLocationShareCleanup(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const cleanupExpiredShares = () => {
    void storage.deleteExpiredLocationShares().catch((error) => {
      console.error(
        "[location-share-cleanup] Failed to remove expired location shares:",
        safeErrorType(error),
      );
    });
  };

  cleanupExpiredShares();
  const timer = setInterval(cleanupExpiredShares, LOCATION_SHARE_CLEANUP_INTERVAL_MS);
  timer.unref();
}
