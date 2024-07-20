#!/bin/bash -e

# Copyright (c) 2011  Zotero
#                     Center for History and New Media
#                     George Mason University, Fairfax, Virginia, USA
#                     http://zotero.org
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

CALLDIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$CALLDIR/config.sh"

if [ "`uname`" = "Darwin" ]; then
	MAC_NATIVE=1
else
	MAC_NATIVE=0
fi
if [ "`uname -o 2> /dev/null`" = "Cygwin" ]; then
	WIN_NATIVE=1
else
	WIN_NATIVE=0
fi

function usage {
	cat >&2 <<DONE
Usage: $0 [-d DIR] [-f FILE] -p PLATFORMS [-c CHANNEL] [-d]
Options
 -d DIR              build directory to build from (from build_xpi; cannot be used with -f)
 -f FILE             ZIP file to build from (cannot be used with -d)
 -t                  add devtools
 -p PLATFORMS        build for platforms PLATFORMS (m=Mac, w=Windows, l=Linux)
 -c CHANNEL          use update channel CHANNEL
 -e                  enforce signing
 -s                  don't package; only build binaries in staging/ directory
 -q                  quick build (skip compression and other optional steps for faster restarts during development)
DONE
	exit 1
}

BUILD_DIR=`mktemp -d`
function cleanup {
	rm -rf $BUILD_DIR
}
trap cleanup EXIT

function replace_line {
	pattern=$1
	replacement=$2
	file=$3
	
	if egrep -q "$pattern" "$file"; then
		perl -pi -e "s/$pattern/$replacement/" "$file"
	else
		echo "$pattern" not found in "$file" -- aborting 2>&1
		exit 1
	fi
}

function abspath {
	echo $(cd $(dirname $1); pwd)/$(basename $1);
}

function check_lfs_file {
	if [ "$(head --bytes 5 "$1")" = "versi" ]; then
		echo "$1 not checked out -- install Git LFS and run 'git lfs pull'" >&2
		exit 1
	fi
}

SOURCE_DIR=""
ZIP_FILE=""
BUILD_MAC=0
BUILD_WIN=0
BUILD_LINUX=0
PACKAGE=1
DEVTOOLS=0
quick_build=0
while getopts "d:f:p:c:tseq" opt; do
	case $opt in
		d)
			SOURCE_DIR="$OPTARG"
			;;
		f)
			ZIP_FILE="$OPTARG"
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
		c)
			UPDATE_CHANNEL="$OPTARG"
			;;
		t)
			DEVTOOLS=1
			;;
		e)
			SIGN=1
			;;
		s)
			PACKAGE=0
			;;
		q)
			quick_build=1
			;;
		*)
			usage
			;;
	esac
	shift $((OPTIND-1)); OPTIND=1
done

function check_xulrunner_hash {
	platform=$1

	if [ $platform == "m" ]; then
		platform_hash_file="hash-mac"
	elif [ $platform == "w" ]; then
		platform_hash_file="hash-win"
	elif [ $platform == "l" ]; then
		platform_hash_file="hash-linux"
	else
		echo "Platform parameter incorrect. Acceptable values: m/w/l"
		exit 1
	fi

	if [ ! -e "$CALLDIR/xulrunner/$platform_hash_file" ]; then
		echo "xulrunner not found -- downloading"
		echo
		$CALLDIR/scripts/fetch_xulrunner -p $platform
	else
		recalculated_xulrunner_hash=$("$CALLDIR/scripts/xulrunner_hash" -p $platform)
		current_xulrunner_hash=$(< "$CALLDIR/xulrunner/$platform_hash_file")
		if [ "$current_xulrunner_hash" != "$recalculated_xulrunner_hash" ]; then 
			echo "xulrunner hashes don't match -- redownloading"
			echo
			"$CALLDIR/scripts/fetch_xulrunner" -p $platform
			current_xulrunner_hash=$(< "$CALLDIR/xulrunner/$platform_hash_file")
			if [ "$current_xulrunner_hash" != "$recalculated_xulrunner_hash" ]; then
				echo "xulrunner hashes don't match after running fetch_xulrunner!"
				exit 1
			fi
		fi
	fi
}

#Check if xulrunner and GECKO_VERSION for each platform match
if [ $BUILD_MAC == 1 ]; then
	check_xulrunner_hash m
fi
if [ $BUILD_WIN == 1 ]; then
	check_xulrunner_hash w
fi
if [ $BUILD_LINUX == 1 ]; then
	check_xulrunner_hash l
fi



# Require source dir or ZIP file
if [[ -z "$SOURCE_DIR" ]] && [[ -z "$ZIP_FILE" ]]; then
	usage
elif [[ -n "$SOURCE_DIR" ]] && [[ -n "$ZIP_FILE" ]]; then
	usage
fi

# Require at least one platform
if [[ $BUILD_MAC == 0 ]] && [[ $BUILD_WIN == 0 ]] && [[ $BUILD_LINUX == 0 ]]; then
	usage
fi

if [[ -z "${ZOTERO_TEST:-}" ]] || [[ $ZOTERO_TEST == "0" ]]; then
	include_tests=0
