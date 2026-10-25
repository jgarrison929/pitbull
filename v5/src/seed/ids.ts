import { createHash } from "node:crypto";

/** Deterministic UUID from (companyId, key) — same id every seed for that sandbox. */
export function seedId(companyId: string, key: string): string {
  const h = createHash("sha256").update(`${companyId}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
