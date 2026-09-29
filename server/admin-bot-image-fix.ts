import type { Express, RequestHandler } from "express";

export const ADMIN_BOT_IMAGE_FIX_PATH = "/api/admin/fix-bot-images";

export function registerAdminBotImageFixRoute(
  app: Express,
  isAuthenticated: RequestHandler,
  isAdmin: RequestHandler,
  handler: RequestHandler,
): void {
  app.get(ADMIN_BOT_IMAGE_FIX_PATH, isAuthenticated, isAdmin, handler);
}