else
	include_tests=1
fi

# Bundle devtools with dev builds
if [ "$UPDATE_CHANNEL" == "beta" ] || [ "$UPDATE_CHANNEL" == "dev" ] || [ "$UPDATE_CHANNEL" == "test" ]; then
	DEVTOOLS=1
fi
if [ -z "$UPDATE_CHANNEL" ]; then UPDATE_CHANNEL="default"; fi
BUILD_ID=`date +%Y%m%d%H%M%S`

# Paths to Gecko runtimes
MAC_RUNTIME_PATH="$CALLDIR/xulrunner/Firefox.app"
WIN_RUNTIME_PATH_PREFIX="$CALLDIR/xulrunner/firefox-"
LINUX_RUNTIME_PATH_PREFIX="$CALLDIR/xulrunner/firefox-"

base_dir="$BUILD_DIR/base"
app_dir="$BUILD_DIR/base/app"
omni_dir="$BUILD_DIR/base/app/omni"

shopt -s extglob
mkdir -p "$app_dir"
rm -rf "$STAGE_DIR"
mkdir "$STAGE_DIR"
rm -rf "$DIST_DIR"
mkdir "$DIST_DIR"

# Save build id, which is needed for updates manifest
echo $BUILD_ID > "$DIST_DIR/build_id"

cd "$app_dir"

# Copy 'browser' files from Firefox
#
# omni.ja is left uncompressed within the Firefox application files by fetch_xulrunner
#
# TEMP: Also extract .hyf hyphenation files from the outer (still compressed) omni.ja
# This works around https://bugzilla.mozilla.org/show_bug.cgi?id=1772900
set +e
if [ $BUILD_MAC == 1 ]; then
	cp -Rp "$MAC_RUNTIME_PATH"/Contents/Resources/browser/omni "$app_dir"
	unzip -qj "$MAC_RUNTIME_PATH"/Contents/Resources/omni.ja "hyphenation/*" -d "$app_dir"/hyphenation/
elif [ $BUILD_WIN == 1 ]; then
	# Non-arch-specific files, so just use 64-bit version
	cp -Rp "${WIN_RUNTIME_PATH_PREFIX}win-x64"/browser/omni "$app_dir"
	unzip -qj "${WIN_RUNTIME_PATH_PREFIX}win-x64"/omni.ja "hyphenation/*" -d "$app_dir"/hyphenation/
elif [ $BUILD_LINUX == 1 ]; then
	# Non-arch-specific files, so just use 64-bit version
	cp -Rp "${LINUX_RUNTIME_PATH_PREFIX}x86_64"/browser/omni "$app_dir"
	unzip -qj "${LINUX_RUNTIME_PATH_PREFIX}x86_64"/omni.ja "hyphenation/*" -d "$app_dir"/hyphenation/
fi
set -e
cd $omni_dir
# Move some Firefox files that would be overwritten out of the way
mv chrome.manifest chrome.manifest-fx
mv defaults defaults-fx

# Extract Zotero files
if [ -n "$ZIP_FILE" ]; then
	ZIP_FILE="`abspath $ZIP_FILE`"
	echo "Building from $ZIP_FILE"
	unzip -q $ZIP_FILE -d "$omni_dir"
else
	rsync_params=""
	if [ $include_tests -eq 0 ]; then
		rsync_params="--exclude /test"
	fi
	rsync -a $rsync_params "$SOURCE_DIR/" ./
fi

mv defaults defaults-z
mv defaults-fx defaults
prefs_file=defaults/preferences/zotero.js

# Transfer Firefox prefs, omitting some with undesirable overrides from the base prefs
#
# - network.captive-portal-service.enabled
#       Disable the captive portal check against Mozilla servers
# - extensions.systemAddon.update.url
egrep -v '(network.captive-portal-service.enabled|extensions.systemAddon.update.url)' defaults/preferences/firefox.js > $prefs_file
rm defaults/preferences/firefox.js

# Combine app and "extension" Zotero prefs
echo "" >> $prefs_file
echo "#" >> $prefs_file
echo "# Zotero app prefs" >> $prefs_file
echo "#" >> $prefs_file
echo "" >> $prefs_file
cat "$CALLDIR/assets/prefs.js" >> $prefs_file
echo "" >> $prefs_file
echo "# Zotero extension prefs" >> $prefs_file
echo "" >> $prefs_file
cat defaults-z/preferences/zotero.js >> $prefs_file

rm -rf defaults-z

# Platform-specific prefs
if [ $BUILD_MAC == 1 ]; then
	perl -pi -e 's/pref\("browser\.preferences\.instantApply", false\);/pref\("browser\.preferences\.instantApply", true);/' $prefs_file
	perl -pi -e 's/%GECKO_VERSION%/'"$GECKO_VERSION_MAC"'/g' $prefs_file
	# Fix horizontal mousewheel scrolling (this is set to 4 in the Fx60 .app greprefs.js, but
	# defaults to 1 in later versions of Firefox, and needs to be 1 to work on macOS)
	echo 'pref("mousewheel.with_shift.action", 1);' >> $prefs_file
