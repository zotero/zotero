/**
 * A constructor used to return data to the caller thread while
 * also executing some specific treatment (e.g. shutting down
 * the current thread, transmitting data instead of copying it).
 *
 * @param {object=} data The data to return to the caller thread.
 * @param {object=} meta Additional instructions, as an object
 * that may contain the following fields:
 * - {bool} shutdown If |true|, shut down the current thread after
 *   having sent the result.
 * - {Array} transfers An array of objects that should be transferred
 *   instead of being copied.
 *
 * @constructor
 */
export function Meta(data?: object | undefined, meta?: object | undefined): void;
export class Meta {
    /**
     * A constructor used to return data to the caller thread while
     * also executing some specific treatment (e.g. shutting down
     * the current thread, transmitting data instead of copying it).
     *
     * @param {object=} data The data to return to the caller thread.
     * @param {object=} meta Additional instructions, as an object
     * that may contain the following fields:
     * - {bool} shutdown If |true|, shut down the current thread after
     *   having sent the result.
     * - {Array} transfers An array of objects that should be transferred
     *   instead of being copied.
     *
     * @constructor
     */
    constructor(data?: object | undefined, meta?: object | undefined);
    data: any;
    meta: any;
}
/**
 * Base class for a worker.
 *
 * Derived classes are expected to provide the following methods:
 * {
 *   dispatch: function(method, args) {
 *     // Dispatch a call to method `method` with args `args`
 *   },
 *   log: function(...msg) {
 *     // Log (or discard) messages (optional)
 *   },
 *   postMessage: function(message, ...transfers) {
 *     // Post a message to the main thread
 *   },
 *   close: function() {
 *     // Close the worker
 *   }
 * }
 *
 * By default, the AbstractWorker is not connected to a message port,
 * hence will not receive anything.
 *
 * To connect it, use `onmessage`, as follows:
 *   self.addEventListener("message", msg => myWorkerInstance.handleMessage(msg));
 * To handle rejected promises we receive from handleMessage, we must connect it to
 * the onError handler as follows:
 *   self.addEventListener("unhandledrejection", function(error) {
 *    throw error.reason;
 *   });
 */
export function AbstractWorker(agent: any): void;
export class AbstractWorker {
    /**
     * Base class for a worker.
     *
     * Derived classes are expected to provide the following methods:
     * {
     *   dispatch: function(method, args) {
     *     // Dispatch a call to method `method` with args `args`
     *   },
     *   log: function(...msg) {
     *     // Log (or discard) messages (optional)
     *   },
     *   postMessage: function(message, ...transfers) {
     *     // Post a message to the main thread
     *   },
     *   close: function() {
     *     // Close the worker
     *   }
     * }
     *
     * By default, the AbstractWorker is not connected to a message port,
     * hence will not receive anything.
     *
     * To connect it, use `onmessage`, as follows:
     *   self.addEventListener("message", msg => myWorkerInstance.handleMessage(msg));
     * To handle rejected promises we receive from handleMessage, we must connect it to
     * the onError handler as follows:
     *   self.addEventListener("unhandledrejection", function(error) {
     *    throw error.reason;
     *   });
     */
    constructor(agent: any);
    _agent: any;
    _deferredJobs: Map<any, any>;
    _deferredJobId: number;
    log(): void;
    _generateDeferredJobId(): string;
    /**
     * Post and wait for an answer from the thread.
     */
    callMainThread(funcName: any, args: any): Promise<any>;
    /**
     * Handle a message.
     */
    handleMessage(msg: any): Promise<void>;
}
