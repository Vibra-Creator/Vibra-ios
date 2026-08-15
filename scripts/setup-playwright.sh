#!/usr/bin/env bash
# Bootstrap Playwright's Chromium browser and its required system libraries.
# Run once in any fresh environment (CI or Replit workspace) before `npm run test:e2e`.
#
# Usage:
#   bash scripts/setup-playwright.sh
#   # or via npm:
#   npm run test:e2e:setup

set -euo pipefail

echo "→ Installing Playwright Chromium browser..."
npx playwright install chromium

echo "→ Installing Chromium system dependencies..."
npx playwright install-deps chromium

echo "✓ Playwright setup complete. You can now run: npm run test:e2e"
