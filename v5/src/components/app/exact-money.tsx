"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { usdCents, usdShort } from "@/lib/ev";
import { cn } from "@/lib/utils";

const PHONE_MQ = "(max-width: 767px)";

function subscribePhone(onStoreChange: () => void) {
  const mq = window.matchMedia(PHONE_MQ);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getPhoneSnapshot() {
  return window.matchMedia(PHONE_MQ).matches;
}

/** SSR / first paint: prefer phone compact so desktop is the hydrate flip. */
function getPhoneServerSnapshot() {
  return true;
}

/**
 * Exact cents at tablet/desktop. On phone: one compact figure; tap swaps to
 * exact (and back). Never mounts both strings at once — dual CSS renders were
 * leaking `$11K$10,750.00$10,750.00` into textContent / Playwright asserts.
 */
export function ExactMoney({
  cents,
  signed = false,
  className,
}: {
  cents: number;
  signed?: boolean;
  className?: string;
}) {
  const phone = useSyncExternalStore(
    subscribePhone,
    getPhoneSnapshot,
    getPhoneServerSnapshot,
  );
  const [showExact, setShowExact] = useState(false);
  const tone = signed
    ? cents < 0
      ? "text-negative"
      : cents > 0
        ? "text-positive"
        : ""
    : "";
  const sign = signed && cents > 0 ? "+" : "";
  const exactText = usdCents(cents);
  const shortText = usdShort(cents);
  const toggle = useCallback(() => setShowExact((v) => !v), []);

  if (!phone) {
    return (
      <span
        className={cn("whitespace-nowrap tabular-nums", tone, className)}
        data-cents={cents}
      >
        {sign}
        {exactText}
      </span>
    );
  }

  const label = showExact ? exactText : shortText;
  return (
    <button
      type="button"
      data-cents={cents}
      data-testid="money-exact-toggle"
      aria-expanded={showExact}
      aria-label={
        showExact
          ? `Exact ${sign}${exactText}. Show compact.`
          : `Compact ${sign}${shortText}. Show exact.`
      }
      onClick={toggle}
      className={cn(
        "tap-target inline max-w-full cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] tabular-nums text-inherit",
        tone,
        className,
      )}
    >
      {sign}
      {label}
    </button>
  );
}