elif [ $BUILD_WIN == 1 ]; then
	perl -pi -e 's/%GECKO_VERSION%/'"$GECKO_VERSION_WIN"'/g' $prefs_file
elif [ $BUILD_LINUX == 1 ]; then
	# Modify platform-specific prefs
	perl -pi -e 's/pref\("browser\.preferences\.instantApply", false\);/pref\("browser\.preferences\.instantApply", true);/' $prefs_file
	perl -pi -e 's/%GECKO_VERSION%/'"$GECKO_VERSION_LINUX"'/g' $prefs_file
fi

# Clear list of built-in add-ons
echo '{"dictionaries": {"en-US": "dictionaries/en-US.dic"}, "system": []}' > chrome/browser/content/browser/built_in_addons.json

# chrome.manifest
mv chrome.manifest zotero.manifest
mv chrome.manifest-fx chrome.manifest
# TEMP
#echo "manifest zotero.manifest" >> "$base_dir/chrome.manifest"
cat zotero.manifest >> chrome.manifest
rm zotero.manifest

# Update channel
perl -pi -e 's/pref\("app\.update\.channel", "[^"]*"\);/pref\("app\.update\.channel", "'"$UPDATE_CHANNEL"'");/' $prefs_file
echo -n "Channel: "
grep app.update.channel $prefs_file
echo

# Add devtools prefs
if [ $DEVTOOLS -eq 1 ]; then
	echo >> $prefs_file
	echo "// Dev Tools" >> $prefs_file
	echo 'pref("devtools.debugger.remote-enabled", true);' >> $prefs_file
	if [ $UPDATE_CHANNEL != "beta" ]; then
		echo 'pref("devtools.debugger.prompt-connection", false);' >> $prefs_file
	fi
	
	# Use 'zotero' instead of 'zotero-bin' when passing -jsdebugger flag on Linux, since we need
	# that to pass application.ini
	replace_line 'let command = Services.dirsvc.get\("XREExeF", Ci.nsIFile\).path;' \
		'let command = Services.dirsvc.get("XREExeF", Ci.nsIFile).path; command = command.replace("zotero-bin", "zotero");' \
		chrome/devtools/modules/devtools/client/framework/browser-toolbox/Launcher.sys.mjs
fi

# 5.0.96.3 / 5.0.97-beta.37+ddc7be75c
VERSION=`cat version`
# 5.0.96 / 5.0.97
VERSION_NUMERIC=`perl -ne 'print and last if s/^(\d+\.\d+(\.\d+)?).*/\1/;' version`
if [ -z "$VERSION" ]; then
	echo "Version number not found in version file"
	exit 1
fi
rm version

echo
echo "Version: $VERSION"

# Delete Mozilla signing info if present
rm -rf META-INF

# Copy branding
cp -R "$CALLDIR"/assets/branding/locale/brand.{dtd,properties} chrome/en-US/locale/branding/

