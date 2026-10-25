import { Fragment, type ReactNode } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline SVGs for glyphs Geist does not ship. Painting ✓ / ▾ / ▸ as text
 * pulls host fallback fonts and breaks visual baselines across CI vs Docker.
 */

export function DoneMark({ className }: { className?: string }) {
  return (
    <Check
      className={cn(
        "inline-block size-[0.95em] shrink-0 align-[-0.12em] text-current",
        className,
      )}
      aria-label="complete"
      strokeWidth={2.5}
    />
  );
}

export function TreeToggleIcon({
  expanded,
  className,
}: {
  expanded: boolean;
  className?: string;
}) {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <Icon
      className={cn("inline-block size-3.5 shrink-0 text-current", className)}
      aria-hidden
      strokeWidth={2.25}
    />
  );
}

/** Split earn-derivation text so ✓ never paints as a font glyph. */
export function DerivationText({ text }: { text: string }) {
  if (!text.includes("✓")) return <>{text}</>;
  const parts = text.split("✓");
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) nodes.push(<Fragment key={`t${i}`}>{parts[i]}</Fragment>);
    if (i < parts.length - 1) {
      nodes.push(<DoneMark key={`c${i}`} />);
    }
  }
  return <>{nodes}</>;
}
