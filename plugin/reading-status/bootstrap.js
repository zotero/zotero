/* global Zotero, ChromeUtils */

let lifecycle = null;

async function startup({ id, version, rootURI }, reason) {
	lifecycle = ChromeUtils.importESModule(rootURI + 'content/main.mjs');
	await lifecycle.startup({ id, version, rootURI, reason });
}

async function onMainWindowLoad({ window }, reason) {
	if (lifecycle) {
		await lifecycle.onMainWindowLoad({ window, reason });
	}
}

async function onMainWindowUnload({ window }, reason) {
	if (lifecycle) {
		await lifecycle.onMainWindowUnload({ window, reason });
	}
}

async function shutdown(_params, reason) {
	if (lifecycle) {
		await lifecycle.shutdown({ reason });
		lifecycle = null;
	}
}

function install() {}
function uninstall() {}
