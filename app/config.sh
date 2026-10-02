DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="140.17.0esr"
GECKO_VERSION_LINUX="140.17.0esr"
GECKO_VERSION_WIN="140.17.0esr"
RUST_VERSION=1.86.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac="15e328615e53f1c37374f44567f108affcf80cfdc07b100da159a5aed15d9b59"
custom_components_hash_win_x64="44c62e4786f131e579636476e23a6998322ac6956d51b599eee79814b59a2d8b"
custom_components_hash_win_arm64="78f549343b4e2cd58e987f1d82477a0e9fdbe929c9f7912683ac9ab967d678fa"
custom_components_hash_win32="ec54d22d7cbf82aca80cf978b8b483c817f55bb2889e2e27f1ba989edbff4697"

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
