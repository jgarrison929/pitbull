import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Money, SHORT_MONEY_CENTS, StatusIndex } from "@/components/app/format";

describe("Money short KPI threshold", () => {
  it("shows usdShort at $10,000 with exact title and data-cents", () => {
    const html = renderToStaticMarkup(
      <Money cents={69_000_000} shortAboveCents={SHORT_MONEY_CENTS} />,
    );
    expect(html).toContain(">$690K<");
    expect(html).toContain('data-cents="69000000"');
    expect(html).toContain('title="$690,000.00"');
    expect(html).not.toContain("$690,000.00<");
  });

  it("keeps exact cents below $10,000", () => {
    const html = renderToStaticMarkup(
      <Money cents={999_999} shortAboveCents={SHORT_MONEY_CENTS} />,
    );
    expect(html).toContain("$9,999.99");
    expect(html).toContain('data-cents="999999"');
    expect(html).toContain('title="$9,999.99"');
  });

  it("puts the exact value on compact summaries", () => {
    const html = renderToStaticMarkup(<Money cents={25_500_000} />);
    expect(html).toContain(">$255K<");
    expect(html).toContain('title="$255,000.00"');
    expect(html).toContain('data-cents="25500000"');
  });
});

describe("StatusIndex words", () => {
  it("stacks At risk when asked", () => {
    const html = renderToStaticMarkup(
      <StatusIndex index={0.82} varianceCents={-13_500_000} statusWord />,
    );
    expect(html).toContain("At risk");
    expect(html).toContain("−$135K");
    expect(html).toContain('data-status="at-risk"');
  });

  it("keeps the index and the dollar when the word is off", () => {
    const html = renderToStaticMarkup(
      <StatusIndex index={1.05} varianceCents={100} />,
    );
    expect(html).not.toContain("On track");
    expect(html).toContain("+$1");
  });
});
