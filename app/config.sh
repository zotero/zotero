DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="153.1.0esr"
GECKO_VERSION_LINUX="153.1.0esr"
GECKO_VERSION_WIN="153.1.0esr"
RUST_VERSION=1.94.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac=""
custom_components_hash_win_x64="ac2cd5e2d4190c07af1649ca0372ff07dae70afd880d309441dafb575ccdc61a"
custom_components_hash_win_arm64="2369eb75912fb91633fb16d0f756c78d41f533522a3415bb4746c2a911547083"
custom_components_hash_win32="8eea54a3754b5f5331fc9147a6e7741976d70ddb48c8759f3b1a77e8729d8019"

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
