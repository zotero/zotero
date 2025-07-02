#!/bin/bash -e

set -e pipefail

RELEASE=esr140 # Keep in sync with platform version
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$ROOT_DIR/types/gecko"

echo Downloading types from release "$RELEASE"

temp_dir="$(mktemp -d)"
pushd "$temp_dir"

curl -L "https://hg.mozilla.org/releases/mozilla-$RELEASE/archive/tip.zip/tools/%40types/" -o types.zip
unzip types.zip
mv ./*/tools/@types/* "$OUTPUT_DIR"

popd
rm -r "$temp_dir"

sed -i '' '/^\/\/\/ <reference no-default-lib="true" \/>/d' "$OUTPUT_DIR/generated/lib.gecko.dom.d.ts"
