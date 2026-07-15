/**
 * Detect client/deploy mismatch errors that need a hard refresh (3.2.3).
 * Honest copy only — does not invent server status.
 */

export const DEPLOY_RECOVERY_MESSAGE =
  "This page is out of date after a deploy. Refresh to load the latest version.";

const SERVER_ACTION_PATTERNS = [
  /failed to find server action/i,
  /server action.*not found/i,
  /invalid server action/i,
  /chunkloaderror/i,
  /loading chunk \d+ failed/i,
  /dynamically imported module/i,
];

export function isDeployStaleClientError(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return SERVER_ACTION_PATTERNS.some((re) => re.test(message));
}

export function deployRecoveryCopy(message: string | null | undefined): string | null {
  if (!isDeployStaleClientError(message)) return null;
  return DEPLOY_RECOVERY_MESSAGE;
}
