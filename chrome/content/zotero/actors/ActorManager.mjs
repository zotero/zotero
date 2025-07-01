// Register Mozilla actors
import "resource://gre/modules/ActorManagerParent.sys.mjs";

ChromeUtils.registerWindowActor("PageData", {
	child: {
		esModuleURI: "chrome://zotero/content/actors/PageDataChild.mjs"
	}
});

ChromeUtils.registerWindowActor("SingleFile", {
	child: {
		esModuleURI: "chrome://zotero/content/actors/SingleFileChild.mjs"
	}
});

ChromeUtils.registerWindowActor("Translation", {
	parent: {
		esModuleURI: "chrome://zotero/content/actors/TranslationParent.mjs"
	},
	child: {
		esModuleURI: "chrome://zotero/content/actors/TranslationChild.mjs"
	}
});

ChromeUtils.registerWindowActor("FeedAbstract", {
	parent: {
		esModuleURI: "chrome://zotero/content/actors/FeedAbstractParent.mjs",
	},
	child: {
		esModuleURI: "chrome://zotero/content/actors/FeedAbstractChild.mjs",
		events: {
			DOMDocElementInserted: {},
		}
	},
	messageManagerGroups: ["feedAbstract"]
});

ChromeUtils.registerWindowActor("ZoteroPrint", {
	parent: {
		esModuleURI: "chrome://zotero/content/actors/ZoteroPrintParent.mjs"
	},
	child: {
		esModuleURI: "chrome://zotero/content/actors/ZoteroPrintChild.mjs",
		events: {
			pageshow: {}
		}
	},
	allFrames: true
});

ChromeUtils.registerWindowActor("ExternalLinkHandler", {
	parent: {
		esModuleURI: "chrome://zotero/content/actors/ExternalLinkHandlerParent.mjs",
	},
	child: {
		esModuleURI: "chrome://zotero/content/actors/ExternalLinkHandlerChild.mjs",
		events: {
			click: {},
		}
	},
	messageManagerGroups: ["feedAbstract", "basicViewer"]
});

// On macOS only, register the Ctrl-Enter handler actor
// (No access to Zotero object here)
if (AppConstants.platform === "macosx") {
	ChromeUtils.registerWindowActor("SequoiaContextMenu", {
		parent: {
			esModuleURI: "chrome://zotero/content/actors/SequoiaContextMenuParent.mjs",
		},
		child: {
			esModuleURI: "chrome://zotero/content/actors/SequoiaContextMenuChild.mjs",
		},
		allFrames: true,
		includeChrome: true
	});
}

ChromeUtils.registerWindowActor("MendeleyAuth", {
	parent: {
		esModuleURI: "chrome://zotero/content/actors/MendeleyAuthParent.mjs"
	},
	child: {
		esModuleURI: "chrome://zotero/content/actors/MendeleyAuthChild.mjs"
	}
});

ChromeUtils.registerWindowActor("DocumentIsReady", {
	child: {
		esModuleURI: "chrome://zotero/content/actors/DocumentIsReadyChild.mjs"
	}
});
