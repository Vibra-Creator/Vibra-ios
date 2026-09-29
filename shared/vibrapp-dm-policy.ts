type DirectMessageTarget = {
  isBot?: boolean | null;
  userId?: string | null;
};

type LegacyColdMessageReply = {
  replied?: boolean | null;
  replyContent?: string | null;
};

export function shouldAutoReplyToDirectMessage(target: DirectMessageTarget | null | undefined): boolean {
  if (!target || target.isBot !== true) return false;
  const hasRealAccount = typeof target.userId === "string" && target.userId.trim().length > 0;
  return !hasRealAccount;
}

export function getLegacyBotReplyState(
  target: DirectMessageTarget | null | undefined,
  message: LegacyColdMessageReply | null | undefined,
): { replied: boolean; replyContent: string | null } {
  if (!shouldAutoReplyToDirectMessage(target)) {
    return { replied: false, replyContent: null };
  }

  return {
    replied: message?.replied ?? false,
    replyContent: message?.replyContent ?? null,
  };
}