export default class BluebirdShimPromise extends Promise {
	static delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}
