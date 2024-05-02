var EXPORTED_SYMBOLS = [];

ChromeUtils.registerWindowActor("PageData", {
	child: {
		moduleURI: "chrome://zotero/content/actors/PageDataChild.jsm"
	}
});

ChromeUtils.registerWindowActor("SingleFile", {
	child: {
		moduleURI: "chrome://zotero/content/actors/SingleFileChild.jsm"
	}
});

ChromeUtils.registerWindowActor("Translation", {
	parent: {
		moduleURI: "chrome://zotero/content/actors/TranslationParent.jsm"
	},
	child: {
		moduleURI: "chrome://zotero/content/actors/TranslationChild.jsm"
	}
});

ChromeUtils.registerWindowActor("FeedAbstract", {
	parent: {
		moduleURI: "chrome://zotero/content/actors/FeedAbstractParent.jsm",
	},
	child: {
		moduleURI: "chrome://zotero/content/actors/FeedAbstractChild.jsm",
		events: {
			DOMDocElementInserted: {},
			click: {},
		}
	},
	messageManagerGroups: ["feedAbstract"]
});

ChromeUtils.registerWindowActor("ZoteroPrint", {
	parent: {
		moduleURI: "chrome://zotero/content/actors/ZoteroPrintParent.jsm"
	},
	child: {
		moduleURI: "chrome://zotero/content/actors/ZoteroPrintChild.jsm",
		events: {
			pageshow: {}
		}
	}
});

