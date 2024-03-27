#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
. "$ROOT_DIR/config.sh"
UPDATE_STAGE_DIR="$SCRIPT_DIR/staging"

function usage {
	cat >&2 <<DONE
Usage: $0 -c CHANNEL [-f] [-i FROM_VERSION] [-p PLATFORMS] [-l] VERSION
Options
 -c CHANNEL          Release channel ('release', 'beta')
 -f                  Perform full build
 -i FROM_VERSION     Perform incremental build
 -p PLATFORMS        Platforms to build (m=Mac, w=Windows, l=Linux)
 -l                  Use local TO directory instead of downloading TO files from S3
DONE
	exit 1
}

# From https://gist.github.com/cdown/1163649#gistcomment-1639097
urlencode() {
    local LANG=C
    local length="${#1}"
    for (( i = 0; i < length; i++ )); do
        local c="${1:i:1}"
        case $c in
            [a-zA-Z0-9.~_-]) printf "$c" ;;
            *) printf '%%%02X' "'$c" ;;
        esac
    done
}

BUILD_FULL=0
BUILD_INCREMENTAL=0
FROM=""
CHANNEL=""
BUILD_MAC=0
BUILD_WIN=0
BUILD_LINUX=0
USE_LOCAL_TO=0
while getopts "i:c:p:fl" opt; do
	case $opt in
		i)
			FROM="$OPTARG"
			BUILD_INCREMENTAL=1
			;;
		c)
			CHANNEL="$OPTARG"
			;;
		p)
			for i in `seq 0 1 $((${#OPTARG}-1))`
			do
				case ${OPTARG:i:1} in
					m) BUILD_MAC=1;;
					w) BUILD_WIN=1;;
					l) BUILD_LINUX=1;;
					*)
						echo "$0: Invalid platform option ${OPTARG:i:1}"
						usage
						;;
				esac
			done
			;;
		f)
			BUILD_FULL=1
			;;
		l)
			USE_LOCAL_TO=1
			;;
		*)
			usage
			;;
	esac
	shift $((OPTIND-1)); OPTIND=1
done

shift $(($OPTIND - 1))
TO=${1:-}

if [ -z "$TO" ]; then
	usage
fi

if [ -z "$FROM" ] && [ $BUILD_FULL -eq 0 ]; then
	usage
fi

if [[ -z "$CHANNEL" ]]; then
	echo "Channel not provided" >&2
	exit 1
fi

# Require at least one platform
if [[ $BUILD_MAC == 0 ]] && [[ $BUILD_WIN == 0 ]] && [[ $BUILD_LINUX == 0 ]]; then
	usage
fi

rm -rf "$UPDATE_STAGE_DIR"
mkdir "$UPDATE_STAGE_DIR"

