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

'use strict';

Services.scriptloader.loadSubScript("chrome://zotero/content/include.js", this);
Services.scriptloader.loadSubScript("chrome://global/content/customElements.js", this);
Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/itemPaneSection.js', this);
Services.scriptloader.loadSubScript('chrome://zotero/content/elements/itemTreeMenuBar.js', this);

{
	// https://searchfox.org/mozilla-central/rev/8e885f04a0a4ff6d64ea59741c10d9b8e45d9ff8/toolkit/content/customElements.js#826-832
	for (let [tag, script] of [
		['attachment-box', 'chrome://zotero/content/elements/attachmentBox.js'],
		['attachment-preview', 'chrome://zotero/content/elements/attachmentPreview.js'],
		['attachment-preview-box', 'chrome://zotero/content/elements/attachmentPreviewBox.js'],
		['context-pane', 'chrome://zotero/content/elements/contextPane.js'],
		['duplicates-merge-pane', 'chrome://zotero/content/elements/duplicatesMergePane.js'],
		['guidance-panel', 'chrome://zotero/content/elements/guidancePanel.js'],
		// TODO: rename itemBox.js to infoBox.js later to avoid conflict
		['info-box', 'chrome://zotero/content/elements/itemBox.js'],
		['item-details', 'chrome://zotero/content/elements/itemDetails.js'],
		['item-pane', 'chrome://zotero/content/elements/itemPane.js'],
		['item-message-pane', 'chrome://zotero/content/elements/itemMessagePane.js'],
		['merge-group', 'chrome://zotero/content/elements/mergeGroup.js'],
		['menulist-item-types', 'chrome://zotero/content/elements/menulistItemTypes.js'],
		['note-editor', 'chrome://zotero/content/elements/noteEditor.js'],
		['notes-box', 'chrome://zotero/content/elements/notesBox.js'],
		['quick-search-textbox', 'chrome://zotero/content/elements/quickSearchTextbox.js'],
		['related-box', 'chrome://zotero/content/elements/relatedBox.js'],
		['shadow-autocomplete-input', 'chrome://zotero/content/elements/shadowAutocompleteInput.js'],
		['split-menu-button', 'chrome://zotero/content/elements/splitMenuButton.js'],
		['tags-box', 'chrome://zotero/content/elements/tagsBox.js'],
		['zotero-text-link', 'chrome://zotero/content/elements/textLink.js'],
		['zoterosearch', 'chrome://zotero/content/elements/zoteroSearch.js'],
		['zoterosearchcondition', 'chrome://zotero/content/elements/zoteroSearch.js'],
		['zoterosearchtextbox', 'chrome://zotero/content/elements/zoteroSearch.js'],
		['zoterosearchagefield', 'chrome://zotero/content/elements/zoteroSearch.js'],
		['item-pane-header', 'chrome://zotero/content/elements/itemPaneHeader.js'],
		['editable-text', 'chrome://zotero/content/elements/editableText.js'],
		['item-pane-sidenav', 'chrome://zotero/content/elements/itemPaneSidenav.js'],
		['abstract-box', 'chrome://zotero/content/elements/abstractBox.js'],
		['collapsible-section', 'chrome://zotero/content/elements/collapsibleSection.js'],
		['attachments-box', 'chrome://zotero/content/elements/attachmentsBox.js'],
		['attachment-row', 'chrome://zotero/content/elements/attachmentRow.js'],
		['attachment-annotations-box', 'chrome://zotero/content/elements/attachmentAnnotationsBox.js'],
		['annotation-row', 'chrome://zotero/content/elements/annotationRow.js'],
		['context-notes-list', 'chrome://zotero/content/elements/contextNotesList.js'],
		['note-row', 'chrome://zotero/content/elements/noteRow.js'],
		['notes-context', 'chrome://zotero/content/elements/notesContext.js'],
		['libraries-collections-box', 'chrome://zotero/content/elements/librariesCollectionsBox.js'],
		['autocomplete-textarea', 'chrome://zotero/content/elements/autocompleteTextArea.js'],
		['bubble-input', 'chrome://zotero/content/elements/bubbleInput.js'],
		// DeeptutorZ: add chatbot pane
		['deep-tutor-pane', 'chrome://zotero/content/elements/DeepTutorPane.js'],
		['deep-tutor-box', 'chrome://zotero/content/elements/deepTutorBox.js'],
		['model-selection', 'chrome://zotero/content/elements/modelSelection.js'],
		['session-history-box', 'chrome://zotero/content/elements/sessionHistoryBox.js']
	]) {
		customElements.setElementCreationCallback(tag, () => {
			Services.scriptloader.loadSubScript(script, window);
			if (!customElements.get(tag)) {
				throw new Error(`${script} failed to define <${tag}>`);
			}
		});
	}
	
	// Fix missing property bug that breaks arrow key navigation between <tab>s
	let MozTabPrototype = customElements.get('tab').prototype;
	if (!MozTabPrototype.hasOwnProperty('container')) {
		Object.defineProperty(MozTabPrototype, 'container', {
			get: function () {
				if (this.parentElement && this.parentElement.localName == 'tabs') {
					return this.parentElement;
				}
				else {
					return null;
				}
			}
		});
	}

	// Clear whatever aria semantics the separator has so it is not counted when
	// screen readers list how many menuitems a menu has.
	document.addEventListener("popupshowing", (event) => {
		if (event.originalTarget.tagName !== "menupopup") return;
		for (let separator of [...event.originalTarget.querySelectorAll("menuseparator")]) {
			separator.setAttribute("role", "presentation");
		}
	});

	// Add MacOS menupopup fade animation to menupopups
	if (Zotero.isMac) {
		let MozMenuPopupPrototype = customElements.get("menupopup").prototype;

		// Initialize the menupopup when it's first opened
		let originalEnsureInitialized = MozMenuPopupPrototype.ensureInitialized;
		MozMenuPopupPrototype.ensureInitialized = function () {
			if (!this._zoteroInitialized) {
				this._zoteroInitialized = true;

				// Following the implementation from https://searchfox.org/mozilla-esr102/source/toolkit/content/widgets/menupopup.js
				let haveCheckableChild = this.querySelector(
					":scope > menuitem:not([hidden]):is([type=checkbox],[type=radio])"
				);
				this.toggleAttribute("needsgutter", haveCheckableChild);

				/**
				 * Add fade animation to the popup
				 * animate="false" will disable the animation
				 * animate="false-once" will disable the animation once, which we use for the
				 *   command event, so that the popup doesn't flicker when the user clicks
				 * animate="open" when the menu is open
				 * animate="cancel" when is menu is hiding
				 */
				if (this.getAttribute("animate") !== "false") {
					this.setAttribute("animate", "open");
				}

				this.addEventListener("popupshowing", (e) => {
					if (this !== e.target) {
						return;
					}
					this.style.removeProperty("pointer-events");
					// Following the implementation from https://searchfox.org/mozilla-esr102/source/toolkit/content/widgets/menupopup.js
					let haveCheckableChild = this.querySelector(
						":scope > menuitem:not([hidden]):is([type=checkbox],[type=radio],[selected],[checked])"
					);
					this.toggleAttribute("needsgutter", haveCheckableChild);
					// Update animate attribute when the popup is shown
					if (this.getAttribute("animate") === "false") {
						return;
					}
					this.setAttribute("animate", "open");
				});
				
				// Update animate attribute when the popup is hiding and trigger the fade out animation
				this.addEventListener("popuphiding", (e) => {
					if (
						this !== e.target
						// Don't animate the popup if it's a submenu
						|| this.parentElement?.parentElement?.localName === "menupopup"
						// open="true" and aria-hidden="true" means it's a native menupopup
						|| (this.getAttribute("open", "true") && this.getAttribute("aria-hidden", "true"))
						|| !this.getAttribute("animate")
						|| ["false", "false-once"].includes(this.getAttribute("animate"))) {
						return;
					}
					e.preventDefault();
					e.stopPropagation();
					this.setAttribute("animate", "cancel");
					// Make the timeout slightly longer than the animation duration (180ms) in _menupopup.scss
					setTimeout(() => {
						this.removeAttribute("animate");
						this.hidePopup();
					}, 200);
				});

				// If a menu closes with voiceover cursor in it, the cursor gets stuck in no-longer-visible
				// menu and voiceover will be quiet until it is restarted. Marking the menu
				// as aria-hidden for a moment forces voiceover to shift its cursor.
				this.addEventListener("popuphidden", (e) => {
					if (this !== e.target || this.parentNode?.closest("menupopup")) {
						return;
					}
					this.setAttribute("aria-hidden", true);
					setTimeout(() => {
						this.removeAttribute("aria-hidden");
					});
				});

				// This event is triggered after clicking the menu and before popuphiding
				// where we control whether the fade out animation should run
				const commandCallback = (e) => {
					let animateState = this.getAttribute("animate");
					if (animateState === "false") {
						return;
					}
					// Do not trigger the event if the popup is already closing
					if (animateState === "false-once") {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					// Disable the fading animation when the popup is closed by clicking
					this.setAttribute("animate", "false-once");
					this.style.pointerEvents = "none";
				};

				this.addEventListener("command", commandCallback, {
					capture: true,
					mozSystemGroup: true,
				});
				// Sometimes the `command` event is not triggered, also listen to `click` event
				// For example, when the menuitem has `command` attribute
				this.addEventListener("click", commandCallback, {
					capture: true,
					mozSystemGroup: true,
				});
				
				// The _moz-menuactive attribute isn't removed from menulist items
				// when the mouse leaves the menu. On menulists only, replace the attribute
				// with a marker that will be used to restore the _moz-menuactive attribute
				// when the mouse reenters the menu.
				// (We need to manually restore _moz-menuactive because it won't automatically
				//  be re-added if the mouse exits the menu and then enters again on the same
				//  item.)
				this.addEventListener("mouseleave", () => {
					if (this.parentElement?.localName !== "menulist") {
						return;
					}
					// Only apply to top-level <menuitems>, not sub-<menu>s or nested <menuitem>s,
					// because those already have the right behavior
					let activeChild = this.querySelector(":scope > menuitem[_moz-menuactive='true']");
					if (activeChild) {
						activeChild.removeAttribute("_moz-menuactive");
						activeChild.dataset.activeBeforeMouseleave = "true";
					}
				});
				
				this.addEventListener("mouseover", (event) => {
					if (this.parentElement?.localName !== "menulist") {
						return;
					}
					let { target } = event;
					if (target.parentElement === this && target.dataset.activeBeforeMouseleave) {
						target.setAttribute("_moz-menuactive", "true");
						delete target.dataset.activeBeforeMouseleave;
					}
				});
			}
			originalEnsureInitialized.apply(this);
		};
	}

	// The menulist CE is defined lazily. Create one now to get menulist defined, so we can patch it
	if (!customElements.get("menulist")) {
		delete document.createXULElement("menulist");
	}

	// inject custom CSS into FF built-in custom elements
	const InjectCSSConfig = {
		global: [
			"wizard",
			"menulist",
			{
				element: "dialog",
				patchedFunction: "connectedCallback"
			}
		],
		win: [
			"wizard",
			{
				element: "dialog",
				// The `attachShadow` are cleared in <dialog>, we need to monkey-patch after `connectedCallback`.
				patchedFunction: "connectedCallback",
			}
		],
		mac: [
			"wizard",
			{
				element: "dialog",
				// The `attachShadow` are cleared in <dialog>, we need to monkey-patch after `connectedCallback`.
				patchedFunction: "connectedCallback",
			}
		],
		linux: [],
	};
	for (let [key, configs] of Object.entries(InjectCSSConfig)) {
		if (key == "win" && !Zotero.isWin) continue;
		if (key == "mac" && !Zotero.isMac) continue;
		if (key == "linux" && !Zotero.isLinux) continue;
		let prefix = "";
		if (key == "global") {
			prefix = "zotero/skin/xulElementPatches/";
		}
		else {
			prefix = "zotero-platform/content/xulElementPatches/";
		}
		for (let config of configs) {
			let element, patchedFunction;
			// By default, monkey-patch `attachShadow`
			if (typeof config === "string") {
				element = config;
				patchedFunction = "attachShadow";
			}
			else {
				element = config.element;
				patchedFunction = config.patchedFunction;
			}
			let oldFunc = customElements.get(element).prototype[patchedFunction];
			customElements.get(element).prototype[patchedFunction] = function () {
				let ret = oldFunc.apply(this, arguments);
				this.shadowRoot.append(MozXULElement.parseXULToFragment(
					`<html:link rel="stylesheet" href="chrome://${prefix}${element}.css"/>`
				));
				return ret;
			};
		}
	}
}
