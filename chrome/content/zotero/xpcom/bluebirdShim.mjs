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
		// ONLY exists for translator code that needs synchronous resolution.
		// Please don't use this anywhere else. It's a bad idea!
		return function (...args) {
			try {
				let returnValue = fn.apply(this, args);
				let promise;
				let isResolved = false;
				if (returnValue && returnValue.then) {
					promise = returnValue;
				}
				else {
					promise = Promise.resolve(returnValue);
					isResolved = true;
				}
				if (typeof promise.isResolved === 'undefined') {
					promise.then(() => isResolved = true, () => {});
					promise.isResolved = () => isResolved;
				}
				return promise;
			}
			catch (e) {
				return Promise.reject(e);
			}
		};
	}
}
