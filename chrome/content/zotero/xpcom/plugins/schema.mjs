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
});

const IMPLIED_PERMISSIONS = {
	dataWrite: ["dataRead"],
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
					copyTextToClipboard: true,
					copyToClipboard: true,
					md5: true,
					md5Async: true,
					sha1: true,
					decodeUTF8: true,
					byteLength: true,
					extractExtraFields: true,
				}
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
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getAsync: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getByLibraryAndKey: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getTopLevel: { [SchemaKey.HANDLER]: "FromScopeCallable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				keepTopLevel: { [SchemaKey.HANDLER]: "FromScopeCallable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			},
			Libraries: {
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getAll: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
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
				getByLibrary: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getByParent: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getCollectionsContainingItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			},
			Groups: {
				get: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getAll: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
				getByLibraryID: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
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
			Item: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			Collection: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			Search: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			Duplicates: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			Feed: { [SchemaKey.HANDLER]: "Constructor", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
		},
	},
	dataWrite: {
		Zotero: {
			Items: {
				get: true,
				getAsync: true,
				getByLibraryAndKey: true,
				getTopLevel: "FromScopeCallable",
				keepTopLevel: "FromScopeCallable",
				trash: true,
				trashTx: true,
			},
			Libraries: {
				get: true,
				getAll: true,
			},
			Collections: {
				getByLibrary: true,
				getByParent: true,
				getCollectionsContainingItems: true,
				registerChildCollection: true,
				unregisterChildCollection: true,
				registerChildItem: true,
				unregisterChildItem: true,
			},
			Groups: {
				get: true,
				getAll: true,
				getByLibraryID: true,
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
			Item: "Constructor",
			Collection: "Constructor",
			Search: "Constructor",
			Duplicates: "Constructor",
			Feed: "Constructor",
		},
	},
	fileSystem: {
		Zotero: {
			Utilities: {
				Internal: {
					getClipboard: true,
				}
			},
			File: {
				// Read
				getExtension: true,
				getBinaryContentsAsync: true,
				getContentsAsync: true,
				getContentsFromURLAsync: true,
				directoryIsEmpty: true,
				generateDataURI: true,
				normalizeToUnix: true,
				directoryContains: true,
				truncateFileName: true,
				reveal: true,
				// Write
				putContentsAsync: true,
				download: true,
				rename: true,
				removeIfExists: true,
				iterateDirectory: true,
				moveDirectory: true,
				setNormalFilePermissions: true,
				moveToUnique: true,
				copyToUnique: true,
				copyDirectory: true,
				createDirectoryIfMissingAsync: true,
				zipDirectory: true,
			},
		},
		// FilePicker is set up directly by setupFilePicker() in globals.mjs
	},
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
			ItemTreeManager: true,
		},
	},
	itemPane: {
		Zotero: {
			ItemPaneManager: true,
		},
	},
	menu: {
		Zotero: {
			MenuManager: true,
		},
	},
	windowResource: {
		Zotero: {
			WindowResourceManager: true,
		},
	},
	pluginInterop: {
		Zotero: {
			PluginInteropManager: {
				OK: true,
				NOT_FOUND: true,
				VERSION_TOO_LOW: true,
				VERSION_TOO_HIGH: true,
				PERMISSION_DENIED: true,
				register: true,
				unregister: true,
				getCommand: "CustomParserCallable",
			},
		},
	},
	reader: {
		Zotero: {
			Reader: {
				registerEventListener: true,
				unregisterEventListener: true,
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
			getSelectedLibraryID: true,
			getSelectedCollection: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			getSelectedSavedSearch: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			getSelectedGroup: true,
			getSelectedItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
			getSortedItems: { [SchemaKey.HANDLER]: "Callable", [SchemaKey.SCHEMA]: DATA_OBJECT_READ_SCHEMA },
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
			getSelectedCollection: true,
			getSelectedSavedSearch: true,
			getSelectedItems: true,
			getSortedItems: true,
			newItem: true,
			newCollection: true,
			newNote: true,
			newChildNote: true,
		},
	},
};

const DATA_OBJECT_READ_SCHEMA = {
	[SchemaKey.WILDCARD]: true,
	[SchemaKey.RECURSIVE]: true,
	save: false,
	saveTx: false,
	erase: false,
	eraseTx: false,
	// Collection
	addItem: false,
	addItems: false,
	removeItem: false,
	removeItems: false,
	// Search
	addCondition: false,
	removeCondition: false,
	// Feed
	updateFeed: false,
	clearExpiredItems: false,
	storeSyncedSettings: false,
};

export { SchemaKey, DATA_OBJECT_READ_SCHEMA, IMPLIED_PERMISSIONS, PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS };
