import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time equality for bearer tokens.
 * Length mismatch still runs a dummy compare so timing does not leak length alone.
 */
export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
