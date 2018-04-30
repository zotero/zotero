#!/bin/sh
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 cmd source output.txt"
    exit 1
fi
"$1" "$2" > "$3"
