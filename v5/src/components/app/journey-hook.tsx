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
        const order = PREFER[role] ?? ACTION_IDS;
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
      if (!status || !eac) return;
      if (inView(status) && inView(eac)) return;
      const sr = status.getBoundingClientRect();
      const er = eac.getBoundingClientRect();
      const top = Math.min(sr.top, er.top);
      const bottom = Math.max(sr.bottom, er.bottom);
      if (bottom - top <= window.innerHeight) {
        window.scrollTo(0, Math.max(0, window.scrollY + top - 8));
        return;
      }
      const focus = window.innerWidth < 768 ? status : eac;
      focus.scrollIntoView({ block: "center" });
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
