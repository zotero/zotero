var { Subprocess } = ChromeUtils.import("resource://gre/modules/Subprocess.jsm");
var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

/**
 * Run a JavaScript function with osascript (JXA), giving it access to an Objective-C bridge.
 *
 * @param {Function} fn The function. The function will be called with the
 * 		arguments passed in args, but it won't have access to closures or any
 * 		Zotero objects/APIs.
 *
 * 		Your function should return something that can be JSON-serialized.
 *
 * 		For more information on JXA and its capabilities, see:
 * 		https://developer.apple.com/library/archive/releasenotes/InterapplicationCommunication/RN-JavaScriptForAutomation/Articles/OSX10-10.html
 * @param args The arguments to pass to fn. ArrayBuffer and TypedArray (Uint8Array, etc.)
 * 		arguments will be serialized as bytes over stdin; all other arguments are
 * 		JSON-serialized.
 * @returns {Promise<any>}
 */
export async function runJXA(fn, ...args) {
	let toWrite = [];
	let argsString = args.map((arg) => {
		if (typeof arg === 'object' && (arg.constructor.name === 'ArrayBuffer' || 'BYTES_PER_ELEMENT' in arg.constructor)) {
			toWrite.push(arg);
			return `READ_STDIN(${arg.byteLength})`;
		}
		return JSON.stringify(arg);
	}).join(', ');

	let sourceCodeWrapped = `
		// Please don't pass nil into a call-by-reference argument or it won't be nil anymore
		const nil = $();
		
		let fn = ${fn.toString()};
		let json;
		try {
			const READ_STDIN = (numBytes) => {
				let stdin = $.NSFileHandle.fileHandleWithStandardInput;
				return stdin.readDataOfLength(numBytes);
			};
			json = fn(${argsString});
		}
		catch (e) {
			json = { __jxa_error: e.message };
		}
		JSON.stringify(json)
	`;
	
	let proc = await Subprocess.call({
		command: '/usr/bin/osascript',
		arguments: [
			'-l',
			'JavaScript',
			'-e',
			sourceCodeWrapped,
		]
	});
	for (let arg of toWrite) {
		await proc.stdin.write(arg);
	}
	await proc.stdin.close();

	let result = '';
	let str;
	while ((str = await proc.stdout.readString())) {
		result += str;
	}
	
	// Remove the final trailing newline added by osascript
	result = result.replace(/\n$/, '');
	let newlineIndex;
	while ((newlineIndex = result.indexOf('\n')) !== -1) {
		let logOutput = result.substring(0, newlineIndex);
		Zotero.debug(logOutput);
		result = result.substring(newlineIndex);
	}
	
	let json = JSON.parse(result);
	if (typeof json === 'object' && '__jxa_error' in json) {
		throw new Error(json.__jxa_error);
	}
	return json;
}
