export default class BluebirdShimPromise extends Promise {
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
}
