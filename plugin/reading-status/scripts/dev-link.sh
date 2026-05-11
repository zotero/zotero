#!/usr/bin/env bash
# Writes a proxy file pointing this plugin source tree into a Zotero profile's
# extensions/ directory. Edits to source then take effect after a Zotero restart
# (Cmd+Q, then relaunch with -purgecaches) -- no XPI rebuild required.
#
# Usage:
#   scripts/dev-link.sh /path/to/zotero/profile
set -euo pipefail

PROFILE_DIR="${1:-}"
if [[ -z "$PROFILE_DIR" ]]; then
	echo "Usage: $0 <path-to-zotero-profile>" >&2
	exit 1
fi
if [[ ! -d "$PROFILE_DIR" ]]; then
	echo "Profile dir not found: $PROFILE_DIR" >&2
	exit 1
fi

PLUGIN_ID="reading-status@placeholder"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$PROFILE_DIR/extensions"
PROXY_FILE="$PROFILE_DIR/extensions/$PLUGIN_ID"

printf "%s" "$REPO_ROOT" > "$PROXY_FILE"
echo "Wrote proxy: $PROXY_FILE -> $REPO_ROOT"

cat <<'EOF'

Next steps:
  1. In the profile's prefs.js (with Zotero closed), set:
       user_pref("xpinstall.signatures.required", false);
       user_pref("extensions.autoDisableScopes", 0);
       user_pref("extensions.experiments.enabled", true);
  2. Launch Zotero with: zotero -purgecaches
  3. Verify in Tools -> Add-ons that the plugin is listed.
EOF
