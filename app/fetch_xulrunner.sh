#!/bin/bash
set -euo pipefail

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

function usage {
	cat >&2 <<DONE
Usage: $0 -p platforms [-s]
Options
 -p PLATFORMS        Platforms to build (m=Mac, w=Windows, l=Linux)
DONE
	exit 1
}

BUILD_MAC=0
BUILD_WIN=0
BUILD_LINUX=0
while getopts "p:s" opt; do
	case $opt in
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
	esac
	shift $((OPTIND-1)); OPTIND=1
done

# Require at least one platform
if [[ $BUILD_MAC == 0 ]] && [[ $BUILD_WIN == 0 ]] && [[ $BUILD_LINUX == 0 ]]; then
	usage
fi

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

function remove_line {
	pattern=$1
	file=$2
	
	if egrep -q "$pattern" "$file"; then
		egrep -v "$pattern" "$file" > "$file.tmp"
		mv "$file.tmp" "$file"
	else
		echo "$pattern" not found in "$infile" -- aborting 2>&1
		exit 1
	fi
}

#
# Make various modifications to the stock Firefox app
#
function modify_omni {
	local platform=$1
	
	mkdir omni
	mv omni.ja omni
	cd omni
	# omni.ja is an "optimized" ZIP file, so use a script from Mozilla to avoid a warning from unzip
	# here and to make it work after rezipping below
	python3 "$CALLDIR/scripts/optimizejars.py" --deoptimize ./ ./ ./
	rm -f omni.ja.log
	unzip omni.ja
	rm omni.ja
	
	replace_line 'BROWSER_CHROME_URL:.+' 'BROWSER_CHROME_URL: "chrome:\/\/zotero\/content\/zoteroPane.xhtml",' modules/AppConstants.jsm
	
	# https://firefox-source-docs.mozilla.org/toolkit/components/telemetry/internals/preferences.html
	#
	# It's not clear that most of these do anything anymore when not compiled in, but just in case
	replace_line 'MOZ_REQUIRE_SIGNING:' 'MOZ_REQUIRE_SIGNING: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_DATA_REPORTING:' 'MOZ_DATA_REPORTING: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_SERVICES_HEALTHREPORT:' 'MOZ_SERVICES_HEALTHREPORT: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_TELEMETRY_REPORTING:' 'MOZ_TELEMETRY_REPORTING: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_TELEMETRY_ON_BY_DEFAULT:' 'MOZ_TELEMETRY_ON_BY_DEFAULT: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_CRASHREPORTER:' 'MOZ_CRASHREPORTER: false \&\&' modules/AppConstants.jsm
	replace_line 'MOZ_UPDATE_CHANNEL:.+' 'MOZ_UPDATE_CHANNEL: "none",' modules/AppConstants.jsm
	replace_line '"https:\/\/[^\/]+mozilla.com.+"' '""' modules/AppConstants.jsm
	
	replace_line 'if \(!updateAuto\) \{' 'if (update.type == "major") {
      LOG("UpdateService:_selectAndInstallUpdate - prompting because it is a major update");
      AUSTLMY.pingCheckCode(this._pingSuffix, AUSTLMY.CHK_SHOWPROMPT_PREF);
      Services.obs.notifyObservers(update, "update-available", "show-prompt");
      return;
    }
    if (!updateAuto) {' modules/UpdateService.jsm
	
	replace_line 'pref\("network.captive-portal-service.enabled".+' 'pref("network.captive-portal-service.enabled", false);' greprefs.js
	replace_line 'pref\("network.connectivity-service.enabled".+' 'pref("network.connectivity-service.enabled", false);' greprefs.js
	replace_line 'pref\("toolkit.telemetry.server".+' 'pref("toolkit.telemetry.server", "");' greprefs.js
	replace_line 'pref\("toolkit.telemetry.unified".+' 'pref("toolkit.telemetry.unified", false);' greprefs.js
	
	#  
	#  # Disable transaction timeout
	#  perl -pi -e 's/let timeoutPromise/\/*let timeoutPromise/' modules/Sqlite.jsm
	#  perl -pi -e 's/return Promise.race\(\[transactionPromise, timeoutPromise\]\);/*\/return transactionPromise;/' modules/Sqlite.jsm
	#  rm -f jsloader/resource/gre/modules/Sqlite.jsm
	#  
	# Disable unwanted components
	remove_line '(RemoteSettings|services-|telemetry|Telemetry|URLDecorationAnnotationsService)' components/components.manifest
	
	# Remove unwanted files
	rm modules/FxAccounts*
	# Causes a startup error -- try an empty file or a shim instead?
	#rm modules/Telemetry*
	rm modules/URLDecorationAnnotationsService.jsm
	rm -rf modules/services-*
	
	# Clear most WebExtension manifest properties
	replace_line 'manifest = normalized.value;' 'manifest = normalized.value;
    if (this.type == "extension") {
      if (!manifest.applications?.zotero?.id) {
        this.manifestError("applications.zotero.id not provided");
      }
      if (!manifest.applications?.zotero?.update_url) {
        this.manifestError("applications.zotero.update_url not provided");
      }
      if (!manifest.applications?.zotero?.strict_max_version) {
        this.manifestError("applications.zotero.strict_max_version not provided");
      }
      manifest.browser_specific_settings = undefined;
      manifest.content_scripts = [];
      manifest.permissions = [];
      manifest.host_permissions = [];
      manifest.web_accessible_resources = undefined;
      manifest.experiment_apis = {};
    }' modules/Extension.jsm
    
	# Use applications.zotero instead of applications.gecko
	replace_line 'let bss = manifest.applications\?.gecko' 'let bss = manifest.applications?.zotero' modules/addons/XPIInstall.jsm
	replace_line 'manifest.applications\?.gecko' 'manifest.applications?.zotero' modules/Extension.jsm
	
	# When installing addon, use app version instead of toolkit version for targetApplication
	replace_line "id: TOOLKIT_ID," "id: '$APP_ID'," modules/addons/XPIInstall.jsm
	
	# Accept zotero@chnm.gmu.edu for target application to allow Zotero 6 plugins to remain
	# installed in Zotero 7
	replace_line "if \(targetApp.id == Services.appinfo.ID\) \{" "if (targetApp.id == 'zotero\@chnm.gmu.edu') targetApp.id = '$APP_ID'; if (targetApp.id == Services.appinfo.ID) {" modules/addons/XPIDatabase.jsm
	
	# For updates, look for applications.zotero instead of applications.gecko in manifest.json and
	# use the app id and version for strict_min_version/strict_max_version comparisons
	replace_line 'gecko: \{\},' 'zotero: {},' modules/addons/AddonUpdateChecker.jsm
	replace_line 'if \(!\("gecko" in applications\)\) \{'  'if (!("zotero" in applications)) {' modules/addons/AddonUpdateChecker.jsm
	replace_line '"gecko not in application entry' '"zotero not in application entry' modules/addons/AddonUpdateChecker.jsm
	replace_line 'let app = getProperty\(applications, "gecko", "object"\);' 'let app = getProperty(applications, "zotero", "object");' modules/addons/AddonUpdateChecker.jsm
	replace_line "id: TOOLKIT_ID," "id: '$APP_ID'," modules/addons/AddonUpdateChecker.jsm
	replace_line 'AddonManagerPrivate.webExtensionsMinPlatformVersion' '7.0' modules/addons/AddonUpdateChecker.jsm
	replace_line 'result.targetApplications.push' 'false && result.targetApplications.push' modules/addons/AddonUpdateChecker.jsm
	
	# Allow addon installation by bypassing confirmation dialogs. If we want a confirmation dialog,
	# we need to either add gXPInstallObserver from browser-addons.js [1][2] or provide our own with
	# Ci.amIWebInstallPrompt [3].
	#
	# [1] https://searchfox.org/mozilla-esr102/rev/5a6d529652045050c5cdedc0558238949b113741/browser/base/content/browser.js#1902-1923
	# [2] https://searchfox.org/mozilla-esr102/rev/5a6d529652045050c5cdedc0558238949b113741/browser/base/content/browser-addons.js#201
	# [3] https://searchfox.org/mozilla-esr102/rev/5a6d529652045050c5cdedc0558238949b113741/toolkit/mozapps/extensions/AddonManager.jsm#3114-3124
	replace_line 'if \(info.addon.userPermissions\) \{' 'if (false) {' modules/AddonManager.jsm
	replace_line '\} else if \(info.addon.sitePermissions\) \{' '} else if (false) {' modules/AddonManager.jsm
	replace_line '\} else if \(requireConfirm\) \{' '} else if (false) {' modules/AddonManager.jsm
	
	# No idea why this is necessary, but without it initialization fails with "TypeError: "constructor" is read-only"
	replace_line 'LoginStore.prototype.constructor = LoginStore;' '\/\/LoginStore.prototype.constructor = LoginStore;' modules/LoginStore.jsm
	#  
	#  # Allow proxy password saving
	#  perl -pi -e 's/get _inPrivateBrowsing\(\) \{/get _inPrivateBrowsing() {if (true) { return false; }/' components/nsLoginManagerPrompter.js
	#  
	#  # Change text in update dialog
	#  perl -pi -e 's/A security and stability update for/A new version of/' chrome/en-US/locale/en-US/mozapps/update/updates.properties
	#  perl -pi -e 's/updateType_major=New Version/updateType_major=New Major Version/' chrome/en-US/locale/en-US/mozapps/update/updates.properties
	#  perl -pi -e 's/updateType_minor=Security Update/updateType_minor=New Version/' chrome/en-US/locale/en-US/mozapps/update/updates.properties
	#  perl -pi -e 's/update for &brandShortName; as soon as possible/update as soon as possible/' chrome/en-US/locale/en-US/mozapps/update/updates.dtd
	#  
	# Set available locales
	cp "$CALLDIR/assets/multilocale.txt" res/multilocale.txt
	#  
	#  # Force Lucida Grande on non-Retina displays, since San Francisco is used otherwise starting in
	#  # Catalina, and it looks terrible
	#  if [[ $platform == 'mac' ]]; then
	#  	echo "* { font-family: Lucida Grande, Lucida Sans Unicode, Lucida Sans, Geneva, -apple-system, sans-serif !important; }" >> chrome/toolkit/skin/classic/global/global.css
	#  fi
	
	# Use Zotero URL opening in Mozilla dialogs (e.g., app update dialog)
	replace_line 'function openURL\(aURL\) \{' 'function openURL(aURL) {let {Zotero} = ChromeUtils.import("chrome:\/\/zotero\/content\/include.jsm"); Zotero.launchURL(aURL); return;' chrome/toolkit/content/global/contentAreaUtils.js
	
	#
	# Modify Add-ons window
	#
	file="chrome/toolkit/content/mozapps/extensions/aboutaddons.css"
	echo >> $file
	# Hide search bar, Themes and Plugins tabs, and sidebar footer
	echo '.main-search, button[name="theme"], button[name="plugin"], sidebar-footer { display: none; }' >> $file
	echo '.main-heading { margin-top: 2em; }' >> $file
	# Hide Details/Permissions tabs in addon details so we only show details
	echo 'addon-details > button-group { display: none !important; }' >> $file
	# Hide "Debug Addons" and "Manage Extension Shortcuts"
	echo 'panel-item[action="debug-addons"], panel-item[action="reset-update-states"] + panel-item-separator, panel-item[action="manage-shortcuts"] { display: none }' >> $file
	
	file="chrome/toolkit/content/mozapps/extensions/aboutaddons.js"
	# Hide unsigned-addon warning
	replace_line 'if \(!isCorrectlySigned\(addon\)\) \{' 'if (!isCorrectlySigned(addon)) {return {};' $file
	# Hide Private Browsing setting in addon details
	replace_line 'pbRow\.' '\/\/pbRow.' $file
	replace_line 'let isAllowed = await isAllowedInPrivateBrowsing' '\/\/let isAllowed = await isAllowedInPrivateBrowsing' $file
	# Use our own strings for the removal prompt
	replace_line 'let \{ BrowserAddonUI \} = windowRoot.ownerGlobal;' '' $file
	replace_line 'await BrowserAddonUI.promptRemoveExtension' 'promptRemoveExtension' $file
	
	# Customize empty-list message
	replace_line 'createEmptyListMessage\(\) {' 'createEmptyListMessage() {
        var p = document.createElement("p");
        p.id = "empty-list-message";
        return p;' $file
	# Swap in include.js, which we need for Zotero.getString(), for abuse-reports.js, which we don't need
	
	# Hide Recommendations tab in sidebar and recommendations in main pane
	replace_line 'function isDiscoverEnabled\(\) \{' 'function isDiscoverEnabled() {return false;' chrome/toolkit/content/mozapps/extensions/aboutaddonsCommon.js
	replace_line 'pref\("extensions.htmlaboutaddons.recommendations.enabled".+' 'pref("extensions.htmlaboutaddons.recommendations.enabled", false);' greprefs.js
	
	# Hide Report option
	replace_line 'pref\("extensions.abuseReport.enabled".+' 'pref("extensions.abuseReport.enabled", false);' greprefs.js
	
	# The first displayed Services.prompt dialog's size jumps around because sizeToContent() is called twice
	# Fix by preventing the first sizeToContent() call if the icon hasn't been loaded yet
	replace_line 'window.sizeToContent\(\);' 'if (ui.infoIcon.complete) window.sizeToContent();' chrome/toolkit/content/global/commonDialog.js
	replace_line 'ui.infoIcon.addEventListener' 'if (!ui.infoIcon.complete) ui.infoIcon.addEventListener' chrome/toolkit/content/global/commonDialog.js
	
	# Use native checkbox instead of Firefox-themed version in prompt dialogs
	replace_line '<xul:checkbox' '<xul:checkbox native=\"true\"' chrome/toolkit/content/global/commonDialog.xhtml
	
	zip -qr9XD omni.ja *
	mv omni.ja ..
	cd ..
	python3 "$CALLDIR/scripts/optimizejars.py" --optimize ./ ./ ./
	rm -rf omni
	
	# Unzip browser/omni.ja and leave unzipped
	cd browser
	mkdir omni
	mv omni.ja omni
	cd omni
	ls -la
	set +e
	unzip omni.ja
	set -e
	rm omni.ja
	
	# Remove Firefox update URLs
	remove_line 'pref\("app.update.url.(manual|details)' defaults/preferences/firefox-branding.js
	
	# Remove Firefox overrides (e.g., to use Firefox-specific strings for connection errors)
	remove_line '(override)' chrome/chrome.manifest
	
	# Remove WebExtension APIs
	remove_line ext-browser.json components/components.manifest
}