INCREMENTALS_FOUND=0
for version in "$FROM" "$TO"; do
	if [[ $version == "$TO" ]] && [[ $INCREMENTALS_FOUND == 0 ]] && [[ $BUILD_FULL == 0 ]]; then
		exit
	fi
	
	if [ -z "$version" ]; then
		continue
	fi
	
	echo "Getting Zotero version $version"
	
	versiondir="$UPDATE_STAGE_DIR/$version"
	
	#
	# If -l passed, use main build script's staging directory for TO files rather than downloading
	# the given version.
	#
	# The caller must ensure that the files in ../staging match the platforms and version given.
	if [[ $version == $TO && $USE_LOCAL_TO == "1" ]]; then
		if [ ! -d "$STAGE_DIR" ]; then
			echo "Can't find local TO dir $STAGE_DIR"
			exit 1
		fi
		
		echo "Using files from $STAGE_DIR"
		ln -s "$STAGE_DIR" "$versiondir"
		continue
	fi
	
	#
	# Otherwise, download version from S3
	#
	mkdir -p "$versiondir"
	cd "$versiondir"
	
	MAC_ARCHIVE="Zotero-${version}.dmg"
	WIN32_ARCHIVE="Zotero-${version}_win32.zip"
	WIN64_ARCHIVE="Zotero-${version}_win-x64.zip"
	LINUX_X86_ARCHIVE="Zotero-${version}_linux-i686.tar.bz2"
	LINUX_X86_64_ARCHIVE="Zotero-${version}_linux-x86_64.tar.bz2"
	LINUX_AARCH64_ARCHIVE="Zotero-${version}_linux-aarch64.tar.bz2"
	
	CACHE_DIR="$ROOT_DIR/cache"
	if [ ! -e "$CACHE_DIR" ]; then
		mkdir "$CACHE_DIR"
	fi
	
	for archive in "$MAC_ARCHIVE" "$WIN32_ARCHIVE" "$WIN64_ARCHIVE" "$LINUX_X86_ARCHIVE" "$LINUX_X86_64_ARCHIVE" "$LINUX_AARCH64_ARCHIVE"; do
		if [[ $archive = "$MAC_ARCHIVE" ]] && [[ $BUILD_MAC != 1 ]]; then
			continue
		fi
		if [[ $archive = "$WIN32_ARCHIVE" ]] && [[ $BUILD_WIN != 1 ]]; then
			continue
		fi
		if [[ $archive = "$WIN64_ARCHIVE" ]] && [[ $BUILD_WIN != 1 ]]; then
			continue
		fi
		if [[ $archive = "$LINUX_X86_ARCHIVE" ]] && [[ $BUILD_LINUX != 1 ]]; then
			continue
		fi
		if [[ $archive = "$LINUX_X86_64_ARCHIVE" ]] && [[ $BUILD_LINUX != 1 ]]; then
			continue
		fi
		if [[ $archive = "$LINUX_AARCH64_ARCHIVE" ]] && [[ $BUILD_LINUX != 1 ]]; then
			continue
		fi
		
		ETAG_FILE="$CACHE_DIR/$archive.etag"
		
		# Check cache for archive
		if [[ -f "$CACHE_DIR/$archive" ]] && [[ -f "$CACHE_DIR/$archive.etag" ]]; then
			ETAG="`cat $ETAG_FILE | tr '\n' ' '`"
		else
			ETAG=""
		fi
		
		rm -f $archive
		# URL-encode '+' in beta version numbers
		ENCODED_VERSION=`urlencode $version`
		ENCODED_ARCHIVE=`urlencode $archive`
		URL="https://$S3_BUCKET.s3.amazonaws.com/$S3_DIST_PATH/$CHANNEL/$ENCODED_VERSION/$ENCODED_ARCHIVE"
		echo "Fetching $URL"
		set +e
		# Cached version is available
		if [ -n "$ETAG" ]; then
			NEW_ETAG=$(wget -nv -S --header "If-None-Match: $ETAG" $URL 2>&1 | awk '/ *ETag: */ {print $2}')
			
			# If ETag didn't match, cache newly downloaded version
			if [ -f $archive ]; then
				echo "ETag for $archive didn't match! -- using new version"
				rm -f "$CACHE_DIR/$archive.etag"
				cp $archive "$CACHE_DIR/"
				echo "$NEW_ETAG" > "$CACHE_DIR/$archive.etag"
			# If ETag matched (or there was another error), use cached version
			else
				echo "Using cached $archive"
				cp "$CACHE_DIR/$archive" .
			fi
		else
			NEW_ETAG=$(wget -nv -S $URL 2>&1 | awk '/ *ETag: */ {print $2}')
			
			# Save archive to cache
			rm -f "$CACHE_DIR/$archive.etag"
			cp $archive "$CACHE_DIR/"
			echo "$NEW_ETAG" > "$CACHE_DIR/$archive.etag"
		fi
		set -e
	done
	
	# Delete cached files older than 14 days
	find "$CACHE_DIR" -ctime +14 -delete
	
	# Unpack Zotero.app
	if [ $BUILD_MAC == 1 ]; then
		if [ -f "$MAC_ARCHIVE" ]; then
			set +e
			hdiutil detach -quiet /Volumes/Zotero 2>/dev/null
			set -e
			hdiutil attach -quiet "$MAC_ARCHIVE"
			cp -R /Volumes/Zotero/Zotero.app "$versiondir"
			rm "$MAC_ARCHIVE"
			hdiutil detach -quiet /Volumes/Zotero
			INCREMENTALS_FOUND=1
		else
			echo "$MAC_ARCHIVE not found"
		fi
	fi
	
	# Unpack Windows zips
	if [ $BUILD_WIN == 1 ]; then
		if [[ -f "$WIN32_ARCHIVE" ]] && [[ -f "$WIN64_ARCHIVE" ]]; then
			for build in "$WIN32_ARCHIVE" "$WIN64_ARCHIVE"; do
				unzip -q "$build"
				rm "$build"
			done
			INCREMENTALS_FOUND=1
		else
			echo "$WIN32_ARCHIVE and/or $WIN64_ARCHIVE not found"
		fi
	fi
	
	# Unpack Linux tarballs
	if [ $BUILD_LINUX == 1 ]; then
		if [[ -f "$LINUX_X86_ARCHIVE" ]] && [[ -f "$LINUX_X86_64_ARCHIVE" ]] && [[ -f "$LINUX_AARCH64_ARCHIVE" ]]; then
			for build in "$LINUX_X86_ARCHIVE" "$LINUX_X86_64_ARCHIVE" "$LINUX_AARCH64_ARCHIVE"; do
				tar -xjf "$build"
				rm "$build"
			done
			INCREMENTALS_FOUND=1
		else
			echo "$LINUX_X86_ARCHIVE/$LINUX_X86_64_ARCHIVE/$LINUX_AARCH64_ARCHIVE not found"
		fi
	fi
	
	echo
