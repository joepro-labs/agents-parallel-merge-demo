#!/usr/bin/env bash
# Idempotent "deploy the tip of main". Re-running with a newer SHA simply ships
# the newer code — no per-PR release ceremony. The deploy workflow's concurrency
# group makes quick-succession merges coalesce into the latest tip.
set -euo pipefail

SHA="${GITHUB_SHA:-local}"
echo "→ Deploying tip of main @ ${SHA}"
# Simulate the irreversible ship step taking a little time.
sleep 8
echo "✓ Deployed ${SHA}"
