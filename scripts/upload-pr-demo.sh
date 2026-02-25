#!/usr/bin/env bash
set -euo pipefail

# Upload a demo recording to a GitHub PR as a comment.
#
# Usage:
#   ./scripts/upload-pr-demo.sh <PR_NUMBER> <VIDEO_PATH>
#
# Prerequisites:
#   - gh CLI installed and authenticated
#   - Video file exists (MP4 or WebM)

if [ $# -lt 2 ]; then
  echo "Usage: $0 <PR_NUMBER> <VIDEO_PATH>"
  echo "Example: $0 375 e2e/recordings/demo-walkthrough-App-Walkthrough-Demo-demo-recording/video.mp4"
  exit 1
fi

PR_NUMBER="$1"
VIDEO_PATH="$2"

# ── Preflight: gh authentication ─────────────────────────────────
if ! gh auth status &>/dev/null; then
  echo "ERROR: gh CLI is not authenticated."
  echo "       Run: gh auth login"
  exit 1
fi

if [ ! -f "$VIDEO_PATH" ]; then
  echo "ERROR: Video file not found: $VIDEO_PATH"
  exit 1
fi

# ── Convert webm to mp4 if needed ───────────────────────────────
if [[ "$VIDEO_PATH" == *.webm ]]; then
  MP4_PATH="${VIDEO_PATH%.webm}.mp4"
  if [ ! -f "$MP4_PATH" ]; then
    if command -v ffmpeg &>/dev/null; then
      echo "==> Converting WebM to MP4..."
      ffmpeg -i "$VIDEO_PATH" -c:v libx264 -preset fast -crf 23 -y "$MP4_PATH" 2>/dev/null
    else
      echo "ERROR: ffmpeg required to convert WebM to MP4"
      exit 1
    fi
  fi
  VIDEO_PATH="$MP4_PATH"
fi

VIDEO_SIZE=$(du -h "$VIDEO_PATH" | cut -f1)
ASSET_NAME="pr-${PR_NUMBER}-demo.mp4"

echo "==> Uploading demo for PR #$PR_NUMBER ($ASSET_NAME, $VIDEO_SIZE)"

# ── Ensure demo-videos release exists ────────────────────────────
RELEASE_TAG="demo-videos"
if ! gh release view "$RELEASE_TAG" &>/dev/null; then
  echo "==> Creating demo-videos release..."
  gh release create "$RELEASE_TAG" --title "Demo Videos" --notes "Auto-generated demo recordings from PR demos." --prerelease
fi

# ── Upload with the PR-specific asset name ───────────────────────
# Copy to temp file with the desired name so gh uploads it correctly
TEMP_DIR=$(mktemp -d)
cp "$VIDEO_PATH" "$TEMP_DIR/$ASSET_NAME"
echo "==> Uploading $ASSET_NAME to release..."
gh release upload "$RELEASE_TAG" "$TEMP_DIR/$ASSET_NAME" --clobber
rm -rf "$TEMP_DIR"

# ── Get browser-accessible download URL ──────────────────────────
DOWNLOAD_URL=$(gh release view "$RELEASE_TAG" --json assets \
  --jq ".assets[] | select(.name == \"$ASSET_NAME\") | .url")

if [ -z "$DOWNLOAD_URL" ]; then
  DOWNLOAD_URL="(see the demo-videos release for the file)"
fi

# ── Post comment on the PR ───────────────────────────────────────
gh pr comment "$PR_NUMBER" --body "$(cat <<EOF
## Demo Recording

**File:** \`$ASSET_NAME\` ($VIDEO_SIZE)
**Download:** $DOWNLOAD_URL

_Recorded automatically by Pitbull's Playwright demo suite._
EOF
)"

echo "==> Comment posted on PR #$PR_NUMBER"
