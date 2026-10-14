/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2026 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://www.zotero.org
	
	This file is part of Zotero.
	
	Zotero is free software: you can redistribute it and/or modify
	it under the terms of the GNU Affero General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	Zotero is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU Affero General Public License for more details.
	
	You should have received a copy of the GNU Affero General Public License
	along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
	
	***** END LICENSE BLOCK *****
*/


const SchemaKey = Object.freeze({
	WILDCARD: Symbol("plugin.schema.wildcard"),
	HANDLER: Symbol("plugin.schema.handler"),
	SCHEMA: Symbol("plugin.schema.schema"),
	RECURSIVE: Symbol("plugin.schema.recursive"),
	REQUIRE: Symbol("plugin.schema.require"),
});

const IMPLIED_PERMISSIONS = {
	dataWrite: ["dataRead"],
	fileSystemWrite: ["fileSystemRead"],
	ui: [
		"itemTree",
		"itemPane",
		"menu",
		"button",
		"windowResource",
		"reader",
		"preferencePane",
		"userPrompt",
		"openWindow",
	],
};

const DATA_OBJECT_SCHEMA = {
	[SchemaKey.WILDCARD]: true,
	[SchemaKey.RECURSIVE]: true,

	// DataObject
	save: { [SchemaKey.REQUIRE]: "dataWrite" },
	saveTx: { [SchemaKey.REQUIRE]: "dataWrite" },
	erase: { [SchemaKey.REQUIRE]: "dataWrite" },
	eraseTx: { [SchemaKey.REQUIRE]: "dataWrite" },
	trash: { [SchemaKey.REQUIRE]: "dataWrite" },
	trashTx: { [SchemaKey.REQUIRE]: "dataWrite" },
	moveToLibrary: { [SchemaKey.REQUIRE]: "dataWrite" },
	setAttachmentLastPageIndex: { [SchemaKey.REQUIRE]: "dataWrite" },
	setAttachmentLastReadAloudPosition: { [SchemaKey.REQUIRE]: "dataWrite" },
	addLinkedItem: { [SchemaKey.REQUIRE]: "dataWrite" },
	addLinkedCollection: { [SchemaKey.REQUIRE]: "dataWrite" },
	// Collection
	addItem: { [SchemaKey.REQUIRE]: "dataWrite" },
	addItems: { [SchemaKey.REQUIRE]: "dataWrite" },
	removeItem: { [SchemaKey.REQUIRE]: "dataWrite" },
	removeItems: { [SchemaKey.REQUIRE]: "dataWrite" },
	// Search
	addCondition: { [SchemaKey.REQUIRE]: "dataWrite" },
	removeCondition: { [SchemaKey.REQUIRE]: "dataWrite" },
	// Feed
	updateFeed: { [SchemaKey.REQUIRE]: "dataWrite" },
	clearExpiredItems: { [SchemaKey.REQUIRE]: "dataWrite" },
	storeSyncedSettings: { [SchemaKey.REQUIRE]: "dataWrite" },

	// File access
	deleteAttachmentFile: { [SchemaKey.REQUIRE]: ["dataWrite", "fileSystemWrite"] },
	renameAttachmentFile: { [SchemaKey.REQUIRE]: ["dataWrite", "fileSystemWrite"] },
	relinkAttachmentFile: { [SchemaKey.REQUIRE]: ["dataWrite", "fileSystemWrite"] },

	ObjectsClass: false,
	ContainerObjectsClass: false,
};

