#!/bin/bash -e

set -e pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

release=esr128 # TODO: Keep in sync with platform version once platform version >= esr128
if [ -n "$1" ]; then
	tag=$1
fi
echo Downloading types from release $release

DIR_REMOTE="https://hg.mozilla.org/releases/mozilla-$release/raw-file/tip/tools/@types"
DIR_LOCAL="$ROOT_DIR/types/gecko"

dir_listing=$(curl -fs "$DIR_REMOTE")
filenames=$(cut -d ' ' -f 3 <<< "$dir_listing")
for filename in $filenames; do
	curl -f "$DIR_REMOTE/$filename" > "$DIR_LOCAL/$filename"
	sed -i '' '/^\/\/\/ <reference no-default-lib="true" \/>/d' "$DIR_LOCAL/$filename"
done
