export const CanceledException = function (msg) {
	this.message = msg;
	this.stack = new Error().stack;
};
CanceledException.prototype = Object.create(Error.prototype);
CanceledException.prototype.name = "CanceledException";
