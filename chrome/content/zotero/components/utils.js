const noop = () => {};

const humanReadableSize = (bytes, fractionDigits) => {
	let unitsIndex = 0;
	while (bytes > 1023 && unitsIndex < 5) {
		bytes /= 1024;
		unitsIndex += 1;
	}

	const units = [
		'bytes', 'kilobytes', 'megabytes', 'gigabytes', 'terabytes'
	];

	let size = bytes.toFixed(fractionDigits);
	if (unitsIndex === 0) {
		// Do not use a decimal for bytes
		size = bytes;
	}

	return Zotero.getString(
		'zotero.preferences.sync.fileSyncing.breakdown.' + units[unitsIndex],
		size,
		size
	);
};

export {
	noop,
	humanReadableSize
};
