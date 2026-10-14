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
	tab: ["window"],
	ui: [
		"itemTree",
		"itemPane",
		"menu",
		"button",
		"shortcut",
		"windowResource",
		"reader",
		"preferencePane",
		"userPrompt",
		"window",
		"tab",
	],
};

const PERMISSION_SCHEMAS = {
	// Zotero.HTTP is set up for every scope by setupHTTP() in globals.mjs, using the
	// sandbox's XMLHttpRequest so requests stay bounded by host_permissions.
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
			// Locks
			initializationPromise: true,
			uiReadyPromise: true,
			unlockPromise: true,
			startupSyncPromise: true,
			// Utilities
			Utilities: {
				cleanDOI: true,
				sentenceCase: true,
				capitalizeName: true,
				randomString: true,
				Internal: {
					// md5 and sha1 hash strings; md5Async hashes a file by path, which is the file store's digest
					md5: true,
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
			// Library data is read as snapshots and changed through change sets; live data objects never
			// cross. ChangeSet is added per sandbox by setupDataStore() in globals.mjs
			DataStore: {
				query: "CustomParserCallable",
				errorCodes: true,
				objectTypes: true,
				operationNames: true,
			},
			Notifier: {
				registerObserver: "FromScopeCallable",
				unregisterObserver: true,
			},
		},
	},
	dataWrite: {
		Zotero: {
			DataStore: {
				commit: "CustomParserCallable",
			},
		},
	},
	clipboardRead: {
		Zotero: {
			ClipboardController: {
				query: "CustomParserCallable",
				errorCodes: true,
			},
		},
	},
	clipboardWrite: {
		Zotero: {
			ClipboardController: {
				command: "CustomParserCallable",
				errorCodes: true,
			},
		},
	},
	fileSystemRead: {
		Zotero: {
			// Files are read as snapshots and changed through change sets, each path gated by PluginFileAccess.
			// ChangeSet, path and withSession are added per sandbox by setupFileStore() in globals.mjs
			FileStore: {
				query: "CustomParserCallable",
				errorCodes: true,
				objectTypes: true,
				operationNames: true,
			},
		},
	},
	fileSystemWrite: {
		Zotero: {
			FileStore: {
				commit: "CustomParserCallable",
			},
		},
	},
	// FilePicker is set up by setupFilePicker() with fileSystemRead or fileSystemWrite
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
	shortcut: {
		Zotero: {
			ShortcutManager: {
				registerShortcut: "CustomParserCallable",
				unregisterShortcut: "CustomParserCallable",
				checkShortcut: "FromScopeCallable",
				rejectReasons: true,
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
				statusCodes: true,
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
				register: "CustomParserCallable",
				unregister: "CustomParserCallable",
			}
		},
	},
	userPrompt: {
		Zotero: {
			ProgressWindow: "Constructor",
			Prompt: true,
			alert: true,
			// These hand the user's attention to another application, so they are not in the default
			launchURL: true,
			File: {
				reveal: true,
			},
		},
	},
	window: {
		Zotero: {
			WindowController: {
				query: "CustomParserCallable",
				command: "CustomParserCallable",
				windowTypes: true,
				errorCodes: true,
			},
		},
	},
	tab: {
		Zotero: {
			TabController: {
				query: "CustomParserCallable",
				command: "CustomParserCallable",
				tabTypes: true,
				errorCodes: true,
			},
		},
	},
};

export { SchemaKey, IMPLIED_PERMISSIONS, PERMISSION_SCHEMAS };
