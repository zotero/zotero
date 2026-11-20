DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="153.7.0esr"
GECKO_VERSION_LINUX="153.7.0esr"
GECKO_VERSION_WIN="153.7.0esr"
RUST_VERSION=1.94.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac="f3b38ed1c55ae7e40b7b5c84fe9f7095cad999033803d8e4579ce026d7338235"
custom_components_hash_win_x64="0ba7247a2b138d6b2004310c1f2a1a5348f6e9533f6f3b9a36de3ab6f4ae4349"
custom_components_hash_win_arm64="fe3b83e1eed98448eba71b09a83253f75dd41702a20d08e4d65f46c5734a0b98"
custom_components_hash_win32="03f04398eb22715d335f85c815538059a36a026d7a9808fe49c7fa07da84e692"

APP_NAME="Zotero"
APP_ID="zotero\@zotero.org"

# Whether to sign builds
SIGN=0

# OS X Developer ID certificate information
DEVELOPER_ID=F0F1FE48DB909B263AC51C8215374D87FDC12121
# Code signing identity for local Mac builds (e.g., an "Apple Development" certificate), so that
# firewalls and other tools can identify them across rebuilds. Can also be set in the environment.
# If empty, local builds aren't signed.
ZOTERO_MAC_DEV_SIGNING_IDENTITY="${ZOTERO_MAC_DEV_SIGNING_IDENTITY:-}"
# Keychain and keychain password, if not building via the GUI
KEYCHAIN=""
KEYCHAIN_PASSWORD=""
NOTARIZATION_BUNDLE_ID=""
NOTARIZATION_USER=""
NOTARIZATION_TEAM_ID=""
NOTARIZATION_PASSWORD=""
# Name of a notarytool keychain profile (see `xcrun notarytool store-credentials`), e.g., for an
# App Store Connect API key -- used instead of the Apple ID settings above if set
NOTARIZATION_PROFILE=""

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
