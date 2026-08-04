DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="153.0esr"
GECKO_VERSION_LINUX="153.0esr"
GECKO_VERSION_WIN="153.0esr"
RUST_VERSION=1.94.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac=""
custom_components_hash_win_x64="be63d44b92858ccd73b3e8b0100b36b35499e4076d76ffb2fa7b9c164fb63b7b"
custom_components_hash_win_arm64="80e553e0056df63531923b5cdc66e3d7d4e655e7344593b7b09c89c3d3000975"
custom_components_hash_win32="b371153799c1f16b5e13a64be1835402ee2e2d277457b5e4969470c7d251754b"

APP_NAME="Zotero"
APP_ID="zotero\@zotero.org"

# Whether to sign builds
SIGN=0

# OS X Developer ID certificate information
DEVELOPER_ID=F0F1FE48DB909B263AC51C8215374D87FDC12121
# Keychain and keychain password, if not building via the GUI
KEYCHAIN=""
KEYCHAIN_PASSWORD=""
NOTARIZATION_BUNDLE_ID=""
NOTARIZATION_USER=""
NOTARIZATION_TEAM_ID=""
NOTARIZATION_PASSWORD=""

# Paths for Windows installer build
NSIS_DIR='C:\Program Files (x86)\NSIS\'

SIGNTOOL_DELAY=5

# Directory for unpacked binaries
STAGE_DIR="$DIR/staging"
# Directory for packed binaries
DIST_DIR="$DIR/dist"

SOURCE_REPO_URL="https://github.com/zotero/zotero"
S3_BUCKET="zotero-download"
S3_CI_ZIP_PATH="ci/client"
S3_DIST_PATH="client"

DEPLOY_HOST="deploy.zotero"
DEPLOY_PATH="www/www-production/public/download/client"

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
