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
			// Locks
			initializationPromise: true,
			uiReadyPromise: true,
			unlockPromise: true,
			startupSyncPromise: true,
			// Data access
			Items: {
				// Read
				get: true,
				getAsync: true,
				getByLibraryAndKey: true,
				getTopLevel: true,
				keepTopLevel: true,
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
				create: true,
				getAll: true,
				getAllWithin: true,
				getTagItems: true,
				search: true,
				getColor: true,
				getColorByPosition: true,
				getColors: true,
				// Write
				rename: true,
				removeFromLibrary: true,
				purge: true,
				setColor: true,
			},
			// I/O
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
				getCharsetFromFile: true,
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
			// Network
			HTTP: {
				request: "FromScopeCallable",
			},
			Notifier: {
				registerObserver: "FromScopeCallable",
				unregisterObserver: true,
			},
			Prefs: {
				registerObserver: "FromScopeCallable",
				unregisterObserver: true,
				get: true,
				set: true,
				clear: true,
				resetBranch: true,
			},
			// UI APIs
			ItemTreeManager: true,
			ItemPaneManager: true,
			MenuManager: true,
			// Windows: getMainWindow are created separately to wrap the returned window
			getMainWindow: "WindowScopeCallable",
			getMainWindows: "WindowScopeCallable",
		},
	}
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
	default: {
		// TODO: Use permissions to determine which of these to expose
		Zotero_Tabs: true,
	}
};

export { PERMISSION_SCHEMAS, WINDOW_SCHEMAS, MAIN_WINDOW_SCHEMAS };
