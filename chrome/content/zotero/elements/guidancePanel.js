/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
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

"use strict";

{
	class GuidancePanel extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<panel type="arrow" align="top">
				<html:div class="panel-container">
					<html:div class="panel-text"></html:div>
				</html:div>
			</panel>
		`);
		
		/*
			Unused:
			
			<hbox id="close-button-box">
				<toolbarbutton id="close-button" class="close-icon" hidden="true"></toolbarbutton>
			</hbox>
			<hbox id="nav-buttons">
				<toolbarbutton id="back-button" hidden="true"></toolbarbutton>
				<toolbarbutton id="forward-button" hidden="true"></toolbarbutton>
			</hbox>
		*/

		get panel() {
			return this.querySelector('panel');
		}

		init() {
			this.panel.addEventListener('popupshown', () => {
				Zotero.guidanceBeingShown = true;
			});

			this.panel.addEventListener('popuphidden', () => {
				Zotero.guidanceBeingShown = false;
			});

			if (this.getAttribute("noautohide") == 'true'
					&& !this.hasAttribute('forward')) {
				let listener = () => {
					this.panel.removeEventListener("click", listener);
					this.panel.hidePopup();
				};
				this.panel.addEventListener("click", listener);
			}
		}

		/**
		 * @param {Object} [options]
		 * @param {String} [options.text] Text to use in place of firstRunGuidance.<about>
		 * @param {DOMElement} [options.forEl] Anchor node
		 * @param {Boolean} [options.force] Show even if already shown
		 */
		async show(options) {
			Components.utils.import("resource://gre/modules/Services.jsm");
			if (!Zotero.Prefs.get("firstRunGuidance")) return;
			
			options = options || {};
			let text = options.text;
			let useLastText = options.useLastText || false;
			let forEl = options.forEl || document.getElementById(this.getAttribute("for"));
			let force = options.force || false;
			
			if (!forEl) return;
			// Don't show two panels at once
			if (Zotero.guidanceBeingShown) {
				return;
			}
			
			var about = this.getAttribute("about");
			var pref = false;
			if (about) {
				pref = "firstRunGuidanceShown." + about;
				let shown = false;
				try {
					shown = Zotero.Prefs.get(pref);
				}
				catch (e) {}
				if (shown && !force) {
					return;
				}
			}
			
			var x = this.getAttribute("x"),
				y = this.getAttribute("y"),
				position = this.getAttribute("position");
			
			if (!useLastText) {
				if (!text) {
					text = await document.l10n.formatValue("first-run-guidance-" + about);
				}
				text = text.split("\n");
				var descriptionNode = document.querySelector('.panel-text');
				
				while (descriptionNode.hasChildNodes()) {
					descriptionNode.removeChild(descriptionNode.firstChild);
				}
				
				while (text.length) {
					var textLine = text.shift();
					descriptionNode.appendChild(document.createTextNode(textLine));
					if (text.length) descriptionNode.appendChild(document.createElement("br"));
				}
			}

			this._initNavButton('back', options.back);
			this._initNavButton('forward', options.forward);
			
			var f = () => {
				if (this.hasAttribute("foregroundonly") && Services.ww.activeWindow != window) return;
				
				this.panel.openPopup(forEl, position || "after_start",
					x ? parseInt(x, 10) : 0, y ? parseInt(y, 10) : 0);
				if (pref) {
					Zotero.Prefs.set(pref, true);
				}
			};
			
			if (this.hasAttribute("delay") && !force) {
				window.setTimeout(f, this.getAttribute("delay"));
			}
			else {
				f();
			}
		}

		hide() {
			this.panel.hidePopup();
		}

		_initNavButton(dir, nextID) {
			if (!nextID) {
				nextID = this.getAttribute(dir);
			}
			if (!nextID) {
				return;
			}
			var nextElem = document.getElementById(nextID);
			var button = this.id(dir + '-button');
			button.hidden = false;
			var target;
			// If there's a forward action and no back action, the whole panel triggers
			// the forward in noautohide mode
			if (dir == 'forward' && !this.hasAttribute('back')
					&& this.getAttribute('noautohide') == 'true') {
				target = this.panel;
			}
			else {
				target = button;
			}
			var listener = (event) => {
				target.removeEventListener("click", listener);
				this.hide();
				var data = {
					force: true
				};
				// Point the next panel back to this one
				data[dir == 'back' ? 'forward' : 'back'] = this.getAttribute('id');
				// When going backwards, don't regenerate text
				if (dir == 'back') {
					data.useLastText = true;
				}
				nextElem.show(data);
				event.stopPropagation();
			};
			target.addEventListener("click", listener);
		}

		id(id) {
			return this.querySelector(`#${id}`);
		}
	}

	customElements.define("guidance-panel", GuidancePanel);
}
