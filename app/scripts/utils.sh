get_current_platform() {
	if [[ "$OSTYPE" == "linux-gnu"* ]]; then
		echo l
	elif [[ "$OSTYPE" == "darwin"* ]]; then
		echo m
	elif [[ "$OSTYPE" == "cygwin" ]]; then
		echo w
	elif [[ "$OSTYPE" == "msys" ]]; then
		echo w
	# Unknown, so probably Unix-y
	else
		echo l
	fi
}

get_canonical_arch() {
	local _platform=$1
	local _arch=$2
	
	case $_platform in
		w)
			case $_arch in
				x64)   _arch="win-x64" ;;
				arm64) _arch="win-arm64" ;;
				win32|win-x64|win-arm64) ;;
				*) echo "Invalid Windows archicture: $_arch" >&2;;
			esac
			echo $_arch
			;;
		
		l)
			[[ $_arch == x64 ]] && _arch="x86_64"
			echo $_arch
			;;
		
		*)
			echo "Invalid platform '$platform'" 2>&1
			exit 1
	esac
}

# Print a sorted NUL-separated list of the files in the current directory to
# include in the build manifest. Follows symlinks, like the rsync calls in
# prepare_build and build.sh.
function build_manifest_file_list {
	# Exclusions match the rsync call in prepare_build
	find -L . -mindepth 1 \( -name '.*' -o -name '#*' \) -prune \
			-o -type f ! -name 'package.json' ! -name 'package-lock.json' -print0 \
		| LC_ALL=C sort -z
}

# Read a NUL-separated file list on stdin and print "size|mtime<TAB>path" for
# each file
function stat_file_list {
	if [[ "$OSTYPE" == "darwin"* ]]; then
		xargs -0 stat -L -f '%z|%Fm|%N'
	else
		xargs -0 stat -L -c '%s|%y|%n'
	fi | sed -E 's,^([0-9]+[|][^|]+)[|](\./)?,\1'$'\t'','
}

# Read a NUL-separated file list on stdin and print "hash<TAB>path" for each
# file
function hash_file_list {
	local md5_cmd
	if command -v md5sum > /dev/null 2>&1; then
		md5_cmd="md5sum"
	else
		md5_cmd="md5 -r"
	fi
	xargs -0 $md5_cmd | sed -E 's,^([0-9a-f]{32})  ?(\./)?,\1'$'\t'','
}

# Generate a manifest of a build directory for incremental updates, with one
# "hash<TAB>size|mtime<TAB>path" line per file, sorted by path
function generate_build_manifest {
	local dir=$1
	(
		cd "$dir"
		local file_list
		file_list=$(mktemp)
		build_manifest_file_list > "$file_list"
		paste \
			<(hash_file_list < "$file_list" | cut -f1) \
			<(stat_file_list < "$file_list")
		rm -f "$file_list"
	)
}

# Generate a hash of the files in app/ that affect build output, for detecting
# when a staged build can't be updated incrementally. Since some of the files
# are large binaries, use file sizes and modification times rather than
# contents. The xulrunner runtimes are covered by the hash-* files written by
# fetch_xulrunner.
function generate_app_hash {
	local app_dir=$1
	local md5_cmd
	if command -v md5sum > /dev/null 2>&1; then
		md5_cmd="md5sum"
	else
		md5_cmd="md5 -r"
	fi
	(
		cd "$app_dir"
		local paths=(assets build.sh config.sh scripts mac win linux modules update-packaging)
		if [ -f config-custom.sh ]; then
			paths+=(config-custom.sh)
		fi
		{
			if [[ "$OSTYPE" == "darwin"* ]]; then
				find -L "${paths[@]}" -name '.*' -prune -o -type f -print0 | xargs -0 stat -L -f '%N|%z|%m'
			else
				find -L "${paths[@]}" -name '.*' -prune -o -type f -print0 | xargs -0 stat -L -c '%n|%s|%Y'
			fi
			cat xulrunner/hash-* 2> /dev/null || true
		} | LC_ALL=C sort | $md5_cmd | awk '{print $1}'
	)
}

function check_line {
	pattern=$1
	file=$2
	if ! grep -E -q "$pattern" "$file"; then
		echo "$pattern" not found in "$file" -- aborting 2>&1
		exit 1
	fi
}

function replace_line {
	pattern=$1
	replacement=$2
	file=$3
	
	if grep -E -q "$pattern" "$file"; then
		perl -pi -e "s/$pattern/$replacement/" "$file"
	else
		echo "$pattern" not found in "$file" -- aborting 2>&1
		exit 1
	fi
}

function remove_line {
	pattern=$1
	file=$2
	
	if grep -E -q "$pattern" "$file"; then
		grep -E -v "$pattern" "$file" > "$file.tmp"
		mv "$file.tmp" "$file"
	else
		echo "$pattern" not found in "$file" -- aborting 2>&1
		exit 1
	fi
}

function remove_between {
	start_pattern=$1
	end_pattern=$2
	file=$3
	
	if grep -E -q "$start_pattern" "$file" && grep -E -q "$end_pattern" "$file"; then
		perl -ni -e '
		if (/'"$start_pattern"'/) { $skip = 1; next; }
		elsif ($skip && /'"$end_pattern"'/) { $skip = 0; next; }
		print unless $skip;' "$file"
	else
		echo "$start_pattern" and "$end_pattern" not found in "$file" -- aborting 2>&1
		exit 1
	fi
}
