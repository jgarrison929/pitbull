import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Figure } from "@/components/app/format";
import { MetricCard } from "@/components/app/metric-card";

describe("MetricCard (5.0.4-c)", () => {
  it("marks the root as data-card with one primary figure", () => {
    const html = renderToStaticMarkup(
      <MetricCard label="Contract value" value="$73.0M" testId="kpi-contract" />,
    );
    expect(html).toContain('data-card="true"');
    expect(html).toContain('data-figure="primary"');
    expect(html).toContain('data-testid="kpi-contract"');
    expect(html).toContain('data-text="label"');
    expect(html.match(/data-figure="primary"/g)).toHaveLength(1);
    expect(html).not.toContain('data-figure="secondary"');
  });

  it("wraps sub as one secondary figure and caps secondary at two", () => {
    const withSub = renderToStaticMarkup(
      <MetricCard label="Earned" value="$1.2M" sub="vs $1.0M planned" />,
    );
    expect(withSub.match(/data-figure="secondary"/g)).toHaveLength(1);

    const withTwo = renderToStaticMarkup(
      <MetricCard
        label="CPI"
        value="0.93"
        secondary={["EV $1.0M", "AC $1.1M", "ignored third"]}
      />,
    );
    expect(withTwo.match(/data-figure="secondary"/g)).toHaveLength(2);
    expect(withTwo).not.toContain("ignored third");
  });

  it("renders an optional details region with a tap-sized summary", () => {
    const html = renderToStaticMarkup(
      <MetricCard
        label="EAC"
        value="$68M"
        details={<span>Derivation notes</span>}
        detailsSummary="How this is calculated"
      />,
    );
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("tap-target");
    expect(html).toContain("How this is calculated");
    expect(html).toContain("Derivation notes");
  });
});

describe("Figure (5.0.4-c)", () => {
  it("sets data-figure for primary and secondary", () => {
    expect(renderToStaticMarkup(<Figure>$12</Figure>)).toContain(
      'data-figure="primary"',
    );
    expect(
      renderToStaticMarkup(<Figure variant="secondary">40%</Figure>),
    ).toContain('data-figure="secondary"');
  });
});
