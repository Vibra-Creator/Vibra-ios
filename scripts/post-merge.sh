#!/bin/bash
set -e

# Install dependencies
npm install --no-audit --no-fund

echo "[post-merge] Setup complete"
