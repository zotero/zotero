#!/bin/bash
CWD="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ "`uname`" == "Darwin" ]; then
	FX_EXECUTABLE="/Applications/Firefox.app/Contents/MacOS/firefox"
else
	FX_EXECUTABLE="firefox"
fi

function usage {
	cat >&2 <<DONE
Usage: $0 [-x FX_EXECUTABLE] [TESTS...]
Options
 -x FX_EXECUTABLE    path to Firefox executable (default: $FX_EXECUTABLE)
 TESTS               set of tests to run (default: all)
DONE
	exit 1
}

while getopts "x:" opt; do
	case $opt in
		x)
			FX_EXECUTABLE="$OPTARG"
			;;
		*)
			usage
			;;
	esac
	shift $((OPTIND-1)); OPTIND=1
done

if [ -z $1 ]; then
	TESTS="all"
else
	ARGS=("${@:1}")
	function join { local IFS="$1"; shift; echo "$*"; }
	TESTS="$(join , "${ARGS[@]}")"
fi

# Set up profile directory
PROFILE="`mktemp -d 2>/dev/null || mktemp -d -t 'zotero-unit'`"
mkdir "$PROFILE/extensions"
echo "$CWD" > "$PROFILE/extensions/zotero-unit@zotero.org"
echo "`dirname "$CWD"`" > "$PROFILE/extensions/zotero@chnm.gmu.edu"
echo 'user_pref("extensions.autoDisableScopes", 0);' > "$PROFILE/prefs.js"

MOZ_NO_REMOTE=1 NO_EM_RESTART=1 "$FX_EXECUTABLE" -profile "$PROFILE" \
    -chrome chrome://zotero-unit/content/runtests.html -test "$TESTS"

# Check for success
test -e "$PROFILE/success"
STATUS=$?

# Clean up
rm -rf "$PROFILE"
exit $STATUS