const PERMISSION_SCHEMAS = {
	default: {
		Zotero: {
			// Logging
			debug: true,
			warn: true,
			logError: true,
			// General
			version: true,
			isBetaBuild: true,
			isDevBuild: true,
			isSourceBuild: true,
			platformVersion: true,
			platformMajorVersion: true,
			arch: true,
			isMac: true,
			isWin: true,
			isLinux: true,
			locale: true,
			// Actions
			launchURL: true,
			// Locks
			initializationPromise: true,
			uiReadyPromise: true,
			unlockPromise: true,
			startupSyncPromise: true,
			// Window access (also available via onMainWindowLoad hook)
			getMainWindow: "WindowScopeCallable",
			getMainWindows: "WindowScopeCallable",
			// Utilities
			Utilities: {
				cleanDOI: true,
				sentenceCase: true,
				capitalizeName: true,
				randomString: true,
				Internal: {
					md5: true,
					md5Async: true,
					sha1: true,
					decodeUTF8: true,
					byteLength: true,
					extractExtraFields: true,
				}
			},
			File: {
				getExtension: true,
				normalizeToUnix: true,
				directoryContains: true,
				truncateFileName: true,
				reveal: true,
			},
			Date: {
				strToISO: true,
			},
			// Only expose the added utility methods as sandbox has native Promise.
			Promise: {
				method: true,
				defer: true,
				delay: true,
			},
		},
	},

	dataRead: {
		Zotero: {
			Items: {
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getAsync: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getByLibraryAndKey: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getTopLevel: { [SchemaKey.HANDLER]: "FromScopeCallable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				keepTopLevel: { [SchemaKey.HANDLER]: "FromScopeCallable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			},
			Libraries: {
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getAll: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				userLibraryID: true,
				getName: true,
				getType: true,
				getLastSyncTime: true,
				getVersion: true,
				hasTrash: true,
				isEditable: true,
				isFilesEditable: true,
				isGroupLibrary: true,
				exists: true,
			},
			Collections: {
				getByLibrary: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getByParent: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getCollectionsContainingItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			},
			Groups: {
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getAll: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getByLibraryID: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
				getGroupIDFromLibraryID: true,
				getLibraryIDFromGroupID: true,
				exists: true,
			},
			Tags: {
				getName: true,
				getID: true,
				getAll: true,
				getAllWithin: true,
				getColor: true,
				getColorByPosition: true,
				getColors: true,
			},
			ItemFields: {
				getAll: true,
				getID: true,
				isValidForType: true,
				getName: true,
				getLocalizedString: true,
			},
			ItemTypes: {
				getID: true,
				getLocalizedString: true,
			},
			CreatorTypes: {
				getLocalizedString: true,
			},
			Fulltext: {
				getPages: true,
			},
			Notifier: {
				registerObserver: "FromScopeCallable",
				unregisterObserver: true,
			},
			Translators: {
				getAll: true,
			},
			Item: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			Collection: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			Search: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			Duplicates: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			Feed: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
		},
	},
	dataWrite: {
		Zotero: {
			Items: {
				trash: true,
				trashTx: true,
			},
			Collections: {
				registerChildCollection: true,
				unregisterChildCollection: true,
				registerChildItem: true,
				unregisterChildItem: true,
			},
			Tags: {
				rename: true,
				removeFromLibrary: true,
				setColor: true,
			},
			Translate: {
				Import: "Constructor",
				Search: "Constructor",
				Web: "Constructor",
			},
			DB: {
				executeTransaction: true,
			},
		},
	},
	database: {
		// Exposes a Zotero.DBConnection instance with a restricted schema defined by PLUGIN_DB_SCHEMA.
		// Set up directly by setupPluginDB() in globals.mjs.
	},
	clipboardRead: {
		Zotero: {
			Utilities: {
				Internal: {
					getClipboard: true,
				}
			},
		},
	},
	clipboardWrite: {
		Zotero: {
			Utilities: {
				Internal: {
					copyTextToClipboard: true,
					copyToClipboard: true,
				}
			},
		},
	},
	fileSystemRead: {
		Zotero: {
			File: {
				getBinaryContentsAsync: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0] } },
				getContentsAsync: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0] } },
				// getContentsFromURLAsync is injected by setupFile() for network access control
				directoryIsEmpty: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0] } },
				generateDataURI: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0] } },
				iterateDirectory: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0] } },
				// withAccessSession, requestFileAccess, getPluginDir are
				// injected directly onto the File mirror by setupFile().
			},
		},
	},
	fileSystemWrite: {
		Zotero: {
			File: {
				putContentsAsync: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0] } },
				// download is injected by setupFile() for network access control
				rename: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0] } },
				removeIfExists: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0] } },
				moveDirectory: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0, 1] } },
				setNormalFilePermissions: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0] } },
				moveToUnique: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0, 1] } },
				copyToUnique: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0], write: [1] } },
				copyDirectory: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0], write: [1] } },
				createDirectoryIfMissingAsync: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { write: [0] } },
				zipDirectory: { [SchemaKey.HANDLER]: "FileAccessCallable", [SchemaKey.SCHEMA]: { read: [0], write: [1] } },
			},
		},
	},
	// FilePicker is set up by setupFilePicker() with fileSystemRead or fileSystemWrite
	network: {
		// Zotero.HTTP is set up directly by setupHTTP() in globals.mjs
		// using the sandbox's XMLHttpRequest for principal-based access control.
	},
	preferences: {
		// Zotero.Prefs is set up directly by setupPreferences() in globals.mjs.
		// By default, plugin can access the prefixed `extensions.<GUID>` branch.
		// For other branches, access is gated by the pref_permissions declared in the manifest.
	},
	itemTree: {
		Zotero: {
			ItemTreeManager: {
				registerColumn: "CustomParserCallable",
				unregisterColumn: "CustomParserCallable",
				refreshColumns: true,
			},
		},
	},
	ui: {
		// An umbrella permission for all UI-related APIs. See IMPLIED_PERMISSIONS.
	},
	itemPane: {
		Zotero: {
			ItemPaneManager: {
				registerSection: "CustomParserCallable",
				unregisterSection: "CustomParserCallable",
				registerInfoRow: "CustomParserCallable",
				unregisterInfoRow: "CustomParserCallable",
				refreshInfoRow: true,
			},
		},
	},
	menu: {
		Zotero: {
			MenuManager: {
				registerMenu: "CustomParserCallable",
				unregisterMenu: "CustomParserCallable",
			},
		},
	},
	button: {
		Zotero: {
			ButtonManager: {
				registerButton: "CustomParserCallable",
				unregisterButton: "CustomParserCallable",
			},
		},
	},
	windowResource: {
		Zotero: {
			WindowResourceManager: {
				registerResource: "CustomParserCallable",
				unregisterResource: "CustomParserCallable",
			},
		},
	},
	pluginInterop: {
		Zotero: {
			PluginInteropManager: {
				register: "CustomParserCallable",
				unregister: "CustomParserCallable",
				getCommand: "CustomParserCallable",
			},
		},
	},
	serverEndpoint: {
		Zotero: {
			ServerEndpointManager: {
				registerEndpoint: "CustomParserCallable",
				unregisterEndpoint: "CustomParserCallable",
				getEndpointURL: true,
			},
		},
	},
	reader: {
		Zotero: {
			ReaderManager: {
				registerSection: "CustomParserCallable",
				unregisterSection: "CustomParserCallable",
				registerContextMenuItem: "CustomParserCallable",
				unregisterContextMenuItem: "CustomParserCallable",
			},
		},
	},
	preferencePane: {
		Zotero: {
			PreferencePanes: {
				register: true,
				unregister: true,
			}
		},
	},
	userPrompt: {
		Zotero: {
			ProgressWindow: "Constructor",
			Prompt: true,
			alert: true,
		},
	},
	openWindow: {
		// Set up directly by setupOpenWindow() in globals.mjs
	},
};