mkdir -p xulrunner
cd xulrunner

if [ $BUILD_MAC == 1 ]; then
	GECKO_VERSION="$GECKO_VERSION_MAC"
	DOWNLOAD_URL="https://ftp.mozilla.org/pub/firefox/releases/$GECKO_VERSION"
	rm -rf Firefox.app
	
	if [ -e "Firefox $GECKO_VERSION.app.zip" ]; then
		echo "Using Firefox $GECKO_VERSION.app.zip"
		unzip "Firefox $GECKO_VERSION.app.zip"
	else
		curl -o Firefox.dmg "$DOWNLOAD_URL/mac/en-US/Firefox%20$GECKO_VERSION.dmg"
		set +e
		hdiutil detach -quiet /Volumes/Firefox 2>/dev/null
		set -e
		hdiutil attach -quiet Firefox.dmg
		cp -a /Volumes/Firefox/Firefox.app .
		hdiutil detach -quiet /Volumes/Firefox
	fi
	
	# Download custom components
	#echo
	#rm -rf MacOS
	#if [ -e "Firefox $GECKO_VERSION MacOS.zip" ]; then
	#	echo "Using Firefox $GECKO_VERSION MacOS.zip"
	#	unzip "Firefox $GECKO_VERSION MacOS.zip"
	#else
	#	echo "Downloading Firefox $GECKO_VERSION MacOS.zip"
	#	curl -o MacOS.zip "${custom_components_url}Firefox%20$GECKO_VERSION%20MacOS.zip"
	#	unzip MacOS.zip
	#fi
	#echo
	
	pushd Firefox.app/Contents/Resources
	modify_omni mac
	popd
	
	if [ ! -e "Firefox $GECKO_VERSION.app.zip" ]; then
		rm "Firefox.dmg"
	fi
	
	#if [ ! -e "Firefox $GECKO_VERSION MacOS.zip" ]; then
	#	rm "MacOS.zip"
	#fi
