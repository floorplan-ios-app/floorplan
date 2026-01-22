#!/usr/bin/env bash
set -euo pipefail

# macOS-focused bootstrap.
# This script is safe to run multiple times.

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install it first: https://brew.sh"
  exit 1
fi

brew update

# Bun
if ! command -v bun >/dev/null 2>&1; then
  brew install bun
fi

# Tooling
brew install git jq docker docker-compose
brew install xcodegen swiftformat || true

echo "Bootstrap complete."
echo "Next:"
echo "  bun install"
echo "  docker compose up -d"
echo "  bun run dev"
