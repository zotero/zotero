/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2020 Corporation for Digital Scholarship
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

Zotero.SingleFile = {
	// These are defaults from SingleFile
	// Located in: zotero/resources/SingleFile/extension/core/bg/config.js
	CONFIG: {
		removeHiddenElements: true,
		removeUnusedStyles: true,
		removeUnusedFonts: true,
		removeFrames: true,
		removeImports: true,
		removeScripts: true,
		compressHTML: true,
		compressCSS: false,
		loadDeferredImages: true,
		loadDeferredImagesMaxIdleTime: 1500,
		loadDeferredImagesBlockCookies: false,
		loadDeferredImagesBlockStorage: false,
		loadDeferredImagesKeepZoomLevel: false,
		filenameTemplate: "{page-title} ({date-iso} {time-locale}).html",
		infobarTemplate: "",
		includeInfobar: false,
		confirmInfobarContent: false,
		autoClose: false,
		confirmFilename: false,
		filenameConflictAction: "uniquify",
		filenameMaxLength: 192,
		filenameReplacedCharacters: ["~", "+", "\\\\", "?", "%", "*", ":", "|", "\"", "<", ">", "\x00-\x1f", "\x7F"],
		filenameReplacementCharacter: "_",
		contextMenuEnabled: true,
		tabMenuEnabled: true,
		browserActionMenuEnabled: true,
		shadowEnabled: true,
		logsEnabled: true,
		progressBarEnabled: true,
		maxResourceSizeEnabled: false,
		maxResourceSize: 10,
		removeAudioSrc: true,
		removeVideoSrc: true,
		displayInfobar: true,
		displayStats: false,
		backgroundSave: true,
		autoSaveDelay: 1,
		autoSaveLoad: false,
		autoSaveUnload: false,
		autoSaveLoadOrUnload: true,
		autoSaveDiscard: false,
		autoSaveRemove: false,
		autoSaveRepeat: false,
		autoSaveRepeatDelay: 10,
		removeAlternativeFonts: true,
		removeAlternativeMedias: true,
		removeAlternativeImages: true,
		groupDuplicateImages: true,
		saveRawPage: false,
		saveToClipboard: false,
		addProof: false,
		forceWebAuthFlow: false,
		extractAuthCode: true,
		resolveFragmentIdentifierURLs: false,
		userScriptEnabled: true,
		saveCreatedBookmarks: false,
		allowedBookmarkFolders: [],
		ignoredBookmarkFolders: [],
		replaceBookmarkURL: true,
		saveFavicon: true,
		includeBOM: false,
		warnUnsavedPage: true,
		insertMetaNoIndex: false,
		insertMetaCSP: true,
		passReferrerOnError: false,
		insertSingleFileComment: true,
		blockMixedContent: false,
	}
};
