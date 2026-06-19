# PR Demo Video Recordings — Design Spec

## Vision
Every PR that ships a user-facing feature gets an automatically recorded demo video attached. The AI builds the feature, then demonstrates it by navigating the running app and recording the browser session.

Inspired by Cursor's agent demo feature (Feb 25, 2026).

## Architecture

### Option A: Pipeline Script (River-driven) ← RECOMMENDED for MVP
1. Claude Code finishes feature, creates PR
2. River reads the PR diff and determines which pages/features changed
3. River writes a Playwright test script tailored to the feature
4. Script runs against localhost (dev server)
5. Playwright records video (MP4)
6. Video is uploaded to the PR as a comment via `gh pr comment`
7. Optional: generate GIF thumbnail for PR description

### Option B: GitHub Action (automated)
- Runs on `pull_request` events
- Spins up the app in the CI environment
- Runs a generic "walkthrough" Playwright suite
- Uploads video artifact + comments on PR
- Pro: fully automated. Con: CI minutes, slower, harder to target specific features.

### Option C: Hybrid
- GitHub Action runs a generic walkthrough on every PR
- River writes feature-specific recordings for important PRs
- Best of both worlds, higher complexity

**Decision: Start with Option A.** River already knows what the feature does (wrote the prompt). Writing a targeted Playwright script per feature is more valuable than a generic walkthrough.

## Tech Stack

```
Playwright (TypeScript) — browser automation + video recording
  ├── @playwright/test — test runner with built-in video
  ├── Video: .webm → ffmpeg → .mp4 (for GitHub compatibility)
  └── Screenshots: PNG at key moments (for GIF/thumbnail)

gh CLI — upload video as PR comment
ffmpeg — video format conversion, GIF generation
```

## Project Structure

```
e2e/
├── playwright.config.ts          — config (baseURL, video settings)
├── fixtures/
│   └── auth.setup.ts             — login as demo user, save auth state
├── recordings/
│   └── .gitkeep                  — output directory (gitignored)
├── scripts/
│   ├── record-feature.ts         — generic feature recorder
│   └── upload-to-pr.sh           — upload video to PR comment
└── tests/
    └── demo-walkthrough.spec.ts  — generic app walkthrough
```

## Playwright Config

```typescript
// e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.DEMO_BASE_URL || 'http://localhost:3000',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 }
    },
    screenshot: 'on',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'demo-recording',
      dependencies: ['setup'],
      use: {
        storageState: 'e2e/.auth/user.json',
      },
    },
  ],
});
```

## Auth Setup

```typescript
// e2e/fixtures/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="email"]', process.env.DEMO_USER || 'ceo@demo.local');
  await page.fill('[name="password"]', process.env.DEMO_PASSWORD || 'PitbullDemo2026!');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

## Feature Recording Pattern

For each PR, River generates a test file like:

```typescript
// e2e/tests/weather-api-demo.spec.ts
import { test, expect } from '@playwright/test';

test('Weather API Demo', async ({ page }) => {
  // Navigate to a project with GPS coordinates
  await page.goto('/projects');
  await page.click('text=Highway 99 Bridge');

  // Go to daily reports
  await page.click('text=Daily Reports');
  await page.click('text=New Report');

  // Show weather auto-populate
  await page.waitForSelector('[data-testid="weather-summary"]');
  await page.waitForTimeout(2000); // Let viewer see the result

  // Show the weather data filled in
  const weather = page.locator('[data-testid="weather-summary"]');
  await expect(weather).not.toBeEmpty();

  // Pause for viewer
  await page.waitForTimeout(3000);
});
```

## Upload Script

```bash
#!/bin/bash
# e2e/scripts/upload-to-pr.sh
PR_NUMBER=$1
VIDEO_PATH=$2

# Convert webm to mp4 if needed
if [[ "$VIDEO_PATH" == *.webm ]]; then
  MP4_PATH="${VIDEO_PATH%.webm}.mp4"
  ffmpeg -i "$VIDEO_PATH" -c:v libx264 -preset fast "$MP4_PATH" -y
  VIDEO_PATH="$MP4_PATH"
fi

# Generate GIF thumbnail (first 10 seconds, 480px wide)
GIF_PATH="${VIDEO_PATH%.mp4}.gif"
ffmpeg -i "$VIDEO_PATH" -t 10 -vf "fps=10,scale=480:-1" "$GIF_PATH" -y

# Upload to GitHub PR
# GitHub doesn't support video in comments directly — use a workaround:
# Option 1: Upload to a GitHub issue attachment (drag-drop API)
# Option 2: Upload to Railway/S3 and link
# Option 3: Use gh release upload to a "demo-videos" release and link

# For now: comment with link to CI artifact
gh pr comment "$PR_NUMBER" --body "## 🎬 Demo Recording

![Demo GIF]($GIF_PATH)

**Full video:** [Download MP4]($VIDEO_PATH)

_Automatically recorded by Pitbull's AI pipeline after feature implementation._"
```

## Pipeline Integration

After Claude Code creates a PR:

```bash
# 1. Start dev server (if not running)
cd src/Pitbull.Web/pitbull-web && npm run dev &
DEV_PID=$!

# 2. Wait for server
npx wait-on http://localhost:3000 --timeout 30000

# 3. Run the feature-specific recording
npx playwright test e2e/tests/feature-demo.spec.ts --project=demo-recording

# 4. Upload to PR
bash e2e/scripts/upload-to-pr.sh $PR_NUMBER e2e/recordings/*.webm

# 5. Clean up
kill $DEV_PID
```

## OR: Record Against Production Demo

Record against local dev server:

```bash
DEMO_BASE_URL=http://localhost:3000 npx playwright test --project=demo-recording
```

This avoids spinning up a local dev server entirely. Works for any feature that's been merged and deployed.

## MVP Scope (Ship This Week)

1. [ ] Install Playwright in pitbull-web (`npm init playwright@latest`)
2. [ ] Create playwright.config.ts with video recording enabled
3. [ ] Create auth setup fixture (login as demo user)
4. [ ] Create a generic "app walkthrough" recording (dashboard → projects → billing → admin)
5. [ ] Create upload-to-pr.sh script
6. [ ] Test the full loop: record → convert → upload → PR comment
7. [ ] Document the process so River can generate per-feature test files

## Future Enhancements

- **AI narration:** After recording, use ElevenLabs (River's voice) to narrate what's happening. Overlay audio on the video.
- **Auto-detect affected pages:** Parse the PR diff to determine which frontend pages changed, auto-generate navigation script.
- **Before/after comparison:** Record the same flow on main (before) and the feature branch (after), show side-by-side.
- **Investor reel:** Auto-compile best demo clips into a monthly highlight reel.
- **GitHub Action:** Automate for every PR, not just River-dispatched ones.
