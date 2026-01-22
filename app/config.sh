DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="140.7.0esr"
GECKO_VERSION_LINUX="140.7.0esr"
GECKO_VERSION_WIN="140.7.0esr"
RUST_VERSION=1.86.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/firefox-components/"
custom_components_hash_mac=""
custom_components_hash_win_x64="8405765d48481431a0361704723c870b2c1c2b9e18d77794841927f4aa3bf04c"
custom_components_hash_win_arm64="c96e591b86b0f98d85b29bc7e2202d4ea1371a4321ffe76960f7ae7643bf7ff4"
custom_components_hash_win32="0e2a14ae6e8db4ed56db810e651aaf4f80b7a2e1da0b18b2d8ecddab84174d0a"

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
DEPLOY_PATH="www/www-production/public/download/client/manifests"
DEPLOY_CMD="ssh $DEPLOY_HOST update-site-files"

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
