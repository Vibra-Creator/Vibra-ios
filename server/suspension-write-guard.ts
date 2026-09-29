export type SuspensionGuardUser = {
  isAdmin?: boolean | null;
  email?: string | null;
};

export type SuspensionGuardRecord = {
  isPermanent?: boolean | null;
  expiresAt?: Date | null;
};

export type SuspensionWriteGuardDependencies = {
  getUser: (userId: string) => Promise<SuspensionGuardUser | undefined>;
  getActiveSuspension: (userId: string) => Promise<SuspensionGuardRecord | undefined>;
  adminEmails?: readonly string[];
  logError?: (message: string, error: unknown) => void;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * Blocks suspended non-admin accounts from creating or editing content through
 * HTTP APIs. Reports remain available, as do reads and deletion actions.
 */
export function createSuspensionWriteGuard(dependencies: SuspensionWriteGuardDependencies) {
  const adminEmails = new Set((dependencies.adminEmails ?? []).map((email) => email.toLowerCase()));

  return async (req: any, res: any, next: any) => {
    if (!WRITE_METHODS.has(String(req.method ?? "").toUpperCase())) return next();

    const path = String(req.originalUrl ?? req.url ?? "").split("?")[0];
    if (/^\/api\/(?:reports(?:\/|$)|admin(?:\/|$))/.test(path)) return next();

    const userId = req.user?.claims?.sub || req.session?.userId;
    if (!userId) return next();

    try {
      const user = await dependencies.getUser(userId);
      if (
        user?.isAdmin ||
        (user?.email && adminEmails.has(user.email.trim().toLowerCase()))
      ) {
        return next();
      }

      const suspension = await dependencies.getActiveSuspension(userId);
      if (!suspension) return next();

      return res.status(403).json({
        error: "Account suspended",
        reason: "account_suspended",
        suspensionExpiresAt: suspension.isPermanent ? null : suspension.expiresAt ?? null,
      });
    } catch (error) {
      dependencies.logError?.("[suspension-guard] Could not verify account status:", error);
      return res.status(503).json({ error: "Account status could not be verified" });
    }
  };
}