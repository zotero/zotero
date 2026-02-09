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

function check_line {
	pattern=$1
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
