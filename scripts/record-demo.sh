#!/usr/bin/env bash
set -euo pipefail

# Record a demo walkthrough of the Pitbull app using Playwright.
# Converts the .webm output to .mp4 and generates a GIF thumbnail.
#
# Usage:
#   DEMO_USER=... DEMO_PASSWORD=... ./scripts/record-demo.sh
#
# Environment variables (required):
#   DEMO_USER      — login email
#   DEMO_PASSWORD  — login password
#
# Environment variables (optional):
#   DEMO_BASE_URL  — target URL (default: http://localhost:3000)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
E2E_DIR="$ROOT_DIR/e2e"
RECORDINGS_DIR="$E2E_DIR/recordings"

# ── Preflight: credentials ───────────────────────────────────────
if [ -z "${DEMO_USER:-}" ] || [ -z "${DEMO_PASSWORD:-}" ]; then
  echo "ERROR: DEMO_USER and DEMO_PASSWORD env vars are required."
  echo "       Copy e2e/.env.example to e2e/.env, fill in values, then:"
  echo "         source e2e/.env && ./scripts/record-demo.sh"
  exit 1
fi

export DEMO_BASE_URL="${DEMO_BASE_URL:-http://localhost:3000}"
export DEMO_USER
export DEMO_PASSWORD

echo "==> Recording demo against $DEMO_BASE_URL"

# ── Preflight: Playwright installed ──────────────────────────────
cd "$E2E_DIR"
if [ ! -d "node_modules/@playwright" ]; then
  echo "==> Installing e2e dependencies..."
  npm ci
fi

if ! npx playwright install --dry-run chromium &>/dev/null 2>&1; then
  echo "==> Installing Chromium browser..."
  npx playwright install --with-deps chromium
fi

# ── Clean previous recordings ────────────────────────────────────
rm -rf "$RECORDINGS_DIR"
mkdir -p "$RECORDINGS_DIR"

# ── Run Playwright ───────────────────────────────────────────────
npx playwright test --project=demo-recording --reporter=list 2>&1

# ── Find the walkthrough recording (newest .webm, must be from the walkthrough test) ──
WALKTHROUGH_DIR="$RECORDINGS_DIR/demo-walkthrough-App-Walkthrough-Demo-demo-recording"
if [ -d "$WALKTHROUGH_DIR" ] && [ -f "$WALKTHROUGH_DIR/video.webm" ]; then
  WEBM_FILE="$WALKTHROUGH_DIR/video.webm"
else
  # Fallback: newest .webm in recordings
  WEBM_FILE=$(find "$RECORDINGS_DIR" -name "*.webm" -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2-)
fi

if [ -z "${WEBM_FILE:-}" ] || [ ! -f "$WEBM_FILE" ]; then
  echo "ERROR: No .webm recording found in $RECORDINGS_DIR"
  exit 1
fi

echo "==> Recording saved: $WEBM_FILE"

# ── Convert to MP4 ──────────────────────────────────────────────
MP4_FILE="${WEBM_FILE%.webm}.mp4"
if command -v ffmpeg &>/dev/null; then
  echo "==> Converting to MP4..."
  ffmpeg -i "$WEBM_FILE" -c:v libx264 -preset fast -crf 23 -y "$MP4_FILE" 2>/dev/null
  echo "==> MP4: $MP4_FILE"

  # Generate GIF thumbnail (first 10 seconds, 480px wide)
  GIF_FILE="${WEBM_FILE%.webm}.gif"
  echo "==> Generating GIF thumbnail..."
  ffmpeg -i "$MP4_FILE" -t 10 -vf "fps=10,scale=480:-1:flags=lanczos" -y "$GIF_FILE" 2>/dev/null
  echo "==> GIF: $GIF_FILE"
else
  echo "WARN: ffmpeg not found — skipping MP4/GIF conversion."
  echo "      Install ffmpeg for video conversion: sudo apt install ffmpeg"
fi

echo ""
echo "==> Done! Output files:"
echo "    WebM: $WEBM_FILE"
[ -f "${MP4_FILE:-}" ] && echo "    MP4:  $MP4_FILE"
[ -f "${GIF_FILE:-}" ] && echo "    GIF:  $GIF_FILE"
