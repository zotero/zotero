/* global Zotero, Services */
function startup({ rootURI }) {
	// Load a script from this XPI into the plugin scope
	Services.scriptloader.loadSubScript(rootURI + 'main.js');
	Zotero.PluginLoadingTest = pluginLoadingTestMain();
}

function shutdown() {
	delete Zotero.PluginLoadingTest;
}

function install() {}

function uninstall() {}
