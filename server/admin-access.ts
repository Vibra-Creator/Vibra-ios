export const ADMIN_EMAILS: string[] = [
  "famax61@yahoo.com",
  "famax61@gmail.com",
];

export function isAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = email?.trim().toLowerCase();
  return Boolean(normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail));
}

export function shouldPromoteVerifiedAdmin(user: {
  email?: string | null;
  emailVerified?: boolean | null;
  isAdmin?: boolean | null;
}): boolean {
  return user.isAdmin !== true && user.emailVerified === true && isAdminEmail(user.email);
}