fi

if [ $BUILD_WIN == 1 ]; then
	GECKO_VERSION="$GECKO_VERSION_WIN"
	DOWNLOAD_URL="https://ftp.mozilla.org/pub/firefox/releases/$GECKO_VERSION"
	
	for arch in win32 win64; do
		xdir=firefox-$arch
		
		rm -rf $xdir
		mkdir $xdir
		
		curl -O "$DOWNLOAD_URL/$arch/en-US/Firefox%20Setup%20$GECKO_VERSION.exe"
		
		7z x Firefox%20Setup%20$GECKO_VERSION.exe -o$xdir 'core/*'
		mv $xdir/core $xdir-core
		rm -rf $xdir
		mv $xdir-core $xdir
		
		pushd $xdir
		modify_omni $arch
		popd
		
		rm "Firefox%20Setup%20$GECKO_VERSION.exe"
		echo
		echo
	done
fi

if [ $BUILD_LINUX == 1 ]; then
	GECKO_VERSION="$GECKO_VERSION_LINUX"
	DOWNLOAD_URL="https://ftp.mozilla.org/pub/firefox/releases/$GECKO_VERSION"
	
	rm -rf firefox
	
	curl -O "$DOWNLOAD_URL/linux-i686/en-US/firefox-$GECKO_VERSION.tar.bz2"
	rm -rf firefox-i686
	tar xvf firefox-$GECKO_VERSION.tar.bz2
	mv firefox firefox-i686
	
	pushd firefox-i686
	modify_omni linux32
	popd
	
	rm "firefox-$GECKO_VERSION.tar.bz2"
	
	curl -O "$DOWNLOAD_URL/linux-x86_64/en-US/firefox-$GECKO_VERSION.tar.bz2"
	rm -rf firefox-x86_64
	tar xvf firefox-$GECKO_VERSION.tar.bz2
	mv firefox firefox-x86_64
	
	pushd firefox-x86_64
	modify_omni linux64
	popd
	
	rm "firefox-$GECKO_VERSION.tar.bz2"
fi

echo Done