# Copy browser localization .ftl files
for locale in `ls chrome/locale/`; do
	mkdir -p localization/$locale/branding
	cp "$CALLDIR/assets/branding/locale/brand.ftl" localization/$locale/branding/brand.ftl
	
	mkdir -p localization/$locale/toolkit/global
	cp chrome/locale/$locale/zotero/mozilla/textActions.ftl localization/$locale/toolkit/global
	cp chrome/locale/$locale/zotero/mozilla/wizard.ftl localization/$locale/toolkit/global
	
	mkdir -p localization/$locale/browser
	cp chrome/locale/$locale/zotero/mozilla/browserSets.ftl localization/$locale/browser
	cp chrome/locale/$locale/zotero/mozilla/menubar.ftl localization/$locale/browser
	
	mkdir -p localization/$locale/devtools/client
	cp chrome/locale/$locale/zotero/mozilla/toolbox.ftl localization/$locale/devtools/client
	
	# TEMP: Until we've created zotero.ftl in all locales
	touch chrome/locale/$locale/zotero/zotero.ftl
	cp chrome/locale/$locale/zotero/*.ftl localization/$locale/
done

# Add to chrome manifest
echo "" >> chrome.manifest
cat "$CALLDIR/assets/chrome.manifest" >> chrome.manifest

replace_line 'handle: function bch_handle\(cmdLine\) {' 'handle: function bch_handle(cmdLine) {
  \/\/ TEST_OPTIONS_PLACEHOLDER
  ' modules/BrowserContentHandler.sys.mjs
export CALLDIR && perl -pi -e 'BEGIN { local $/; open $fh, "$ENV{CALLDIR}/assets/commandLineHandler.js"; $replacement = <$fh>; close $fh; } s/\/\/ TEST_OPTIONS_PLACEHOLDER/$replacement/' modules/BrowserContentHandler.sys.mjs

# Move test files to root directory
if [ $include_tests -eq 1 ]; then
	cat test/chrome.manifest >> chrome.manifest
	rm test/chrome.manifest
	cp -R test/tests "$base_dir/tests"
fi

# Copy platform-specific assets
if [ $BUILD_MAC == 1 ]; then
	rsync -a "$CALLDIR/assets/mac/" ./
elif [ $BUILD_WIN == 1 ]; then
	rsync -a "$CALLDIR/assets/win/" ./
elif [ $BUILD_LINUX == 1 ]; then
	rsync -a "$CALLDIR/assets/unix/" ./
fi

# Add word processor plug-ins
echo >> chrome.manifest
if [ $BUILD_MAC == 1 ]; then
	pluginDir="$CALLDIR/modules/zotero-word-for-mac-integration"
	mkdir -p "integration/word-for-mac"
	cp -RH "$pluginDir/components" \
		"$pluginDir/resource" \
		"$pluginDir/chrome.manifest" \
		"integration/word-for-mac"
	echo -n "Word for Mac plugin version: "
	cat "integration/word-for-mac/resource/version.txt"
	echo
	echo >> $prefs_file
	cat "$CALLDIR/modules/zotero-word-for-mac-integration/defaults/preferences/zoteroMacWordIntegration.js" >> $prefs_file
	echo >> $prefs_file
	
	echo "manifest	integration/word-for-mac/chrome.manifest" >> chrome.manifest
	
elif [ $BUILD_WIN == 1 ]; then
	pluginDir="$CALLDIR/modules/zotero-word-for-windows-integration"
	mkdir -p "integration/word-for-windows"
	cp -RH "$pluginDir/components" \
		"$pluginDir/resource" \
		"$pluginDir/chrome.manifest" \
		"integration/word-for-windows"
	echo -n "Word for Windows plugin version: "
	cat "integration/word-for-windows/resource/version.txt"
	echo
	echo >> $prefs_file
	cat "$CALLDIR/modules/zotero-word-for-windows-integration/defaults/preferences/zoteroWinWordIntegration.js" >> $prefs_file
	echo >> $prefs_file
	
	echo "manifest	integration/word-for-windows/chrome.manifest" >> chrome.manifest
fi
# Libreoffice plugin for all platforms
pluginDir="$CALLDIR/modules/zotero-libreoffice-integration"
mkdir -p "integration/libreoffice"
cp -RH "$pluginDir/chrome" \
	"$pluginDir/components" \
	"$pluginDir/resource" \
	"$pluginDir/chrome.manifest" \
	"integration/libreoffice"
echo -n "LibreOffice plugin version: "
cat "integration/libreoffice/resource/version.txt"
echo
echo >> $prefs_file
cat "$CALLDIR/modules/zotero-libreoffice-integration/defaults/preferences/zoteroLibreOfficeIntegration.js" >> $prefs_file
echo >> $prefs_file

echo "manifest	integration/libreoffice/chrome.manifest" >> chrome.manifest

# Delete files that shouldn't be distributed
find chrome -name .DS_Store -exec rm -f {} \;

# Zip browser and Zotero files into omni.ja
if [ $quick_build -eq 1 ]; then
	# If quick build, don't compress or optimize
	zip -qrXD omni.ja *
else
	zip -qr9XD omni.ja *
	python3 "$CALLDIR/scripts/optimizejars.py" --optimize ./ ./ ./
fi

mv omni.ja ..
cd "$CALLDIR"
rm -rf "$omni_dir"

# Copy updater.ini
cp "$CALLDIR/assets/updater.ini" "$base_dir"

# Adjust chrome.manifest
#perl -pi -e 's^(chrome|resource)/^jar:zotero.jar\!/$1/^g' "$BUILD_DIR/zotero/chrome.manifest"

# Copy application.ini and modify
cp "$CALLDIR/assets/application.ini" "$app_dir/application.ini"
perl -pi -e "s/\{\{VERSION}}/$VERSION/" "$app_dir/application.ini"
perl -pi -e "s/\{\{BUILDID}}/$BUILD_ID/" "$app_dir/application.ini"

# Remove unnecessary files
find "$BUILD_DIR" -name .DS_Store -exec rm -f {} \;

# Mac
if [ $BUILD_MAC == 1 ]; then
	echo 'Building Zotero.app'
		
	# Set up directory structure
	APPDIR="$STAGE_DIR/Zotero.app"
	rm -rf "$APPDIR"
	mkdir "$APPDIR"
	chmod 755 "$APPDIR"
	cp -r "$CALLDIR/mac/Contents" "$APPDIR"
	CONTENTSDIR="$APPDIR/Contents"
	
	# Merge relevant assets from Firefox
	mkdir "$CONTENTSDIR/MacOS"
	cp -r "$MAC_RUNTIME_PATH/Contents/MacOS/"!(firefox|firefox-bin|crashreporter.app|pingsender|updater.app) "$CONTENTSDIR/MacOS"
	cp -r "$MAC_RUNTIME_PATH/Contents/Resources/"!(application.ini|browser|defaults|precomplete|removed-files|updater.ini|update-settings.ini|webapprt*|*.icns|*.lproj) "$CONTENTSDIR/Resources"

	# Use our own launcher
	check_lfs_file "$CALLDIR/mac/zotero.xz"
	xz -d --stdout "$CALLDIR/mac/zotero.xz" > "$CONTENTSDIR/MacOS/zotero"
	chmod 755 "$CONTENTSDIR/MacOS/zotero"

	# TEMP: Custom version of XUL with some backported Mozilla bug fixes
	cp "$MAC_RUNTIME_PATH/../MacOS/XUL" "$CONTENTSDIR/MacOS/"

	# Use our own updater, because Mozilla's requires updates signed by Mozilla
	cd "$CONTENTSDIR/MacOS"
	check_lfs_file "$CALLDIR/mac/updater.tar.xz"
	tar xf "$CALLDIR/mac/updater.tar.xz"

	# Modify Info.plist
	perl -pi -e "s/\{\{VERSION\}\}/$VERSION/" "$CONTENTSDIR/Info.plist"
	perl -pi -e "s/\{\{VERSION_NUMERIC\}\}/$VERSION_NUMERIC/" "$CONTENTSDIR/Info.plist"
	if [ $UPDATE_CHANNEL == "beta" ] || [ $UPDATE_CHANNEL == "dev" ] || [ $UPDATE_CHANNEL == "source" ]; then
		perl -pi -e "s/org\.zotero\.zotero/org.zotero.zotero-$UPDATE_CHANNEL/" "$CONTENTSDIR/Info.plist"
	fi
	perl -pi -e "s/\{\{VERSION\}\}/$VERSION/" "$CONTENTSDIR/Info.plist"
	# Needed for "monkeypatch" Windows builds: 
	# http://www.nntp.perl.org/group/perl.perl5.porters/2010/08/msg162834.html
	rm -f "$CONTENTSDIR/Info.plist.bak"
	
	echo
	grep -B 1 org.zotero.zotero "$CONTENTSDIR/Info.plist"
	echo
	grep -A 1 CFBundleShortVersionString "$CONTENTSDIR/Info.plist"
	echo
	grep -A 1 CFBundleVersion "$CONTENTSDIR/Info.plist"
	echo
	
	# Copy app files
	rsync -a "$base_dir/" "$CONTENTSDIR/Resources/"
	
	# Add word processor plug-ins
	mkdir "$CONTENTSDIR/Resources/integration"
	cp -RH "$CALLDIR/modules/zotero-libreoffice-integration/install" "$CONTENTSDIR/Resources/integration/libreoffice"
	cp -RH "$CALLDIR/modules/zotero-word-for-mac-integration/install" "$CONTENTSDIR/Resources/integration/word-for-mac"
	
	# Delete extraneous files
	find "$CONTENTSDIR" -depth -type d -name .git -exec rm -rf {} \;
	find "$CONTENTSDIR" \( -name .DS_Store -or -name update.rdf \) -exec rm -f {} \;

	# Copy over removed-files and make a precomplete file here since it needs to be stable for the
	# signature. This is done in build_autocomplete.sh for other platforms.
	cp "$CALLDIR/update-packaging/removed-files_mac" "$CONTENTSDIR/Resources/removed-files"
	touch "$CONTENTSDIR/Resources/precomplete"
	
	# Sign
	if [ $SIGN == 1 ]; then
		# Unlock keychain if a password is provided (necessary for building from a shell)
		if [ -n "$KEYCHAIN_PASSWORD" ]; then
			security -v unlock-keychain -p "$KEYCHAIN_PASSWORD" ~/Library/Keychains/$KEYCHAIN.keychain-db
		fi
		# Clear extended attributes, which can cause codesign to fail
		/usr/bin/xattr -cr "$APPDIR"

		# Sign app
		entitlements_file="$CALLDIR/mac/entitlements.xml"
		/usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" \
			"$APPDIR/Contents/MacOS/XUL" \
			"$APPDIR/Contents/MacOS/updater.app/Contents/MacOS/org.mozilla.updater"
		find "$APPDIR/Contents" -name '*.dylib' -exec /usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" {} \;
		find "$APPDIR/Contents" -name '*.app' -exec /usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" {} \;
		/usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" "$APPDIR/Contents/MacOS/zotero"
		
		# Bundle and sign Safari App Extension
		#
		# Even though it's signed by Xcode, we sign it again to make sure it matches the parent app signature
		if [[ -n "$SAFARI_APPEX" ]] && [[ -d "$SAFARI_APPEX" ]]; then
			echo
			# Extract entitlements, which differ from parent app
			/usr/bin/codesign -d --entitlements :"$BUILD_DIR/safari-entitlements.plist" $SAFARI_APPEX
			mkdir "$APPDIR/Contents/PlugIns"
			cp -R $SAFARI_APPEX "$APPDIR/Contents/PlugIns/ZoteroSafariExtension.appex"
			# Add suffix to appex bundle identifier
			if [ $UPDATE_CHANNEL == "beta" ] || [ $UPDATE_CHANNEL == "dev" ] || [ $UPDATE_CHANNEL == "source" ]; then
				perl -pi -e "s/org\.zotero\.SafariExtensionApp\.SafariExtension/org.zotero.SafariExtensionApp.SafariExtension-$UPDATE_CHANNEL/" "$APPDIR/Contents/PlugIns/ZoteroSafariExtension.appex/Contents/Info.plist"
			fi
			find "$APPDIR/Contents/PlugIns/ZoteroSafariExtension.appex/Contents" -name '*.dylib' -exec /usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" {} \;
			/usr/bin/codesign --force --options runtime --entitlements "$BUILD_DIR/safari-entitlements.plist" --sign "$DEVELOPER_ID" "$APPDIR/Contents/PlugIns/ZoteroSafariExtension.appex"
		fi
		
		# Sign final app package
		echo
		/usr/bin/codesign --force --options runtime --entitlements "$entitlements_file" --sign "$DEVELOPER_ID" "$APPDIR"
		
		# Verify app
		/usr/bin/codesign --verify -vvvv "$APPDIR"
		# Verify Safari App Extension
		if [[ -n "$SAFARI_APPEX" ]] && [[ -d "$SAFARI_APPEX" ]]; then
			echo
			/usr/bin/codesign --verify -vvvv "$APPDIR/Contents/PlugIns/ZoteroSafariExtension.appex"
		fi
	fi
	
	# Build and notarize disk image
	if [ $PACKAGE == 1 ]; then
		if [ $MAC_NATIVE == 1 ]; then
			echo "Creating Mac installer"
			dmg="$DIST_DIR/Zotero-$VERSION.dmg"
			"$CALLDIR/mac/pkg-dmg" --source "$STAGE_DIR/Zotero.app" \
				--target "$dmg" \
				--sourcefile --volname Zotero --copy "$CALLDIR/mac/DSStore:/.DS_Store" \
				--symlink /Applications:"/Drag Here to Install" > /dev/null
			
			if [ "$UPDATE_CHANNEL" != "test" ]; then
				# Upload disk image to Apple
				"$CALLDIR/scripts/notarize_mac_app" "$dmg"
				echo
				
				# Staple notarization info to disk image
				"$CALLDIR/scripts/notarization_stapler" "$dmg"
				
				echo "Notarization complete"
			else
				echo "Test build -- skipping notarization"
			fi
			echo
		else
			echo 'Not building on Mac; creating Mac distribution as a zip file'
			rm -f "$DIST_DIR/Zotero_mac.zip"
			cd "$STAGE_DIR" && zip -rqX "$DIST_DIR/Zotero-${VERSION}_mac.zip" Zotero.app
		fi
	fi
fi

# Windows
if [ $BUILD_WIN == 1 ]; then
	echo "Building Windows common"
	
	COMMON_APPDIR="$STAGE_DIR/Zotero_common"
	mkdir "$COMMON_APPDIR"
	
	# Package non-arch-specific components
	if [ $PACKAGE -eq 1 ]; then
		# Copy installer files
		cp -r "$CALLDIR/win/installer" "$BUILD_DIR/win_installer"

		perl -pi -e "s/\{\{VERSION}}/$VERSION/" "$BUILD_DIR/win_installer/defines.nsi"
		mkdir "$COMMON_APPDIR/uninstall"
		
		# Compress 7zSD.sfx
		upx --best -o "`cygpath -w \"$BUILD_DIR/7zSD.sfx\"`" \
			"`cygpath -w \"$CALLDIR/win/installer/7zstub/firefox/7zSD.sfx\"`" > /dev/null
	
	fi
	
	for arch in win32 win-x64 win-arm64; do
		echo "Building Zotero_$arch"
		
		runtime_path="${WIN_RUNTIME_PATH_PREFIX}${arch}"
		
		# Set up directory
		APPDIR="$STAGE_DIR/Zotero_$arch"
		mkdir "$APPDIR"
		
		# Copy relevant assets from Firefox
		#
		# 'i686' is a huge directory containing x86 versions of xul.dll and other files in
		# Firefox ARM64 builds for use with the EME DRM plugins
		cp -R "$runtime_path"/!(application.ini|browser|crashreporter*|default-browser-agent.exe|defaultagent*|defaults|devtools-files|firefox*|i686|maintenanceservice*|minidump-analyzer.exe|pingsender.exe|private_browsing*|precomplete|removed-files|uninstall|update*) "$APPDIR"

		# Copy zotero.exe, which is built directly from Firefox source and then modified by
		# ResourceHacker to add icons
		check_lfs_file "$CALLDIR/win/zotero.exe.tar.xz"
		tar xf "$CALLDIR/win/zotero.exe.tar.xz" --to-stdout zotero_$arch.exe > "$APPDIR/zotero.exe"
		
		# Use our own updater, because Mozilla's requires updates signed by Mozilla
		check_lfs_file "$CALLDIR/win/updater.exe.tar.xz"
		tar xf "$CALLDIR/win/updater.exe.tar.xz" --to-stdout updater-$arch.exe > "$APPDIR/updater.exe"
		cat "$CALLDIR/win/installer/updater_append.ini" >> "$APPDIR/updater.ini"
		
		# Update .exe version numbers (only possible on Windows)
		if [ $WIN_NATIVE == 1 ]; then
			# FileVersion is limited to four integers, so it won't be properly updated for non-release
			# builds (e.g., we'll show 5.0.97.0 for 5.0.97-beta.37). ProductVersion will be the full
			# version string.
			rcedit "`cygpath -w \"$APPDIR/zotero.exe\"`" \
				--set-file-version "$VERSION_NUMERIC" \
				--set-product-version "$VERSION"
			rcedit "`cygpath -w \"$APPDIR/updater.exe\"`" \
				--set-file-version "$VERSION_NUMERIC" \
				--set-product-version "$VERSION"
		fi
		
		# Sign updater
		if [ $SIGN -eq 1 ]; then
			"$CALLDIR/win/codesign" "$APPDIR/updater.exe" "$SIGNATURE_DESC Updater"
		fi
		
		# Copy app files
		rsync -a "$base_dir/" "$APPDIR/"
		#mv "$APPDIR/app/application.ini" "$APPDIR/"
		
		# Copy in common files
		rsync -a "$COMMON_APPDIR/" "$APPDIR/"
		
		# Add devtools
		#if [ $DEVTOOLS -eq 1 ]; then
		#	# Create devtools.jar
		#	cd "$BUILD_DIR"
		#	mkdir -p devtools/locale
		#	cp -r "$runtime_path"/devtools-files/chrome/devtools/* devtools/
		#	cp -r "$runtime_path"/devtools-files/chrome/locale/* devtools/locale/
		#	cd devtools
		#	zip -r -q ../devtools.jar *
		#	cd ..
		#	rm -rf devtools
		#	mv devtools.jar "$APPDIR"
		#	
		#	cp "$runtime_path/devtools-files/components/interfaces.xpt" "$APPDIR/components/"
		#fi
		
		# Add word processor plug-ins
		mkdir -p "$APPDIR/integration"
		cp -RH "$CALLDIR/modules/zotero-libreoffice-integration/install" "$APPDIR/integration/libreoffice"
		cp -RH "$CALLDIR/modules/zotero-word-for-windows-integration/install" "$APPDIR/integration/word-for-windows"
		if [ $arch = 'win32' ]; then
			rm "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_x64.dll"
			rm "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_ARM64.dll"
		elif [ $arch = 'win-x64' ]; then
			mv "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_x64.dll" \
				"$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration.dll"
			rm "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_ARM64.dll"
		elif [ $arch = 'win-arm64' ]; then
			mv "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_ARM64.dll" \
				"$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration.dll"
			rm "$APPDIR/integration/word-for-windows/libzoteroWinWordIntegration_x64.dll"
		fi
		
		# Delete extraneous files
		find "$APPDIR" -depth -type d -name .git -exec rm -rf {} \;
		find "$APPDIR" \( -name .DS_Store -or -name '.git*' -or -name '.travis.yml' -or -name update.rdf -or -name '*.bak' \) -exec rm -f {} \;
		find "$APPDIR" \( -name '*.exe' -or -name '*.dll' \) -exec chmod 755 {} \;
		
		if [ $PACKAGE -eq 1 ]; then
			if [ $WIN_NATIVE -eq 1 ]; then
				echo "Creating Windows installer"
				# Build uninstaller
				if [ "$arch" = "win32" ]; then
					"`cygpath -u \"${NSIS_DIR}makensis.exe\"`" /V1 "`cygpath -w \"$BUILD_DIR/win_installer/uninstaller.nsi\"`"
				elif [[ "$arch" = "win-x64" ]] || [[ "$arch" = "win-arm64" ]]; then
					"`cygpath -u \"${NSIS_DIR}makensis.exe\"`" /DHAVE_64BIT_OS /V1 "`cygpath -w \"$BUILD_DIR/win_installer/uninstaller.nsi\"`"
				fi

				mv "$BUILD_DIR/win_installer/helper.exe" "$APPDIR/uninstall"

				if [ $SIGN -eq 1 ]; then
					"$CALLDIR/win/codesign" "$APPDIR/uninstall/helper.exe" "$SIGNATURE_DESC Uninstaller"
					sleep $SIGNTOOL_DELAY
				fi
				
				
				if [ "$arch" = "win32" ]; then
					INSTALLER_PATH="$DIST_DIR/Zotero-${VERSION}_win32_setup.exe"
				elif [ "$arch" = "win-x64" ]; then
					INSTALLER_PATH="$DIST_DIR/Zotero-${VERSION}_x64_setup.exe"
				elif [ "$arch" = "win-arm64" ]; then
					INSTALLER_PATH="$DIST_DIR/Zotero-${VERSION}_arm64_setup.exe"
				fi
				
				if [ $SIGN -eq 1 ]; then
					"$CALLDIR/win/codesign" "$APPDIR/zotero.exe" "$SIGNATURE_DESC"
					sleep $SIGNTOOL_DELAY
				fi
				
				# Stage installer
				INSTALLER_STAGE_DIR="$BUILD_DIR/win_installer/staging"
				rm -rf "$INSTALLER_STAGE_DIR"
				mkdir "$INSTALLER_STAGE_DIR"
				cp -r "$APPDIR" "$INSTALLER_STAGE_DIR/core"
				
				# Build and sign setup.exe
				if [ "$arch" = "win32" ]; then	
					"`cygpath -u \"${NSIS_DIR}makensis.exe\"`" /V1 "`cygpath -w \"$BUILD_DIR/win_installer/installer.nsi\"`"
				elif [[ "$arch" = "win-x64" ]] || [[ "$arch" = "win-arm64" ]]; then
					"`cygpath -u \"${NSIS_DIR}makensis.exe\"`" /DHAVE_64BIT_OS /V1 "`cygpath -w \"$BUILD_DIR/win_installer/installer.nsi\"`"
				fi

				mv "$BUILD_DIR/win_installer/setup.exe" "$INSTALLER_STAGE_DIR"

				if [ $SIGN == 1 ]; then
					"$CALLDIR/win/codesign" "$INSTALLER_STAGE_DIR/setup.exe" "$SIGNATURE_DESC Setup"
					sleep $SIGNTOOL_DELAY
				fi
				
				# Compress application
				cd "$INSTALLER_STAGE_DIR" && 7z a -r -t7z "`cygpath -w \"$BUILD_DIR/app_$arch.7z\"`" \
					-mx -m0=BCJ2 -m1=LZMA:d24 -m2=LZMA:d19 -m3=LZMA:d19  -mb0:1 -mb0s1:2 -mb0s2:3 > /dev/null
				
				# Combine 7zSD.sfx and app.tag into setup.exe
				cat "$BUILD_DIR/7zSD.sfx" "$CALLDIR/win/installer/app.tag" \
					"$BUILD_DIR/app_$arch.7z" > "$INSTALLER_PATH"
				
				# Sign installer .exe
				if [ $SIGN == 1 ]; then
					"$CALLDIR/win/codesign" "$INSTALLER_PATH" "$SIGNATURE_DESC Installer"
				fi
				
				chmod 755 "$INSTALLER_PATH"
			else
				echo 'Not building on Windows; only building zip file'
			fi
			cd "$STAGE_DIR"
			zip -rqX "$DIST_DIR/Zotero-${VERSION}_$arch.zip" Zotero_$arch
		fi
	done
	
	rm -rf "$COMMON_APPDIR"
fi

# Linux
if [ $BUILD_LINUX == 1 ]; then
	# Skip 32-bit build in tests
	if [[ "${ZOTERO_TEST:-}" = "1" ]] || [[ "${SKIP_32:-}" = "1" ]]; then
		archs="x86_64"
	else
		archs="i686 x86_64"
	fi
	
	for arch in $archs; do
		runtime_path="${LINUX_RUNTIME_PATH_PREFIX}${arch}"
		
		# Set up directory
		echo 'Building Zotero_linux-'$arch
		APPDIR="$STAGE_DIR/Zotero_linux-$arch"
		rm -rf "$APPDIR"
		mkdir "$APPDIR"
		
		# Merge relevant assets from Firefox
		cp -r "$runtime_path/"!(application.ini|browser|defaults|devtools-files|crashreporter|crashreporter.ini|firefox|pingsender|precomplete|removed-files|run-mozilla.sh|update-settings.ini|updater|updater.ini) "$APPDIR"
		
		# Use our own launcher that calls the original Firefox executable with -app
		mv "$APPDIR"/firefox-bin "$APPDIR"/zotero-bin
		cp "$CALLDIR/linux/zotero" "$APPDIR"/zotero
		
		# Copy Ubuntu launcher files
		cp "$CALLDIR/linux/zotero.desktop" "$APPDIR"
		cp "$CALLDIR/linux/set_launcher_icon" "$APPDIR"
		
		# Use our own updater, because Mozilla's requires updates signed by Mozilla
		check_lfs_file "$CALLDIR/linux/updater.tar.xz"
		tar xf "$CALLDIR/linux/updater.tar.xz" --to-stdout updater-$arch > "$APPDIR/updater"
		chmod 755 "$APPDIR/updater"

		# Copy app files
		rsync -a "$base_dir/" "$APPDIR/"
		
		# Add word processor plug-ins
		mkdir "$APPDIR/integration"
		cp -RH "$CALLDIR/modules/zotero-libreoffice-integration/install" "$APPDIR/integration/libreoffice"
		
		# Copy icons
		cp "$CALLDIR/linux/icons/icon32.png" "$APPDIR/icons/"
		cp "$CALLDIR/linux/icons/icon64.png" "$APPDIR/icons/"
		cp "$CALLDIR/linux/icons/icon128.png" "$APPDIR/icons/"
		cp "$CALLDIR/linux/icons/symbolic.svg" "$APPDIR/icons/"
		
		# Delete extraneous files
		find "$APPDIR" -depth -type d -name .git -exec rm -rf {} \;
		find "$APPDIR" \( -name .DS_Store -or -name update.rdf \) -exec rm -f {} \;
		
		if [ $PACKAGE == 1 ]; then
			# Create tar
			rm -f "$DIST_DIR/Zotero-${VERSION}_linux-$arch.tar.bz2"
			cd "$STAGE_DIR"
			tar -cjf "$DIST_DIR/Zotero-${VERSION}_linux-$arch.tar.bz2" "Zotero_linux-$arch"
		fi
	done
fi

rm -rf $BUILD_DIR
