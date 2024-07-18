var EXPORTED_SYMBOLS = [];

// Register Mozilla actors
ChromeUtils.importESModule("resource://gre/modules/ActorManagerParent.sys.mjs");

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
	},
	allFrames: true
});

ChromeUtils.registerWindowActor("ExternalLinkHandler", {
	parent: {
		moduleURI: "chrome://zotero/content/actors/ExternalLinkHandlerParent.jsm",
	},
	child: {
		moduleURI: "chrome://zotero/content/actors/ExternalLinkHandlerChild.jsm",
		events: {
			click: {},
		}
	},
	messageManagerGroups: ["feedAbstract", "basicViewer"]
});

