DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="128.9.0esr"
GECKO_VERSION_LINUX="128.9.0esr"
GECKO_VERSION_WIN="128.9.0esr"
RUST_VERSION=1.78.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac=""

APP_NAME="Zotero"
APP_ID="zotero\@zotero.org"

# Whether to sign builds
SIGN=0

# OS X Developer ID certificate information
DEVELOPER_ID="Developer ID Application: Curastone CORP. (232AGCYZ2Z)"
# Keychain and keychain password, if not building via the GUI
KEYCHAIN="build"
KEYCHAIN_PASSWORD="buildzotero"
NOTARIZATION_BUNDLE_ID="us.knowhiz.deeptutor"
NOTARIZATION_USER="blrbiran@163.com"
NOTARIZATION_PASSWORD="xyru-xicf-rmmv-ukez"
NOTARIZATION_TEAM_ID="232AGCYZ2Z"

# Paths for Windows installer build
NSIS_DIR='C:\Program Files (x86)\NSIS\'

SIGNTOOL_DELAY=5

# Directory for unpacked binaries
STAGE_DIR="$DIR/staging"
# Directory for packed binaries
DIST_DIR="$DIR/dist"

SOURCE_REPO_URL="https://github.com/zotero/zotero"
S3_BUCKET="deeptutor"
S3_CI_ZIP_PATH="ci/client"
S3_DIST_PATH="update"

DEPLOY_HOST="as1"
DEPLOY_PATH="/home/azureuser/server/client/update"
# DEPLOY_CMD="ssh $DEPLOY_HOST update-site-files"
DEPLOY_CMD=""

BUILD_PLATFORMS=""
NUM_INCREMENTALS=6

if [ "`uname`" = "Darwin" ]; then
	shopt -s expand_aliases
fi

if [ "`uname -o 2> /dev/null`" = "Cygwin" ]; then
	export WIN_NATIVE=1
else
	export WIN_NATIVE=0
fi

# Make utilities (mar/mbsdiff) available in the path
PATH="$DIR/xulrunner/bin:$PATH"

if [ -f "$DIR/config-custom.sh" ]; then
	. "$DIR/config-custom.sh"
fi

unset DIR
