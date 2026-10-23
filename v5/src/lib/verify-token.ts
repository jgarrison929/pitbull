import "server-only";

/**
 * Shared secret for POST /api/verify/stamp.
 * Set `VERIFY_TOKEN` on the deploy (Railway staging) and in the verify-v5 runner env.
 */
export function resolveVerifyToken(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const token = env.VERIFY_TOKEN?.trim();
  return token || null;
}
