#!/usr/bin/env bash
# Render visual baselines in the pinned Playwright Docker image so local
# pixels match CI at maxDiffPixels: 0.
#
# Image tag tracks v5's @playwright/test (package-lock). Prefer noble
# (Ubuntu 24.04, same family as GHA ubuntu-latest); fall back to jammy.
#
# Usage (from repo root or v5/):
#   bash v5/scripts/visual-in-playwright-docker.sh              # run visual.spec
#   bash v5/scripts/visual-in-playwright-docker.sh --update      # refresh snapshots
#   bash v5/scripts/visual-in-playwright-docker.sh -- all e2e    # full suite
#
# Requires: Docker, Postgres reachable as host.docker.internal:5432 (or
# DATABASE_URL pointing at a URL the container can reach).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
V5="$ROOT/v5"
LOCK="$V5/package-lock.json"
PW_VER="$(node -e "
  const p=require(process.argv[1]);
  const v=p.packages?.['node_modules/@playwright/test']?.version
    || p.packages?.['node_modules/playwright']?.version;
  if (!v) { console.error('playwright version missing from lockfile'); process.exit(1); }
  process.stdout.write(v);
" "$LOCK")"

IMAGE_NOBLE="mcr.microsoft.com/playwright:v${PW_VER}-noble"
IMAGE_JAMMY="mcr.microsoft.com/playwright:v${PW_VER}-jammy"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker not found. Use the CI artifact path instead:" >&2
  echo "  see v5/README.md § Visual baselines" >&2
  exit 1
fi

IMAGE="$IMAGE_NOBLE"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  if ! docker pull "$IMAGE" 2>/dev/null; then
    echo "noble image unavailable; trying jammy ($IMAGE_JAMMY)" >&2
    IMAGE="$IMAGE_JAMMY"
    docker pull "$IMAGE"
  fi
fi

UPDATE=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--update" ]]; then
    UPDATE=1
  else
    ARGS+=("$a")
  fi
done

if [[ ${#ARGS[@]} -eq 0 ]]; then
  ARGS=(tests/e2e/visual.spec.ts)
fi

PW_ARGS=("${ARGS[@]}")
if [[ "$UPDATE" -eq 1 ]]; then
  PW_ARGS+=(--update-snapshots)
fi

# Prefer host networking on Linux so the container can use the host's
# Postgres on 127.0.0.1 (postgres often listens on localhost only).
PORT="${PORT:-3100}"
GIT_COMMIT_SHA="${GIT_COMMIT_SHA:-$(git -C "$ROOT" rev-parse HEAD)}"
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "$(uname -s)" == "Linux" ]]; then
    DATABASE_URL="postgres://pcs:pcs_dev@127.0.0.1:5432/pcs_v5"
  else
    DATABASE_URL="postgres://pcs:pcs_ci@host.docker.internal:5432/pcs_v5_ci"
  fi
fi
export DATABASE_URL

# Optional wall-clock freeze for seed-clock proof (libfaketime on next-server).
# Example: FAKETIME='@2026-10-25 00:10:00' bash scripts/visual-in-playwright-docker.sh
FAKETIME="${FAKETIME:-}"

echo "Playwright image: $IMAGE"
echo "DATABASE_URL: $DATABASE_URL"
echo "FAKETIME: ${FAKETIME:-unset}"
echo "Args: npx playwright test ${PW_ARGS[*]}"

DOCKER_NET=(--ipc=host)
if [[ "$(uname -s)" == "Linux" ]]; then
  DOCKER_NET+=(--network=host)
else
  DOCKER_NET+=(--add-host=host.docker.internal:host-gateway -p "${PORT}:${PORT}")
fi

docker run --rm \
  "${DOCKER_NET[@]}" \
  -e DATABASE_URL \
  -e GIT_COMMIT_SHA \
  -e PORT \
  -e CI=1 \
  -e CI_GATE_RESULT=pass \
  -e LAST_VERIFY_AT=2026-10-20T17:00:00.000Z \
  -e LAST_VERIFY_COMMIT=0057a2c9b0e7 \
  -e V5_SEED_NOW=2026-10-20T17:00:00.000Z \
  -e FAKETIME \
  -v "$V5:/work" \
  -w /work \
  "$IMAGE" \
  bash -lc '
    set -euo pipefail
    # Match GHA ubuntu-latest fallback fonts (Harbor glyphs CI has; stock
    # Playwright noble does not). Safe with SVG ✓/▾; needed for any residual
    # system-font glyphs in Chromium.
    pkgs=(fonts-dejavu-core)
    if [[ -n "${FAKETIME:-}" ]]; then pkgs+=(libfaketime); fi
    if command -v apt-get >/dev/null 2>&1; then
      apt-get update -qq
      DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${pkgs[@]}" >/dev/null
      fc-cache -f >/dev/null 2>&1 || true
    fi
    if [[ -n "${FAKETIME:-}" ]]; then
      # Pin next-server wall clock; browser stays on visual.spec page.clock.
      export LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1
      export FAKETIME_NO_CACHE=1
      echo "libfaketime active: FAKETIME=$FAKETIME LD_PRELOAD=$LD_PRELOAD"
    fi
    npm ci
    npm run db:prepare
    npm run build
    npx playwright test "$@"
  ' _ "${PW_ARGS[@]}"
