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
				let isFulfilled = false;
				if (returnValue && returnValue.then) {
					promise = returnValue;
				}
				else {
					promise = Promise.resolve(returnValue);
					isResolved = true;
					isFulfilled = true;
				}
				if (typeof promise.isResolved === 'undefined') {
					promise.then(
						() => {
							isResolved = true;
							isFulfilled = true;
						},
						() => isResolved = true
					);
					promise.isResolved = () => isResolved;
				}
				if (promise.value === undefined) {
					promise.value = () => {
						if (!isFulfilled) {
							throw new Error("value() called on unfulfilled promise");
						}
						return returnValue;
					};
				}
				return promise;
			}
			catch (e) {
				return Promise.reject(e);
			}
		};
	}
}
