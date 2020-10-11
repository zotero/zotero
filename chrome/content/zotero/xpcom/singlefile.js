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
	// These are defaults from SingleFileZ
	// Located in: zotero/resources/SingleFileZ/extension/core/bg/config.js
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
		autoSaveRepeat: false,
		autoSaveRepeatDelay: 10,
		removeAlternativeFonts: true,
		removeAlternativeMedias: true,
		removeAlternativeImages: true,
		saveRawPage: false,
		saveToGDrive: false,
		forceWebAuthFlow: false,
		extractAuthCode: true,
		insertTextBody: true,
		resolveFragmentIdentifierURLs: false,
		userScriptEnabled: true,
		saveCreatedBookmarks: false,
		ignoredBookmarkFolders: [],
		replaceBookmarkURL: true,
		saveFavicon: true,
		includeBOM: false
	},

	runUserScripts: function () {
		let modifiedElements = [];
		window.dispatchEvent(new CustomEvent('single-filez-user-script-init'));

		window.addEventListener('single-filez-on-before-capture-request', () => {
			const elements = document.querySelectorAll("img[crossorigin], link[crossorigin]");
			elements.forEach((element) => {
				modifiedElements.push([element, element.getAttribute('crossorigin')]);
				element.removeAttribute('crossorigin');
			});
		});

		window.addEventListener('single-filez-on-after-capture-request', () => {
			modifiedElements.forEach(([element, attribute]) => {
				element.setAttribute('crossorigin', attribute);
			});
		});
	}
};
