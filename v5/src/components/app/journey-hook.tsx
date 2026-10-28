"use client";

import { useLayoutEffect } from "react";

const ACTION_IDS = [
  "submit-plan",
  "approve-report",
  "report-work",
  "co-approve",
  "approve-estimate",
] as const;

/** Which control on a hashed action screen is that role's one tap. */
const PREFER: Record<string, readonly string[]> = {
  superintendent: [
    "approve-report",
    "submit-plan",
    "report-work",
    "co-approve",
    "approve-estimate",
  ],
  foreman: [
    "report-work",
    "submit-plan",
    "approve-report",
    "co-approve",
    "approve-estimate",
  ],
  pm: [
    "co-approve",
    "approve-estimate",
    "submit-plan",
    "approve-report",
    "report-work",
  ],
  executive: [
    "approve-estimate",
    "co-approve",
    "submit-plan",
    "approve-report",
    "report-work",
  ],
};

function shown(el: Element) {
  const html = el as HTMLElement;
  if (html.getClientRects().length === 0) return false;
  const cs = getComputedStyle(html);
  return cs.visibility !== "hidden" && cs.display !== "none";
}

function inView(el: Element) {
  const r = el.getBoundingClientRect();
  return r.top >= 0 && r.bottom <= window.innerHeight;
}

/**
 * One-tap hook for a journey action screen. The hash from the next step
 * (`#plan-`, `#co-`, `#estimate`) names the card. Exactly one visible control
 * in that card gets `data-role` equal to the signed-in role, and it is
 * scrolled fully into view. Read-only ends (executive job, forecast) set no
 * hook. Executive job pages pull the status pill and the EAC card into the
 * same viewport when they fit.
 */
export function JourneyHook({ role }: { role: string }) {
  useLayoutEffect(() => {
    const apply = () => {
      for (const id of ACTION_IDS) {
        for (const el of document.querySelectorAll(`[data-testid="${id}"]`)) {
          el.removeAttribute("data-role");
        }
      }

      const hash = location.hash.replace(/^#/, "");
      const root = hash ? document.getElementById(hash) : null;
      if (root) {
        const preferred = PREFER[role] ?? ACTION_IDS;
        // #estimate is the Harbor approve control. co-approve is not in that card.
        const order =
          hash === "estimate"
            ? (["approve-estimate", ...preferred] as const)
            : preferred;
        let picked: HTMLElement | null = null;
        for (const id of order) {
          const hit = [...root.querySelectorAll(`[data-testid="${id}"]`)].find(
            shown,
          );
          if (hit) {
            picked = hit as HTMLElement;
            break;
          }
        }
        if (picked) {
          picked.setAttribute("data-role", role);
          if (!inView(picked)) {
            picked.scrollIntoView({ block: "center" });
          }
        }
        return;
      }

      if (role !== "executive") return;
      if (!/^\/app\/jobs\/[^/]+$/.test(location.pathname)) return;
      const status = document.querySelector('[data-testid="job-status"]');
      const eac = document
        .querySelector('[data-testid="job-eac"]')
        ?.closest("[data-card]");
      const cpi = document
        .querySelector('[data-testid="job-cpi"]')
        ?.closest("[data-card]");
      const parts = [eac, cpi, status].filter(
        (el): el is Element => el != null && shown(el),
      );
      if (!eac || !status || parts.length === 0) return;
      if (parts.every((el) => inView(el))) return;
      const rects = parts.map((el) => el.getBoundingClientRect());
      const top = Math.min(...rects.map((r) => r.top));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      // Keep EAC and CPI on screen. Centering the status pill scrolls the
      // KPI row above a 568px phone (top about -700).
      if (bottom - top <= window.innerHeight - 16) {
        window.scrollBy(0, top - 8);
        return;
      }
      eac.scrollIntoView({ block: "start" });
    };

    apply();
    const frame = requestAnimationFrame(apply);
    window.addEventListener("hashchange", apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", apply);
    };
  }, [role]);

  return null;
}
