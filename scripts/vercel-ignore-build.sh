#!/usr/bin/env bash
# Guard against Vercel deploying production.
# Cloudflare Workers is the sole production runtime for truth-weaver.
# Exiting 0 tells Vercel to skip the build. Exiting 1 tells Vercel to proceed with build (preview only).
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ] || [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  echo "::notice::Vercel production build skipped. Cloudflare Workers is the sole production runtime."
  exit 0
fi

# Allow preview builds on pull requests and non-main branches
exit 1
