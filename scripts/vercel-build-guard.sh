#!/usr/bin/env bash
# Build guard ensuring Vercel never executes a production deployment.
# Cloudflare Workers is the sole production deployment target.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ] || [ "${VERCEL_GIT_COMMIT_REF:-}" = "main" ]; then
  echo "ERROR: Production deployments on Vercel are forbidden. Cloudflare Workers is the sole production runtime." >&2
  exit 1
fi

vite build
