'use strict';

var EXPORTED_SYMBOLS = ['Promise'];
    
var Promise = require('bluebird/promise')();

Promise.config({
    warnings: true,
    longStackTraces: true,
    cancellation: true
});

// Use our own stub to avoid the Bluebird deprecation warnings
Promise.defer = function() {
	var deferred = {};
	deferred.promise = new Promise(function(resolve, reject) {
		deferred.resolve = resolve;
		deferred.reject = reject;
	});
	return deferred;
}
// TEMP: Only turn on if debug logging enabled?
Promise.onPossiblyUnhandledRejection((e, promise) => {
		if (e.name == 'ZoteroPromiseInterrupt' || e.handledRejection) {
			return;
		}

		dump('Possibly unhandled rejection:\n\n'
			+ (e.message
				? e.message + "\n\n" + e.stack.split(/\n/)
					// Filter out internal Bluebird calls
					.filter(line => !line.includes('bluebird'))
					.join('\n')
				: e)
			+ '\n');
		throw e;
});

module.exports = Promise;