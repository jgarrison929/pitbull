import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DerivationText, TreeToggleIcon } from "./ui-glyphs";

describe("ui glyphs (no fallback-font unicode)", () => {
  it("renders ✓ as an SVG check, not a text glyph", () => {
    const html = renderToStaticMarkup(
      DerivationText({ text: "Mobilization in 50% ✓; other (open)" }),
    );
    expect(html).not.toContain("✓");
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="complete"');
    expect(html).toContain("Mobilization in 50%");
    expect(html).toContain("(open)");
  });

  it("passes through derivation text without a check mark", () => {
    const html = renderToStaticMarkup(
      DerivationText({ text: "units complete: 4.2 of 4.2 AC installed" }),
    );
    expect(html).toBe("units complete: 4.2 of 4.2 AC installed");
  });

  it("tree toggle is an SVG chevron", () => {
    const open = renderToStaticMarkup(TreeToggleIcon({ expanded: true }));
    const closed = renderToStaticMarkup(TreeToggleIcon({ expanded: false }));
    expect(open).toContain("<svg");
    expect(closed).toContain("<svg");
    expect(open).not.toContain("▾");
    expect(closed).not.toContain("▸");
  });
});
