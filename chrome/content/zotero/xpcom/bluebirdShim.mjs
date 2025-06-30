export class BluebirdShimPromise extends Promise {
	static delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
	
	static defer() {
		let deferred = {};
		deferred.promise = new Promise((resolve, reject) => {
			deferred.resolve = resolve;
			deferred.reject = reject;
		});
		return deferred;
	}
	
	static method(fn) {
		// TEMP: "Implement" this with a stub until we update zotero/translate
		// Don't bother with synchronous resolution - this is just enough to get the client to load
		return function (...args) {
			return Promise.resolve(fn.apply(this, args));
		};
	}
}
