#!/usr/bin/env bash
# Produces dist/zotero-reading-status.xpi from the current source tree.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p dist
OUT="$REPO_ROOT/dist/zotero-reading-status.xpi"
rm -f "$OUT"

# Zip contents from the repo root (NOT a top-level directory inside the zip,
# which Firefox/Zotero doesn't accept for WebExtension bundles).
zip -r -X "$OUT" \
	manifest.json \
	bootstrap.js \
	content \
	locale \
	styles \
	-x "*.DS_Store" "*/__pycache__/*"

echo "Built: $OUT"
