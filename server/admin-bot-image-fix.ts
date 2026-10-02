import type { Express, RequestHandler } from "express";

export const ADMIN_BOT_IMAGE_FIX_PATH = "/api/admin/fix-bot-images";

export interface BotImageFixProfile {
  id: string;
  isBot: boolean | null;
  imageUrl: string | null;
  photos: string[] | null;
}

export interface BotImageFixUpdates {
  imageUrl?: string;
  photos?: string[];
}

export interface BotImageFixStore {
  getProfiles(): Promise<BotImageFixProfile[]>;
  updateProfile(profileId: string, updates: BotImageFixUpdates): Promise<void>;
  countFixedBotImages(): Promise<number>;
}

export function getBotImageFixUpdates(
  profile: BotImageFixProfile,
): BotImageFixUpdates | null {
  if (!profile.isBot) return null;

  const updates: BotImageFixUpdates = {};
  if (
    profile.imageUrl?.startsWith("/images/bots/bot") &&
    /\.(?:png|jpg)$/.test(profile.imageUrl)
  ) {
    updates.imageUrl = profile.imageUrl.replace(/\.(?:png|jpg)$/, ".webp");
  }

  if (profile.photos?.length) {
    const photos = profile.photos.map((photo) =>
      photo.replace(/\.png$/, ".webp").replace(/\.jpg$/, ".webp"),
    );
    if (photos.some((photo, index) => photo !== profile.photos![index])) {
      updates.photos = photos;
    }
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

export function createAdminBotImageFixHandler(
  store: BotImageFixStore,
): RequestHandler {
  return async (_req, res) => {
    try {
      const profiles = await store.getProfiles();
      for (const profile of profiles) {
        const updates = getBotImageFixUpdates(profile);
        if (updates) await store.updateProfile(profile.id, updates);
      }

      const botsWebp = await store.countFixedBotImages();
      return res.json({ success: true, botsWebp });
    } catch (error) {
      console.error("Fix bot images error:", error);
      return res.status(500).json({ error: "Failed to fix bot images" });
    }
  };
}

export function registerAdminBotImageFixRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  isAdmin: RequestHandler,
  handler: RequestHandler,
): void {
  app.get(ADMIN_BOT_IMAGE_FIX_PATH, isAuthenticated, isAdmin, handler);
}