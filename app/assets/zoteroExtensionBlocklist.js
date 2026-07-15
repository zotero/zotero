// Set via Blocklist.setExtensionBlocklistProvider()
var zoteroExtensionBlocklistProvider = null;

var ZoteroExtensionBlocklist = {
	_initialized: true,
	ensureInitialized() {},
	shutdown() {},
	undoShutdown() {},
	_onUpdate() {},
	async getEntry(addon) {
		if (zoteroExtensionBlocklistProvider) {
			try {
				return await zoteroExtensionBlocklistProvider.getEntry(addon);
			}
			catch (e) {
				console.error(e);
			}
		}
		// Without a provider, echo the addon's current state so that nothing changes before
		// Zotero has registered one (e.g., in the post-upgrade check at AddonManager startup)
		return addon.blocklistState
			&& addon.blocklistState != Ci.nsIBlocklistService.STATE_NOT_BLOCKED
			? { state: addon.blocklistState, url: addon.blocklistURL || null }
			: null;
	},
	async getState(addon) {
		let entry = await this.getEntry(addon);
		return entry ? entry.state : Ci.nsIBlocklistService.STATE_NOT_BLOCKED;
	},
};
Blocklist.ExtensionBlocklist = ZoteroExtensionBlocklist;
Blocklist.setExtensionBlocklistProvider = function (provider) {
	zoteroExtensionBlocklistProvider = provider;
};
