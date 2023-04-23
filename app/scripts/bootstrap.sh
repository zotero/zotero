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
