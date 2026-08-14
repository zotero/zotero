DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="140.13.0esr"
GECKO_VERSION_LINUX="140.13.0esr"
GECKO_VERSION_WIN="140.13.0esr"
RUST_VERSION=1.86.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac=""
custom_components_hash_win_x64="37804490f7348ff2989d4a36a9bc7e6365e5ef43673251e9d6b8b3bdcde92820"
custom_components_hash_win_arm64="71a415af80bdf2716b6861f3daf5c99d5d61f20d7af2aaf0dbb07265e14cff2b"
custom_components_hash_win32="e45b18e8a5fc65bfccffec5b8b7805f1943460e594a9792816a5744877a6a6d1"

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
