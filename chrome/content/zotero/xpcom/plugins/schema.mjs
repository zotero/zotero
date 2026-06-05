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
	data: {
		Zotero: {
			Items: {
				// Read
				get: true,
				getAsync: true,
				getByLibraryAndKey: true,
				getTopLevel: "FromScopeCallable",
				keepTopLevel: "FromScopeCallable",
				// Write
				trash: true,
				trashTx: true,
			},
			Libraries: {
				// Read
				get: true,
				getAll: true,
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
				// Read
				getByLibrary: true,
				getByParent: true,
				getCollectionsContainingItems: true,
				// Write
				registerChildCollection: true,
				unregisterChildCollection: true,
				registerChildItem: true,
				unregisterChildItem: true,
			},
			Groups: {
				// Read
				get: true,
				getAll: true,
				getByLibraryID: true,
				getGroupIDFromLibraryID: true,
				getLibraryIDFromGroupID: true,
				exists: true,
			},
			Tags: {
				// Read
				getName: true,
				getID: true,
				getAll: true,
				getAllWithin: true,
				getColor: true,
				getColorByPosition: true,
				getColors: true,
				// Write
				rename: true,
				removeFromLibrary: true,
				setColor: true,
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
			// Constructors
			Item: "Constructor",
			Collection: "Constructor",
			Search: "Constructor",
			Duplicates: "Constructor",
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
	},
	network: {
		Zotero: {
			HTTP: {
				request: "FromScopeCallable",
				processDocuments: "FromScopeCallable",
			},
		},
	},
	preferences: {
		Zotero: {
			Prefs: {
				registerObserver: "FromScopeCallable",
				unregisterObserver: true,
				get: true,
				set: true,
				clear: true,
				resetBranch: true,
			},
		},
	},
	translator: {
		Zotero: {
			Translators: {
				getAll: true,
			},
			Translate: {
				Import: "Constructor",
				Search: "Constructor",
				Web: "Constructor",
			},
		},
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
	openWindow: {
		// The openWindow permission gates the openWindow() global function.
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
			// Read-only state
			loaded: true,
			// Selection queries
			getSelectedLibraryID: true,
			getSelectedCollection: true,
			getSelectedSavedSearch: true,
			getSelectedGroup: true,
			getSelectedItems: true,
			getSortedItems: true,
			getSortField: true,
			getSortDirection: true,
			// Permission checks
			canEdit: true,
			canEditLibrary: true,
			canEditFiles: true,
			// Navigation
			selectItem: true,
			selectItems: true,
			// Virtual collections
			setVirtual: true,
			// UI actions
			toggleItemPane: true,
			toggleTagSelector: true,
			clearQuicksearch: true,
			// Creation
			newItem: true,
			newCollection: true,
			newNote: true,
			newChildNote: true,
		},
	},
};

export { PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS };
