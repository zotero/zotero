#!/bin/bash -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

tag=master
if [ -n "$1" ]; then
	tag=$1
fi
echo Downloading tag $tag
sleep 2

outFile="$ROOT_DIR/chrome/content/zotero/xpcom/citeproc.js"

if [ ! -e "$outFile" ]; then
	>&2 echo "$outFile not found"
	exit 78 # EX_CONFIG: configuration error (from sysexits.h)
fi

curl -f https://raw.githubusercontent.com/Juris-M/citeproc-js/$tag/citeproc.js > "$outFile"

echo

if [ `command -v acorn` ]; then
	echo "Verifying file..."
	acorn --silent "$outFile"
	if [ $? = 0 ]; then
		echo "OK"
	fi
else
	echo "Warning: acorn isn't installed -- not verifying file"
fi
