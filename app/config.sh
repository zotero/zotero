DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Version of Gecko to build with
GECKO_VERSION_MAC="102.15.1esr"
GECKO_VERSION_LINUX="102.15.1esr"
GECKO_VERSION_WIN="102.15.1esr"
RUST_VERSION=1.60.0

# URL prefix for custom builds of Firefox components
custom_components_url="https://download.zotero.org/dev/"

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

# Paths for Windows installer build only necessary for signed binaries
SIGNTOOL='C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe'
SIGNATURE_DESC='Zotero'
SIGNATURE_URL='https://www.zotero.org/'
SIGNTOOL_CERT_SUBJECT="Corporation for Digital Scholarship"
SIGNTOOL_TIMESTAMP_SERVER="http://timestamp.sectigo.com"
SIGNTOOL_DELAY=15

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
