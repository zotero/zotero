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

"use strict";

{
	class CollapsibleSection extends XULElementBase {
		_head = null;
		
		_title = null;

		_listenerAdded = false;
		
		get open() {
			if (this.empty) {
				return false;
			}
			return this.hasAttribute('open');
		}
		
		set open(newOpen) {
			newOpen = !!newOpen;
			let oldOpen = this.open;
			if (oldOpen === newOpen || this.empty || !this.collapsible) return;
			this.render();
			
			// Force open before getting scrollHeight, so we get the right value
			// even if the body has a scrollable child
			this.toggleAttribute('open', true);
			if (!this._restoringOpenState && this._head?.nextSibling?.scrollHeight) {
				this.style.setProperty('--open-height', `${this._head.nextSibling.scrollHeight}px`);
			}
			else {
				this.style.setProperty('--open-height', 'auto');
			}
			this.toggleAttribute('open', oldOpen);
			
			// eslint-disable-next-line no-void
			void getComputedStyle(this).maxHeight; // Force style calculation! Without this the animation doesn't work
			this.toggleAttribute('open', newOpen);

			this.dispatchEvent(new CustomEvent('toggle'), {
				bubbles: false,
				cancelable: false
			});
			
			// Blur the focus if it's within the body (not the header) of the section on collapse
			let focused = this.ownerDocument?.activeElement;
			if (!newOpen && focused && this.lastChild.contains(focused)) {
				focused.blur();
			}
			
			this._saveOpenState();
		}
		
		get empty() {
			return this.hasAttribute('empty');
		}
		
		set empty(val) {
			this._runWithTransitionsDisabled(() => {
				this.toggleAttribute('empty', !!val);
			});
		}
		
		setCount(count) {
			this.setAttribute('data-l10n-args', JSON.stringify({ count }));
			this.empty = !count;
		}
		
		get label() {
			return this.getAttribute('label');
		}
		
		set label(val) {
			this.setAttribute('label', val);
		}
		
		get summary() {
			return this.getAttribute('summary');
		}
		
		set summary(val) {
			this.setAttribute('summary', val);
		}
		
		get collapsible() {
			return !this.getAttribute("no-collapse");
		}

		set collapsible(val) {
			if (val) {
				this.removeAttribute('no-collapse');
			}
			else {
				this.setAttribute('no-collapse', val);
			}
		}
		
		static get observedAttributes() {
			return ['open', 'empty', 'label', 'summary', 'extra-buttons'];
		}
		
		attributeChangedCallback(name) {
			if (name === "extra-buttons") {
				this._buildExtraButtons();
			}
			else {
				this.render();
			}
		}
		
		init() {
			if (!this.dataset.pane) {
				throw new Error('data-pane is required');
			}
			
			
			this._head = document.createElement('div');
			this._head.role = 'button';
			this._head.className = 'head';
			this._head.setAttribute("tabindex", "0");
			this._head.addEventListener('mousedown', this._handleMouseDown);
			this._head.addEventListener('click', this._handleClick);
			this._head.addEventListener('keydown', this._handleKeyDown);
			this._head.addEventListener('contextmenu', this._handleContextMenu);

			let titleBox = document.createElement('div');
			titleBox.className = 'title-box';
			
			this._title = document.createElement('span');
			this._title.className = 'title';
			titleBox.append(this._title);
			
			this._summary = document.createElement('span');
			this._summary.className = 'summary';
			titleBox.append(this._summary);

			this._head.append(titleBox);

			this._contextMenu = this._buildContextMenu();
			if (this._contextMenu) {
				let popupset = document.createXULElement('popupset');
				popupset.append(this._contextMenu);
				this._head.append(popupset);
			}
			
			let twisty = document.createXULElement('toolbarbutton');
			twisty.className = 'twisty';
			twisty.setAttribute("tabindex", "0");
			twisty.setAttribute("tooltip", "dynamic-tooltip");
			twisty.setAttribute("data-l10n-attrs", "dynamic-tooltiptext");
			this._head.append(twisty);
			
			this._buildExtraButtons();
			
			this.prepend(this._head);

			this._runWithTransitionsDisabled(() => {
				this._restoreOpenState();
				this.render();
			});
			
			this._prefsObserverID = Zotero.Prefs.registerObserver(`panes.${this.dataset.pane}.open`, this._restoreOpenState.bind(this));
			
			if (this.hasAttribute('data-l10n-id') && !this.hasAttribute('data-l10n-args')) {
				this.setAttribute('data-l10n-args', JSON.stringify({ count: 0 }));
			}
			// Fetch the localized value of the current pane which is used to set aria-properties
			document.l10n.formatValue(`pane-${this.dataset.pane}`)
				.then((res) => {
					this._paneName = res;
				});
		}
		
		_buildContextMenu() {
			let containerRoot = this.closest('.zotero-view-item-container, context-notes-list');
			
			let contextMenu = document.createXULElement('menupopup');
			let collapseOtherSections = document.createXULElement('menuitem');
			collapseOtherSections.classList.add('menuitem-iconic', 'zotero-menuitem-collapse-others');
			collapseOtherSections.setAttribute('data-l10n-id', 'collapse-other-sections');
			collapseOtherSections.addEventListener('command', () => {
				// Scroll to the top (first section), so we don't end up scrolled past the end
				containerRoot.querySelector('collapsible-section').scrollIntoView({ block: 'start' });
				for (let section of containerRoot.querySelectorAll('collapsible-section')) {
					if (section !== this) {
						section.open = false;
					}
				}
			});
			contextMenu.append(collapseOtherSections);

			let expandAllSections = document.createXULElement('menuitem');
			expandAllSections.classList.add('menuitem-iconic', 'zotero-menuitem-expand-all');
			expandAllSections.setAttribute('data-l10n-id', 'expand-all-sections');
			expandAllSections.addEventListener('command', () => {
				for (let section of containerRoot.querySelectorAll('collapsible-section')) {
					section.open = true;
				}
			});
			contextMenu.append(expandAllSections);
			
			let pinSection, unpinSection;
			let pinUnpinSeparator = document.createXULElement('menuseparator');
			contextMenu.append(pinUnpinSeparator);

			pinSection = document.createXULElement('menuitem');
			pinSection.classList.add('menuitem-iconic', 'zotero-menuitem-pin');
			pinSection.setAttribute('data-l10n-id', 'pin-section');
			pinSection.addEventListener('command', () => {
				let sidenav = this._getSidenav();
				sidenav.container.scrollToPane(this.dataset.pane, 'smooth');
				sidenav.pinnedPane = this.dataset.pane;
			});
			contextMenu.append(pinSection);

			unpinSection = document.createXULElement('menuitem');
			unpinSection.classList.add('menuitem-iconic', 'zotero-menuitem-unpin');
			unpinSection.setAttribute('data-l10n-id', 'unpin-section');
			unpinSection.addEventListener('command', () => {
				this._getSidenav().pinnedPane = null;
			});
			contextMenu.append(unpinSection);

			contextMenu.addEventListener('popupshowing', () => {
				let sections = Array.from(containerRoot.querySelectorAll('collapsible-section'));
				collapseOtherSections.disabled = sections.every(section => section === this || !section.open);
				expandAllSections.disabled = sections.every(section => section.open || section.empty);

				let sidenav = this._getSidenav();
				if (sidenav?.isPanePinnable(this.dataset.pane)) {
					pinUnpinSeparator.hidden = false;
					pinSection.hidden = sidenav.pinnedPane == this.dataset.pane;
					unpinSection.hidden = sidenav.pinnedPane != this.dataset.pane;
				}
				else {
					pinUnpinSeparator.hidden = true;
					pinSection.hidden = true;
					unpinSection.hidden = true;
				}
			});
			
			return contextMenu;
		}

		_buildExtraButtons() {
			if (!this.initialized) {
				return;
			}
			this.querySelectorAll('.section-custom-button').forEach(elem => elem.remove());
			let extraButtons = [];
			let buttonTypes = (this.getAttribute('extra-buttons') || "").split(",");
			for (let buttonType of buttonTypes) {
				buttonType = buttonType.trim();
				if (!buttonType) continue;
				let button = document.createXULElement('toolbarbutton');
				button.classList.add(buttonType, 'section-custom-button');
				button.setAttribute("data-l10n-id", `section-button-${buttonType}`);
				button.setAttribute("tabindex", "0");
				button.addEventListener('command', (event) => {
					this.dispatchEvent(new CustomEvent(buttonType, {
						...event,
						detail: { button },
						bubbles: false
					}));
				});
				extraButtons.push(button);
			}
			this._head.querySelector('.twisty').before(...extraButtons);
		}
		
		destroy() {
			this._head.removeEventListener('click', this._handleClick);
			this._head.removeEventListener('mousedown', this._handleMouseDown);
			this._head.removeEventListener('keydown', this._handleKeyDown);
			this._head.removeEventListener('contextmenu', this._handleContextMenu);
			
			Zotero.Prefs.unregisterObserver(this._prefsObserverID);
		}
		
		_saveOpenState() {
			if (this._disableSavingOpenState) return;
			Zotero.Prefs.set(`panes.${this.dataset.pane}.open`, this.open);
		}
		
		_restoreOpenState() {
			if (this._disableSavingOpenState) {
				this.open = true;
				return;
			}
			this._restoringOpenState = true;
			this.open = Zotero.Prefs.get(`panes.${this.dataset.pane}.open`) ?? true;
			this._restoringOpenState = false;
		}

		_runWithTransitionsDisabled(fn) {
			this.classList.add('disable-transitions');
			fn();
			// Need to wait a tick before re-enabling - forcing style recalculation isn't enough here
			requestAnimationFrame(() => {
				this.classList.remove('disable-transitions');
				// --open-height is usually cleared when the animation ends, but we had animations disabled.
				// Clear it manually.
				this.style.setProperty('--open-height', 'auto');
			});
		}
		
		get _disableCollapsing() {
			return !!this.closest('panel, menupopup, merge-pane');
		}

		get _disableSavingOpenState() {
			return !!this.closest('merge-pane');
		}

		_handleClick = (event) => {
			if (this._disableCollapsing) return;
			if (event.target.closest('.section-custom-button, menupopup')) return;
			this.open = !this.open;
		};

		// Prevent moving focus to the header on click
		_handleMouseDown = (event) => {
			event.preventDefault();
		};
		
		_handleKeyDown = (event) => {
			let tgt = event.target;
			let stopEvent = () => {
				event.preventDefault();
				event.stopPropagation();
			};

			if (event.target.tagName === "toolbarbutton") {
				// No actions on right/left on header buttons
				if (["ArrowRight", "ArrowLeft"].includes(event.key)) {
					stopEvent();
					return;
				}
				// Let itemPane.js listener handle space or Enter clicks
				if ([" ", "Enter"].includes(event.key)) {
					return;
				}
			}
			// Space/Enter toggle section open/closed.
			// ArrowLeft/ArrowRight on actual header will close/open (depending on locale direction)
			if (["ArrowLeft", "ArrowRight", " ", "Enter"].includes(event.key)) {
				stopEvent();
				this.open = ([" ", "Enter"].includes(event.key)) ? !this.open : (event.key == Zotero.arrowNextKey);
				event.target.focus();
			}
			if (["ArrowUp", "ArrowDown"].includes(event.key)) {
				let up = event.key == "ArrowUp";
				// Arrow up from a button focuses the header
				if (up && this._head !== tgt) {
					this._head.focus();
					stopEvent();
					return;
				}
				// ArrowUp focuses the header of the previous section, ArrowDown - of the next one
				let box = this.parentNode;
				let nextBox;
				nextBox = up ? box.previousElementSibling : box.nextElementSibling;
				while (nextBox && nextBox.hidden) {
					nextBox = up ? nextBox.previousElementSibling : nextBox.nextElementSibling;
				}
				let nextSection = nextBox?.querySelector("collapsible-section");
				if (nextSection) {
					nextSection._head.focus();
					stopEvent();
				}
			}
		};
		
		_handleContextMenu = (event) => {
			if (!this._getSidenav() || event.target.closest('.section-custom-button')) return;
			event.preventDefault();
			this._contextMenu?.openPopupAtScreen(event.screenX, event.screenY, true);
		};
		
		_getSidenav() {
			// If we're inside a popup, the main window sidenav is irrelevant
			if (this.closest('panel, menupopup')) {
				return null;
			}
			// If we're not in the main window, we don't have a sidenav
			if (document.documentElement.getAttribute('windowtype') !== 'navigator:browser') {
				return null;
			}
			if (typeof ZoteroContextPane == "undefined") return null;
			// TODO: update this after unifying item pane & context pane
			return ZoteroContextPane.sidenav;
		}
		
		render() {
			if (!this.initialized) return;
			
			if (!this._listenerAdded && this._head?.nextSibling) {
				this._head.nextSibling.addEventListener('transitionend', () => {
					this.style.setProperty('--open-height', 'auto');
				});
				this._listenerAdded = true;
			}
			
			this._head.setAttribute('aria-expanded', this.open);
			this._head.setAttribute("aria-label", this.label);
			this._title.textContent = this.label;
			this._summary.textContent = this.summary;
			let twisty = this._head.querySelector('.twisty');
			twisty.hidden = this._disableCollapsing;
			document.l10n.setAttributes(twisty, `section-button-${this.open ? "collapse" : "expand"}`, { section: this._paneName || "" });
		}
	}
	customElements.define("collapsible-section", CollapsibleSection);
}
