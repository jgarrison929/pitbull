#!/usr/bin/env bash
# Orchestrates role-based E2E on Linux/macOS (CI + local).
# Usage: ./scripts/run-role-e2e.sh [--smoke] [--skip-playwright]
set -euo pipefail

SMOKE=false
SKIP_PLAYWRIGHT=false
API_URL="${API_URL:-http://localhost:5081}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
SCRATCH_DIR="${SCRATCH_DIR:-/tmp/pitbull-role-e2e}"
ROLE_E2E_DIR="${SCRATCH_DIR}/role-e2e"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --smoke) SMOKE=true; shift ;;
    --skip-playwright) SKIP_PLAYWRIGHT=true; shift ;;
    --api-url) API_URL="$2"; shift 2 ;;
    --web-url) WEB_URL="$2"; shift 2 ;;
    --scratch-dir) SCRATCH_DIR="$2"; ROLE_E2E_DIR="${SCRATCH_DIR}/role-e2e"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

mkdir -p "$ROLE_E2E_DIR"
LOG_FILE="${SCRATCH_DIR}/role-e2e-orchestrator.log"

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line"
  echo "$line" >>"$LOG_FILE"
}

log "=== Role E2E orchestrator (bash) ==="
log "Scratch: $SCRATCH_DIR smoke=$SMOKE"

for url in "${API_URL}/health/live" "$WEB_URL"; do
  if curl -sf --max-time 10 "$url" >/dev/null; then
    log "PASS health $url"
  else
    log "FAIL health $url - start API (Development + Demo__Enabled) and frontend first"
    exit 1
  fi
done

if command -v pwsh >/dev/null 2>&1; then
  SMOKE_LOG="${SCRATCH_DIR}/role-smoke.log"
  : >"$SMOKE_LOG"
  for run in 1 2; do
    for profile in PM AR AP; do
      log "Role smoke run $run profile $profile"
      pwsh -NoProfile -File "$(dirname "$0")/workflow-api-smoke.ps1" \
        -BaseUrl "$API_URL" \
        -RunNumber "$run" \
        -RoleProfile "$profile" \
        -UseDemoUsers \
        -LogFile "$SMOKE_LOG" || true
    done
  done
  log "Role smoke complete -> $SMOKE_LOG"
else
  log "SKIP role API smoke (pwsh not installed)"
fi

if [[ "$SKIP_PLAYWRIGHT" == "true" ]]; then
  log "=== Orchestrator finished (playwright skipped) ==="
  exit 0
fi

export DEMO_BASE_URL="$WEB_URL"
export API_BASE_URL="$API_URL"
export E2E_OUTPUT_DIR="$ROLE_E2E_DIR"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

pushd "$ROOT_DIR/e2e" >/dev/null
npm ci --silent 2>/dev/null || npm install --silent
npx playwright install --with-deps chromium

if [[ "$SMOKE" == "true" ]]; then
  export E2E_RUN_TAG="ci-smoke-$(date +%s)"
  log "Playwright smoke: L4 owner billing (tag=$E2E_RUN_TAG)"
  npx playwright test --project=setup-roles 2>&1 | tee "${ROLE_E2E_DIR}/setup-roles-smoke.log"
  npx playwright test tests/role-workflows.spec.ts --project=role-workflows --grep "L4" 2>&1 \
    | tee "${ROLE_E2E_DIR}/playwright-smoke-l4.log"
else
  for run in 1 2; do
    export E2E_RUN_TAG="orchestrator-run${run}-$(date +%H%M%S%3N)"
    log "Playwright role-workflows run $run (tag=$E2E_RUN_TAG)"
    npx playwright test --project=setup-roles 2>&1 | tee "${ROLE_E2E_DIR}/setup-roles-run-${run}.log"
    npx playwright test --project=role-workflows 2>&1 | tee "${ROLE_E2E_DIR}/playwright-run-${run}.log"
  done
fi
popd >/dev/null

log "=== Orchestrator finished ==="