const WINDOW_SCHEMAS = {
	default: {
		alert: true,
		confirm: true,
		prompt: true,
		getComputedStyle: true,
		matchMedia: true,
		MozXULElement: {
			insertFTLIfNeeded: true,
		}
		// `document` is dynamically created by WindowScopeVariables.createSafeDocument and thus not included here
	}
};

const MAIN_WINDOW_SCHEMAS = {
	default: {},
	mainWindow: {
		Zotero_Tabs: {
			// Read-only state
			selectedID: true,
			selectedType: true,
			selectedIndex: true,
			numTabs: true,
			// Query methods
			getTabIDByItemID: true,
			getTabInfo: true,
			hasContextPane: true,
			hasNoteContext: true,
			parseTabType: true,
			// Tab navigation
			select: true,
			selectPrev: true,
			selectNext: true,
			selectLast: true,
			// Tab management
			close: true,
			rename: true,
		},
		ZoteroContextPane: {
			// Read-only state
			collapsed: true,
			// Context pane inner
			context: {
				mode: true,
			},
			// Actions
			togglePane: true,
			focus: true,
		},
		ZoteroPane: {
			loaded: true,
			getSortField: true,
			getSortDirection: true,
			toggleItemPane: true,
			toggleTagSelector: true,
			clearQuicksearch: true,
		},
	},
	"mainWindow,dataRead": {
		ZoteroPane: {
			getSelectedLibraryIDs: true,
			getSelectedCollections: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			getSelectedSavedSearches: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			getSelectedItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			getSortedItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			canEdit: true,
			canEditLibrary: true,
			canEditFiles: true,
			selectItem: true,
			selectItems: true,
			setVirtual: true,
		},
	},
	"mainWindow,dataWrite": {
		ZoteroPane: {
			// newItem resolves to an Item
			newItem: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_SCHEMA },
			newCollection: true,
			newNote: true,
			newChildNote: true,
		},
	},
};

/**
 * Allowlist schema for DBConnection instances created by plugins.
 */
const PLUGIN_DB_SCHEMA = {
	queryAsync: true,
	queryTx: true,
	executeTransaction: true,
	valueQueryAsync: true,
	rowQueryAsync: true,
	columnQueryAsync: true,
	tableExists: true,
	columnExists: true,
	indexExists: true,
	getColumns: true,
	closeDatabase: true,
	inTransaction: true,
	parseSQLFile: true,
	executeSQLFile: true,
	path: true,
};

export { SchemaKey, DATA_OBJECT_SCHEMA, PLUGIN_DB_SCHEMA, IMPLIED_PERMISSIONS, PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS };
