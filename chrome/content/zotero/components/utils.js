const noop = () => {};

const humanReadableSize = (bytes) => {
	let unitsIndex = 0;
	while (bytes > 1023 && unitsIndex < 5) {
		bytes = Math.floor(bytes / 1024);
		unitsIndex += 1;
	}
	
	const units = ['bytes', 'KB', 'MB', 'GB', 'TB'];
	return bytes + units[unitsIndex];
};

export {
	noop,
	humanReadableSize
};
