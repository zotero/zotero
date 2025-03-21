import { setTimeout } from "resource://gre/modules/Timer.sys.mjs";

/**
 * @param {Document} document
 * @param {number | false} [allowInteractiveAfter] Delay (in milliseconds) before resolving on 'interactive'.
 * 		If false, documentIsReady() won't resolve until 'complete'.
 * @returns {Promise<void>}
 */
export async function documentIsReady(document, { allowInteractiveAfter = false } = {}) {
	// Adapted from Mozilla's ScreenshotsComponentChild.jsm
	
	function readyEnough(readyState) {
		if (readyState === "interactive" && allowInteractiveAfter !== false) {
			return allowInteractiveAfter > 0
				? new Promise(resolve => setTimeout(() => resolve(true), allowInteractiveAfter))
				: true;
		}
		return readyState === "complete";
	}

	let contentWindow = document.defaultView;

	if (await readyEnough(document.readyState)) {
		return Promise.resolve();
	}
	return new Promise((resolve, reject) => {
		async function onChange(event) {
			if (event.type === "pagehide") {
				document.removeEventListener("readystatechange", onChange);
				contentWindow.removeEventListener("pagehide", onChange);
				reject(new Error("document unloaded before it was ready"));
			}
			else if (await readyEnough(document.readyState)) {
				document.removeEventListener("readystatechange", onChange);
				contentWindow.removeEventListener("pagehide", onChange);
				resolve();
			}
		}
		document.addEventListener("readystatechange", onChange);
		contentWindow.addEventListener("pagehide", onChange, { once: true });
	});
}
