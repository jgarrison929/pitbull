#!/usr/bin/env bash
# Copy Playwright *-actual.png from a downloaded CI `v5-playwright` artifact
# into tests/e2e/visual.spec.ts-snapshots/ (CI-truth regen path).
#
# Usage:
#   # 1) Push a UI change; let the v5 job fail visual checks.
#   # 2) Download the `v5-playwright` artifact zip and unzip it.
#   # 3) From repo root:
#   bash v5/scripts/adopt-visual-actuals.sh /path/to/unzipped/v5-playwright
#
# Prefer this (or visual-in-playwright-docker.sh --update) over agent-host
# `npx playwright test --update-snapshots`, which diverges from GHA pixels.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNAP="$ROOT/v5/tests/e2e/visual.spec.ts-snapshots"
SRC="${1:-}"

if [[ -z "$SRC" || ! -d "$SRC" ]]; then
  echo "usage: $0 <unzipped-v5-playwright-artifact-dir>" >&2
  exit 2
fi

mapfile -t ACTUALS < <(find "$SRC" -type f -name '*-actual.png' | sort)
if [[ ${#ACTUALS[@]} -eq 0 ]]; then
  echo "no *-actual.png under $SRC" >&2
  exit 1
fi

copied=0
for actual in "${ACTUALS[@]}"; do
  base="$(basename "$actual")"
  # Playwright names: job-desktop-actual.png → job-desktop-chromium-linux.png
  name="${base%-actual.png}"
  dest="$SNAP/${name}-chromium-linux.png"
  mkdir -p "$SNAP"
  if [[ ! -f "$dest" ]]; then
    echo "new baseline: $name" >&2
  fi
  cp -f "$actual" "$dest"
  echo "adopted $name ← $actual"
  copied=$((copied + 1))
done

if [[ "$copied" -eq 0 ]]; then
  echo "adopted 0 files — check artifact layout" >&2
  exit 1
fi
echo "adopted $copied baseline(s) into $SNAP"
