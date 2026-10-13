import "server-only";

/** Server-only allowlist; an empty configuration grants nobody access. */
export function isAdmin(
  user: { email: string; emailVerified: boolean } | null,
) {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(
    user?.emailVerified && allowed.includes(user.email.toLowerCase()),
  );
}
