/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2025 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 http://zotero.org
	
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

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

/**
 * Prompt the user to import dropped files when all items are supported by available import translators.
 * @async
 * @param {Window} window
 * @param {Array<File|string>} data - Dropped files, tested for translatability.
 * @param {Object} [importOptions={}] - Options to pass to `Zotero_File_Interface.importFile`.
 * @returns {Promise<boolean>} Resolves to true if dropped files are handled (imported or cancelled), false if they should be added as attachments.
 */
export async function promptToImport(window, data, importOptions = {}) {
	// Check extensions of the dropped files to see if all files can be imported using translators
	// NOTE: this adds some noticable lag if translators haven't been detected yet
	let translation = new Zotero.Translate.Import();
	let translators = await translation.getTranslators();
	let translatorsExtensions = new Set(translators.map(translator => translator.target));

	const canAllBeTranslated = !data.some((file) => {
		// check for any file that is either a string or not a file that can be translated.
		// Only if none is found we can assume that all files can be translated and show the prompt dialog.
		return (typeof file === 'string') || !translatorsExtensions.has(Zotero.File.getExtension(file));
	});

	if (canAllBeTranslated) {
		let [title, text, button0, button1, button2] = await window.document.l10n.formatValues([
			{ id: 'import-dropped-files-dialog-title', args: { count: data.length } },
			{ id: 'import-dropped-files-dialog-description', args: { count: data.length } },
			'import-dropped-files-dialog-confirm',
			{ id: 'import-dropped-files-dialog-reject', args: { count: data.length } },
			'general-cancel'
		]);

		const promptResult = Zotero.Prompt.confirm({ window, title, text, button0, button1, button2 });

		if (promptResult === 0) {
			// user asked to import the files
			let mainWindow = Zotero.getMainWindow();
			for (let file of data) {
				try {
					mainWindow.Zotero_File_Interface.importFile({
						file,
						createNewCollection: false,
						...importOptions
					});
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
			return true;
		}
		else if (promptResult === 2) {
			// user cancelled the operation
			return true;
		}
	}
	// either prompt not applicable or user chose to add as attachments
	return false;
}
