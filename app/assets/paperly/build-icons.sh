#!/bin/bash
# Renders the Paperly app icon from icon.html and installs it for all three
# platforms. Re-run this after touching icon.html or anya.png.
#
#   ./build-icons.sh [look]      look defaults to "plum"
#                                (also: cream, sage, rose)
#
# Needs headless Chrome to rasterise and iconutil (macOS) for the .icns.
set -euo pipefail

LOOK="${1:-plum}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

if [ ! -x "$CHROME" ]; then
	echo "No Chrome at $CHROME -- set CHROME=/path/to/chrome" >&2
	exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --allow-file-access-from-files is what lets the page read the drawing's
# pixels back out of the canvas; without it the flood fill cannot run.
render() { # render <out.png> <size> <mode> [fill]
	"$CHROME" --headless --disable-gpu --hide-scrollbars \
		--allow-file-access-from-files --default-background-color=00000000 \
		--virtual-time-budget=4000 \
		--screenshot="$1" --window-size="$2,$2" \
		"file://$HERE/icon.html?v=$LOOK&size=$2&mode=$3&fill=${4:-0.99}" 2>/dev/null
	[ -s "$1" ] || { echo "render failed: $1" >&2; exit 1; }
}

echo "==> Rendering '$LOOK'"
for s in 16 32 64 128 256 512 1024; do
	render "$TMP/mac-$s.png" "$s" mac
done
for s in 16 24 32 48 64 128 256; do
	render "$TMP/flat-$s.png" "$s" flat
done

echo "==> macOS .icns"
SET="$TMP/paperly.iconset"
mkdir -p "$SET"
cp "$TMP/mac-16.png"   "$SET/icon_16x16.png"
cp "$TMP/mac-32.png"   "$SET/icon_16x16@2x.png"
cp "$TMP/mac-32.png"   "$SET/icon_32x32.png"
cp "$TMP/mac-64.png"   "$SET/icon_32x32@2x.png"
cp "$TMP/mac-128.png"  "$SET/icon_128x128.png"
cp "$TMP/mac-256.png"  "$SET/icon_128x128@2x.png"
cp "$TMP/mac-256.png"  "$SET/icon_256x256.png"
cp "$TMP/mac-512.png"  "$SET/icon_256x256@2x.png"
cp "$TMP/mac-512.png"  "$SET/icon_512x512.png"
cp "$TMP/mac-1024.png" "$SET/icon_512x512@2x.png"
iconutil -c icns "$SET" -o "$APP/mac/Contents/Resources/paperly.icns"

# The bundle used to carry a compiled asset catalogue holding nothing but the
# old AppIcon. Rebuilding one needs full Xcode, which a Command Line Tools
# install does not have, so the bundle names a .icns instead -- see README.md.
rm -f "$APP/mac/Contents/Resources/Assets.car"

echo "==> Windows .ico"
node "$HERE/make-ico.mjs" "$APP/win/zotero.ico" \
	"$TMP/flat-16.png" "$TMP/flat-24.png" "$TMP/flat-32.png" \
	"$TMP/flat-48.png" "$TMP/flat-64.png" "$TMP/flat-128.png" "$TMP/flat-256.png"

echo "==> Linux PNGs"
cp "$TMP/flat-32.png"  "$APP/linux/icons/icon32.png"
cp "$TMP/flat-64.png"  "$APP/linux/icons/icon64.png"
cp "$TMP/flat-128.png" "$APP/linux/icons/icon128.png"

echo "==> Done"
