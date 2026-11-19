export const BOT_SEED_USER_ID_PREFIX = "bot-user-";
export const DEFAULT_SEEDED_ADMIN_USER_ID = "admin-vibra-001";
export const DEFAULT_SEEDED_ADMIN_EMAIL = "admin@vibra.com";
export const SHARED_SEEDED_BOT_EMAIL = "nome@vibra.app";

export function isSeedAccountBlockedFromLogin(
  userId: string,
  email?: string | null,
): boolean {
  return userId === DEFAULT_SEEDED_ADMIN_USER_ID
    || userId.startsWith(BOT_SEED_USER_ID_PREFIX)
    || email?.trim().toLowerCase() === DEFAULT_SEEDED_ADMIN_EMAIL
    || email?.trim().toLowerCase() === SHARED_SEEDED_BOT_EMAIL;
}
