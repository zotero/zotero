const noop = () => {};

const humanReadableSize = (bytes, fractionDigits) => {
	let unitsIndex = 0;
	while (bytes > 1023 && unitsIndex < 5) {
		bytes /= 1024;
		unitsIndex += 1;
	}

	const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
	return bytes.toFixed(fractionDigits) + units[unitsIndex];
};

export {
	noop,
	humanReadableSize
};
