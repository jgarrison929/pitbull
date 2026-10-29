import fs from "node:fs";
import path from "node:path";
import { expect, test as base, type Locator, type Page, type TestInfo } from "@playwright/test";
import { pbTestRunFromCookieHeader } from "../../../../src/lib/posthog-test-run";

export const JOB_PATH = "/app/jobs/25-031";
export const VIEWPORT = { width: 1280, height: 800 } as const;
export const VIEWPORT_LABEL = "1280×800";
export const THEME = "light";
export const SUITE = "area-plan-edit";

/** Playwright compiles these tests as CJS, so paths hang off the v5 working directory. */
function v5Root(): string {
  const candidates = [process.cwd(), path.resolve(process.cwd(), "v5")];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "playwright.config.ts"))) return dir;
  }
  return process.cwd();
}

const evidenceDir = path.join(v5Root(), "test-results/areas/plan-edit");

export function isDeployedBase(baseURL: string | undefined): boolean {
  if (!baseURL) return false;
  try {
    const { hostname } = new URL(baseURL);
    return hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]";
  } catch {
    return false;
  }
}

export type ScenarioMeta = {
  scenario: string;
  page: string;
  role: string;
  viewport: string;
  theme: string;
  before: string;
  after: string;
  beforeTaken: boolean;
  afterTaken: boolean;
  replayUrl: string | null;
};

type ReplayWindow = Window & { __pbReplayUrl?: string };

export class Evidence {
  readonly scenario: string;
  role = "foreman";
  beforeTaken = false;
  afterTaken = false;
  replayUrl: string | null = null;

  constructor(scenario: string) {
    this.scenario = scenario;
  }

  file(which: "before" | "after"): string {
    return `${this.scenario}-${which}.jpg`;
  }

  async shoot(page: Page, which: "before" | "after", anchor: Locator): Promise<void> {
    fs.mkdirSync(evidenceDir, { recursive: true });
    await anchor.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: path.join(evidenceDir, this.file(which)),
      type: "jpeg",
      quality: 55,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    });
    if (which === "before") this.beforeTaken = true;
    else this.afterTaken = true;
  }

  write(): void {
    fs.mkdirSync(evidenceDir, { recursive: true });
    const meta: ScenarioMeta = {
      scenario: this.scenario,
      page: JOB_PATH,
      role: this.role,
      viewport: VIEWPORT_LABEL,
      theme: THEME,
      before: this.file("before"),
      after: this.file("after"),
      beforeTaken: this.beforeTaken,
      afterTaken: this.afterTaken,
      replayUrl: this.replayUrl,
    };
    fs.writeFileSync(
      path.join(evidenceDir, `${this.scenario}.json`),
      JSON.stringify(meta, null, 2),
    );
  }
}

function scenarioFromTitle(title: string): string {
  const match = title.match(/@(PB-97-S\d+)/);
  if (!match) throw new Error(`area test title is missing a @PB-97-S tag: ${title}`);
  return match[1];
}

function prValue(): string {
  const raw = process.env.PB_PR || process.env.GITHUB_PR_NUMBER || "local";
  return /^[A-Za-z0-9._-]+$/.test(raw) ? raw : "local";
}

async function installCookies(page: Page, testInfo: TestInfo, scenario: string) {
  const baseURL = testInfo.project.use.baseURL ?? "http://localhost:3100";
  const origin = new URL(baseURL).origin;
  // Chrome rejects a raw ";" inside a cookie value. Percent-encoding keeps the
  // example shape `pr=…;scenario=…;suite=…` after document.cookie decodes it.
  const value = `pr=${prValue()};scenario=${scenario};suite=${SUITE}`;
  await page.context().addCookies([
    { name: "pb_test_run", value: encodeURIComponent(value), url: origin },
    { name: "pcs_theme", value: THEME, url: origin },
  ]);
  await page.setViewportSize({ ...VIEWPORT });
  await page.goto("/login");
  const cookie = await page.evaluate(() => document.cookie);
  const parsed = pbTestRunFromCookieHeader(cookie);
  expect(parsed, `pb_test_run cookie must parse (${cookie})`).toEqual({
    pr: prValue(),
    scenario,
    suite: SUITE,
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", THEME);
}

async function captureReplay(page: Page, testInfo: TestInfo): Promise<string | null> {
  const baseURL = testInfo.project.use.baseURL;
  if (!isDeployedBase(baseURL) || testInfo.errors.length > 0) return null;
  await page.waitForFunction(
    () => {
      const url = (window as ReplayWindow).__pbReplayUrl;
      return typeof url === "string" && url.length > 0;
    },
    null,
    { timeout: 20_000 },
  );
  return page.evaluate(() => (window as ReplayWindow).__pbReplayUrl ?? null);
}

export const test = base.extend<{ evidence: Evidence }>({
  evidence: async ({ page }, run, testInfo) => {
    const evidence = new Evidence(scenarioFromTitle(testInfo.title));
    await installCookies(page, testInfo, evidence.scenario);
    await run(evidence);
    if (testInfo.errors.length === 0) {
      evidence.replayUrl = await captureReplay(page, testInfo);
    }
    evidence.write();
  },
});

export { expect };

export const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

export async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("data-theme", THEME);
}

export async function resetDemo(page: Page) {
  await page.getByTestId("user-menu").click();
  const seeded = await page.getByTestId("seeded-at").getAttribute("datetime");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/reset=1/, { timeout: 20_000 });
  if (seeded) {
    await expect(page.getByTestId("seeded-at")).not.toHaveAttribute(
      "datetime",
      seeded,
      { timeout: 20_000 },
    );
  }
}

export async function openJob(page: Page) {
  await page.goto(JOB_PATH);
  await expect(pourLine(page).getByTestId("line-mh")).toBeVisible({
    timeout: 20_000,
  });
}
