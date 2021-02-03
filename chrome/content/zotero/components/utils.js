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

	return Zotero.getString(
		'zotero.preferences.sync.fileSyncing.breakdown.' + units[unitsIndex],
		bytes.toFixed(fractionDigits),
		bytes.toFixed(fractionDigits)
	);
};

export {
	noop,
	humanReadableSize
};
