type DirectMessageTarget = {
  isBot?: boolean | null;
  userId?: string | null;
};

export function shouldAutoReplyToDirectMessage(target: DirectMessageTarget | null | undefined): boolean {
  if (!target || target.isBot !== true) return false;
  const hasRealAccount = typeof target.userId === "string" && target.userId.trim().length > 0;
  return !hasRealAccount;
}
