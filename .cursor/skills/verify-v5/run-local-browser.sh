#!/usr/bin/env bash
# Start a built v5 app and run the full verify-v5 browser flow against it.
# Prerequisites (same as v5 CI): npm ci, db:prepare, npm run build, Playwright Chromium in v5/.
# Env: DATABASE_URL (required), GIT_COMMIT_SHA (required), PORT (default 3100),
#      CI_GATE_RESULT (default pass), LAST_VERIFY_AT (optional; same shape as e2e),
#      VERIFY_TOKEN (optional; when set, verify.mjs stamps /api/verify/stamp),
#      STRESS_PORT (default PORT+1; second server with V5_SEED_STRESS=1 for the stress-seed check).
# Order: stress-seed check first (fails before any stamp), then the full verify.mjs flow.
set -euo pipefail

root="$(cd "$(dirname "$0")/../../.." && pwd)"
port="${PORT:-3100}"
stress_port="${STRESS_PORT:-$((port + 1))}"
commit="${GIT_COMMIT_SHA:?GIT_COMMIT_SHA is required}"
expected12="$(printf '%s' "$commit" | cut -c1-12)"
url="http://localhost:${port}"

export CI_GATE_RESULT="${CI_GATE_RESULT:-pass}"
# Shape-only stamp so /status last-verify is never blank (mirrors playwright.config.ts).
export LAST_VERIFY_AT="${LAST_VERIFY_AT:-2026-10-20T17:00:00.000Z}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

# Refuse a busy port — an orphaned next-server would make /health look "ready" for the wrong build.
port_free() {
  PORT="$1" node -e '
  const net = require("node:net");
  const port = Number(process.env.PORT);
  const s = net.createServer();
  s.once("error", () => process.exit(1));
  s.listen(port, "127.0.0.1", () => s.close(() => process.exit(0)));
'
}
for p in "$port" "$stress_port"; do
  if ! port_free "$p"; then
    echo "port ${p} already in use — refuse to start (would verify the wrong build)" >&2
    exit 1
  fi
done

# Job control so the background npm/next tree shares a process group we can kill.
set -m
cd "$root/v5"
npm run start -- -p "$port" &
server_pid=$!
stress_pid=""

stop_stress() {
  if [[ -n "$stress_pid" ]] && kill -0 "$stress_pid" 2>/dev/null; then
    kill -TERM -- -"$stress_pid" 2>/dev/null || kill -TERM "$stress_pid" 2>/dev/null || true
    wait "$stress_pid" 2>/dev/null || true
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${stress_port}/tcp" >/dev/null 2>&1 || true
  fi
  stress_pid=""
}

cleanup() {
  stop_stress
  if kill -0 "$server_pid" 2>/dev/null; then
    # Kill the whole group (npm wrapper + next-server), not just the shell job PID.
    kill -TERM -- -"$server_pid" 2>/dev/null || kill -TERM "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  # Belt-and-suspenders if anything is still bound to the port.
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# wait_health <url> <pid>: until /health reports the expected commit.
wait_health() {
  local u="$1" pid="$2" body got
  for _ in $(seq 1 60); do
    body="$(curl -sf "$u/health" || true)"
    if [[ -n "$body" ]]; then
      got="$(printf '%s' "$body" | node -e '
        let d = "";
        process.stdin.on("data", (c) => { d += c; });
        process.stdin.on("end", () => {
          try {
            process.stdout.write(String(JSON.parse(d).commit || "").slice(0, 12));
          } catch {
            /* ignore */
          }
        });
      ')"
      if [[ "$got" == "$expected12" ]]; then
        return 0
      fi
      echo "waiting for $u/health commit=${got:-?} (want ${expected12})" >&2
    fi
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "v5 server for $u exited before /health matched commit ${expected12}" >&2
      exit 1
    fi
    sleep 2
  done
  echo "timed out waiting for $u/health commit=${expected12}" >&2
  exit 1
}
wait_health "$url" "$server_pid"

# Stress-seed check: a second server on the same build with V5_SEED_STRESS=1 (never set on the main
# server — it makes every sandbox 10k codes). Sign-in must seed without the crews FK error.
stress_url="http://localhost:${stress_port}"
V5_SEED_STRESS=1 npm run start -- -p "$stress_port" &
stress_pid=$!
wait_health "$stress_url" "$stress_pid"
cd "$root"
node .cursor/skills/verify-v5/stress-seed.mjs --url "$stress_url"
stop_stress

cd "$root"
node .cursor/skills/verify-v5/verify.mjs --url "$url" --commit "$commit"