done

# Set variables for mar command in make_(incremental|full)_update.sh
export MOZ_PRODUCT_VERSION="$TO"
export MAR_CHANNEL_ID="$CHANNEL"

CHANGES_MADE=0
for build in "mac" "win32" "win-x64" "linux-i686" "linux-x86_64" "linux-aarch64"; do
	if [[ $build == "mac" ]]; then
		if [[ $BUILD_MAC == 0 ]]; then
			continue
		fi
		dir="Zotero.app"
	else
		if [[ $build == "win32" ]] || [[ $build == "win-x64" ]] && [[ $BUILD_WIN == 0 ]]; then
			continue
		fi
		if [[ $build == "linux-i686" ]] || [[ $build == "linux-x86_64" ]] || [[ $build == "linux-aarch64" ]] && [[ $BUILD_LINUX == 0 ]]; then
			continue
		fi
		dir="Zotero_$build"
		touch "$UPDATE_STAGE_DIR/$TO/$dir/precomplete"
		cp "$SCRIPT_DIR/removed-files_$build" "$UPDATE_STAGE_DIR/$TO/$dir/removed-files"
	fi
	if [[ $BUILD_INCREMENTAL == 1 ]] && [[ -d "$UPDATE_STAGE_DIR/$FROM/$dir" ]]; then
		echo
		echo "Building incremental $build update from $FROM to $TO"
		"$SCRIPT_DIR/make_incremental_update.sh" "$DIST_DIR/Zotero-${TO}-${FROM}_$build.mar" "$UPDATE_STAGE_DIR/$FROM/$dir" "$UPDATE_STAGE_DIR/$TO/$dir"
		CHANGES_MADE=1
		
		# If it's an incremental patch from a 6.0 build, use bzip instead of xz
		if [[ $FROM = 6.0* ]]; then
			echo "Building bzip2 version of incremental $build update from $FROM to $TO"
			"$SCRIPT_DIR/xz_to_bzip" "$DIST_DIR/Zotero-${TO}-${FROM}_$build.mar" "$DIST_DIR/Zotero-${TO}-${FROM}_${build}_bz.mar"
			rm "$DIST_DIR/Zotero-${TO}-${FROM}_$build.mar"
			mv "$DIST_DIR/Zotero-${TO}-${FROM}_${build}_bz.mar" "$DIST_DIR/Zotero-${TO}-${FROM}_$build.mar"
		fi
	fi
	if [[ $BUILD_FULL == 1 ]]; then
		echo
		echo "Building full $build update for $TO"
		"$SCRIPT_DIR/make_full_update.sh" "$DIST_DIR/Zotero-${TO}-full_$build.mar" "$UPDATE_STAGE_DIR/$TO/$dir"
		CHANGES_MADE=1
		
		# Make a bzip version of all complete patches for serving to <7.0 builds. We can stop this
		# once we do a waterfall build that all older versions get updated to.
		echo "Building bzip2 version of full $build update for $TO"
		"$SCRIPT_DIR/xz_to_bzip" "$DIST_DIR/Zotero-${TO}-full_$build.mar" "$DIST_DIR/Zotero-${TO}-full_bz_${build}.mar"
	fi
done

rm -rf "$UPDATE_STAGE_DIR"

# Update file manifests
if [ $CHANGES_MADE -eq 1 ]; then
	# Cygwin has sha512sum, macOS has shasum, Linux has both
	if [[ -n "`which sha512sum 2> /dev/null`" ]]; then
		SHACMD="sha512sum"
	else
		SHACMD="shasum -a 512"
	fi
	
	cd "$DIST_DIR"
	for platform in "mac" "win" "linux"; do
		file=files-$platform
		rm -f $file
		for fn in `find . -name "*$platform*.mar" -exec basename {} \;`; do
			size=`wc -c "$fn" | awk '{print $1}'`
			hash=`$SHACMD "$fn" | awk '{print $1}'`
			echo $fn $hash $size >> $file
		done
	done
fi
