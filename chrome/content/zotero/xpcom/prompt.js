/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

Zotero.Prompt = {
	BUTTON_TITLE_OK: Services.prompt.BUTTON_TITLE_OK,
	BUTTON_TITLE_CANCEL: Services.prompt.BUTTON_TITLE_CANCEL,
	BUTTON_TITLE_YES: Services.prompt.BUTTON_TITLE_YES,
	BUTTON_TITLE_NO: Services.prompt.BUTTON_TITLE_NO,
	BUTTON_TITLE_SAVE: Services.prompt.BUTTON_TITLE_SAVE,
	BUTTON_TITLE_DONT_SAVE: Services.prompt.BUTTON_TITLE_DONT_SAVE,
	BUTTON_TITLE_REVERT: Services.prompt.BUTTON_TITLE_REVERT,
	
	/**
	 * A wrapper around XPCOM's Services.prompt.confirmEx()
	 * but with a friendlier interface.
	 *
	 * Button text can use special static variables from
	 * Zotero.Prompt
	 *
	 * @param options
	 * - {mozIDOMWindowProxy} window - The parent window or null.
	 * - {String} title - Text to appear in the title of the dialog.
	 * - {String} text - Text to appear in the body of the dialog.
	 * - {String|Number} button0 - Button 0 text
	 * - {String|Number} button1 - Button 1 text
	 * - {String|Number} button2 - Button 2 text
	 * - {String} checkLabel - Text to appear with the checkbox.
	 * - {Object} checkbox - Contains the initial checked state of the
	 *        checkbox when this method is called and the final checked
	 *        state after this method returns. Either {} or  { value: true/false }.
	 * - {Number} defaultButton - The index of default button. 0 by default
	 * - {Boolean} buttonDelay - Make the buttons initially disabled and enable them after some period
	 *        so that the user doesn't click through the dialog without reading it.
	 * @returns {Number} The index of the button pressed.
	 */
	confirm(options = {}) {
		let { window: win, title, text, button0, button1, button2, checkLabel, checkbox, defaultButton, buttonDelay, delayButtons } = options;
		if (!win) win = null;
		if (!title) throw new Error('`title` is required');
		if (!text) throw new Error('`text` is required');
		if (!button0 && !button1 && !button2) {
			throw new Error('At least one button is required');
		}
		if (checkLabel && (!checkbox || typeof checkbox != 'object')) {
			throw new Error('`checkLabel` provided without `checkbox` option');
		}
		// Skip button delay in CI
		if (delayButtons) {
			Zotero.warn("Zotero.Prompt.confirm() option 'delayButtons' is deprecated -- use 'buttonDelay'");
			buttonDelay = true;
		}
		let flags = (buttonDelay && !Zotero.automatedTest) ? Services.prompt.BUTTON_DELAY_ENABLE : 0;
		if (typeof button0 == 'number') flags += Services.prompt.BUTTON_POS_0 * button0;
		else if (typeof button0 == 'string') flags += Services.prompt.BUTTON_POS_0 * Services.prompt.BUTTON_TITLE_IS_STRING;
		if (typeof button1 == 'number') flags += Services.prompt.BUTTON_POS_1 * button1;
		else if (typeof button1 == 'string') flags += Services.prompt.BUTTON_POS_1 * Services.prompt.BUTTON_TITLE_IS_STRING;
		if (typeof button2 == 'number') flags += Services.prompt.BUTTON_POS_2 * button2;
		else if (typeof button2 == 'string') flags += Services.prompt.BUTTON_POS_2 * Services.prompt.BUTTON_TITLE_IS_STRING;
		if (defaultButton) flags += defaultButton == 1 ? Services.prompt.BUTTON_POS_1_DEFAULT : Services.prompt.BUTTON_POS_2_DEFAULT;
		return Services.prompt.confirmEx(
			win, title, text, flags,
			typeof button0 == 'number' ? null : button0,
			typeof button1 == 'number' ? null : button1,
			typeof button2 == 'number' ? null : button2,
			checkLabel, typeof checkbox == 'object' ? checkbox : {}
		);
	}
};
