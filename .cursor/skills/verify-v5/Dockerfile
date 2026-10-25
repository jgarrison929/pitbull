# verify-v5 runner for visual and date-sensitive runs. Pinned to the @playwright/test version in
# v5/package-lock.json (1.64.1) by tag and digest, plus:
#   fonts-dejavu-core: the CI ubuntu runner's fallback font (absent from the noble image), so
#                      screenshots and text widths match CI baselines
#   faketime (libfaketime): freeze the clock for date-dependent pages, e.g.
#                      LD_PRELOAD=/usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 FAKETIME="@2026-10-19 12:00:00"
# Build:  docker build -t pitbull-verify-v5 .cursor/skills/verify-v5
# Run:    docker run --rm --ipc=host -v "$PWD":/repo -w /repo -e VERIFY_TOKEN pitbull-verify-v5 \
#           node .cursor/skills/verify-v5/verify.mjs --url https://pitbull-web-staging.up.railway.app
# (npm ci in v5/ first, inside the container or on a same-arch Linux host.)
# Bump the tag and digest together when v5/package-lock.json moves @playwright/test.
FROM mcr.microsoft.com/playwright:v1.64.1-noble@sha256:47b510dd9230bf0b9bfc9b20102241e577ea7a99334ab4c3ca19f19770e9b8ea
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core faketime \
 && rm -rf /var/lib/apt/lists/* \
 && fc-list | grep -q DejaVuSans \
 && test -e /usr/lib/x86_64-linux-gnu/faketime/libfaketime.so.1 -o -e /usr/lib/aarch64-linux-gnu/faketime/libfaketime.so.1
