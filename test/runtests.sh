#!/bin/bash
CWD="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

case "$(uname -s)" in
   CYGWIN*) IS_CYGWIN=1 ;;
esac

function makePath {
	local __assignTo=$1
	local __path=$2
	if [ ! -z $IS_CYGWIN ]; then
		__path="`cygpath -aw \"$__path\"`"
	fi
	eval $__assignTo="'$__path'"
}

DEBUG=false
if [ -z "$FX_EXECUTABLE" ]; then
	if [ "`uname`" == "Darwin" ]; then
		FX_EXECUTABLE="/Applications/Firefox.app/Contents/MacOS/firefox"
	else
		FX_EXECUTABLE="firefox"
	fi
fi

FX_ARGS=""

function usage {
	cat >&2 <<DONE
Usage: $0 [option] [TESTS...]
Options
 -b                  skip bundled translator/style installation
 -c                  open JavaScript console and don't quit on completion
 -d LEVEL            enable debug logging
 -f                  stop after first test failure
 -g                  only run tests matching the given pattern (grep)
 -t                  generate test data and quit
 -x FX_EXECUTABLE    path to Firefox executable (default: $FX_EXECUTABLE)
 -b                  skip bundled translator/style installation
 TESTS               set of tests to run (default: all)
DONE
	exit 1
}

DEBUG_LEVEL=0
while getopts "bcd:fg:tx:" opt; do
	case $opt in
        b)
        	FX_ARGS="$FX_ARGS -ZoteroSkipBundledFiles"
        	;;
		c)
			FX_ARGS="$FX_ARGS -jsconsole -noquit"
			;;
		d)
			DEBUG=true
			DEBUG_LEVEL="$OPTARG"
			;;
		f)
			FX_ARGS="$FX_ARGS -bail"
			;;
		g)
			GREP="$OPTARG"
			;;
		t)
			FX_ARGS="$FX_ARGS -makeTestData"
			;;
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

makePath ZOTERO_UNIT_PATH "$CWD"
echo "$ZOTERO_UNIT_PATH" > "$PROFILE/extensions/zotero-unit@zotero.org"

makePath ZOTERO_PATH "`dirname "$CWD"`"
echo "$ZOTERO_PATH" > "$PROFILE/extensions/zotero@chnm.gmu.edu"

# Create data directory
mkdir "$PROFILE/zotero"

cat <<EOF > "$PROFILE/prefs.js"
user_pref("extensions.autoDisableScopes", 0);
user_pref("browser.uitour.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("extensions.zotero.debug.log", $DEBUG);
user_pref("extensions.zotero.debug.level", $DEBUG_LEVEL);
user_pref("extensions.zotero.debug.time", $DEBUG);
user_pref("extensions.zotero.firstRunGuidance", false);
user_pref("extensions.zotero.firstRun2", false);
user_pref("extensions.zotero.reportTranslationFailure", false);
user_pref("extensions.zotero.httpServer.enabled", true);
user_pref("extensions.zotero.backup.numBackups", 0);
EOF

# -v flag on Windows makes Firefox process hang
if [ -z $IS_CYGWIN ]; then
	echo "`MOZ_NO_REMOTE=1 NO_EM_RESTART=1 \"$FX_EXECUTABLE\" -v`"
fi


if [ "$TRAVIS" = true ]; then
	FX_ARGS="$FX_ARGS -ZoteroNoUserInput"
fi

# Clean up on exit
trap "{ rm -rf \"$PROFILE\"; }" EXIT

makePath FX_PROFILE "$PROFILE"
MOZ_NO_REMOTE=1 NO_EM_RESTART=1 "$FX_EXECUTABLE" -profile "$FX_PROFILE" \
    -chrome chrome://zotero-unit/content/runtests.html -test "$TESTS" -grep "$GREP" $FX_ARGS

# Check for success
test -e "$PROFILE/success"
STATUS=$?

exit $STATUS