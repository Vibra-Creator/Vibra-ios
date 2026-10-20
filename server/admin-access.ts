export const ADMIN_EMAILS = ["famax61@yahoo.com", "famax61@gmail.com"] as const;

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && ADMIN_EMAILS.includes(email.trim().toLowerCase() as typeof ADMIN_EMAILS[number]));
}
