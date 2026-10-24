#!/usr/bin/env sh
# Run Playwright inside the official Playwright image — the same environment as
# the CI "E2E Tests" job, so visual baselines match pixel for pixel.
# Usage (from e2e/): scripts/in-playwright-container.sh [playwright test args...]
# e.g.  scripts/in-playwright-container.sh --project=chromium visual.spec.ts
# Requires podman or docker and a prior `pnpm build:browser` (serves the dist).
set -eu

IMAGE="mcr.microsoft.com/playwright:v$(node -p "require('@playwright/test/package.json').version")-noble"
ENGINE="${CONTAINER_ENGINE:-$(command -v podman >/dev/null 2>&1 && echo podman || echo docker)}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

exec "$ENGINE" run --rm --ipc=host --network=host \
  -v "$REPO_ROOT":/work -w /work/e2e \
  -e CI=1 -e PW_CONTAINER=1 -e E2E_PORT="${E2E_PORT:-5173}" -e COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  "$IMAGE" sh -c 'corepack enable && pnpm exec playwright test "$@"' sh "$@"
