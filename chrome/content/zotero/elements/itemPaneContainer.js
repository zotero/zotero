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


/**
 * Base class for elements that host a vertical stack of [data-pane] sections
 * controlled by an <item-pane-sidenav>.
 *
 * Subclasses must set this._paneParent (the scrollable element directly
 * containing the [data-pane] children) in their init() before any of the
 * inherited container methods are called.
 *
 * Pin support and pane reordering are opt-in -- subclasses override
 * pinnedPane, changePaneOrder(), and initPaneOrder if they want them.
 * scrollToPane() handles smooth scrolling and adds bottom padding when
 * necessary so the target pane can sit at the very top of the container;
 * subclasses with extra per-scroll bookkeeping (intersection observers, async
 * render of following panes, etc.) can override the _beforeScrollToPane() and
 * _afterScrollToPane() hooks.
 */
// eslint-disable-next-line no-unused-vars
class ItemPaneContainerBase extends XULElementBase {
	_paneParent = null;

	connectedCallback() {
		super.connectedCallback();
		this.classList.add('item-pane-container-root');
	}

	get sidenav() {
		return this._sidenav;
	}

	set sidenav(sidenav) {
		this._sidenav = sidenav;
		sidenav.container = this;
	}

	get tabType() {
		return this.getAttribute('tabType');
	}

	set tabType(val) {
		this.setAttribute('tabType', val);
	}

	get _collapsed() {
		let parentPane = this.closest('item-pane, context-pane');
		return parentPane ? parentPane.collapsed : false;
	}

	set _collapsed(val) {
		let parentPane = this.closest('item-pane, context-pane');
		if (parentPane) parentPane.collapsed = val;
	}

	/**
	 * Whether this container supports user-driven pinning of a pane.
	 * The sidenav and section context menus honor this when deciding whether
	 * to expose the pin/unpin UI. Subclasses that implement `pinnedPane`
	 * should override this to return true.
	 */
	get supportsPinning() {
		return false;
	}

	/**
	 * Whether this container supports user-driven pane reordering (drag in
	 * the sidenav, reorder menuitems in the sidenav and section context
	 * menus). Subclasses that implement changePaneOrder() and initPaneOrder()
	 * should return true.
	 */
	get supportsReorder() {
		return false;
	}

	/**
	 * Pin support is opt-in. Default: not supported.
	 */
	get pinnedPane() {
		return null;
	}

	set pinnedPane(_val) {}

	getPane(id) {
		return this._paneParent.querySelector(`:scope > [data-pane="${CSS.escape(id)}"]`);
	}

	getEnabledPane(id) {
		return this._paneParent.querySelector(`:scope > [data-pane="${CSS.escape(id)}"]:not([hidden])`);
	}

	getPanes() {
		return Array.from(this._paneParent.querySelectorAll(':scope > [data-pane]'));
	}

	getEnabledPanes() {
		return Array.from(this._paneParent.querySelectorAll(':scope > [data-pane]:not([hidden])'));
	}

	async _waitFrame() {
		return this._waitNoLongerThan(new Promise((resolve) => {
			requestAnimationFrame(resolve);
		}), 30);
	}

	async _waitFrames(n) {
		for (let i = 0; i < n; i++) {
			await this._waitFrame();
		}
	}

	async _waitDOMUpdate(timeout = 50) {
		return new Promise((resolve) => {
			requestIdleCallback(resolve, { timeout });
		});
	}

	async _waitNoLongerThan(promise, ms = 1000) {
		return Promise.race([promise, Zotero.Promise.delay(ms)]);
	}

	get _minScrollHeight() {
		return parseFloat(this._paneParent.style.getPropertyValue('--min-scroll-height') || 0);
	}

	set _minScrollHeight(val) {
		this._paneParent.style.setProperty('--min-scroll-height', val + 'px');
	}

	_makeSpaceForPane(pane) {
		let oldMinScrollHeight = this._minScrollHeight;
		let newMinScrollHeight = this._getMinScrollHeightForPane(pane);
		if (newMinScrollHeight > oldMinScrollHeight) {
			this._minScrollHeight = newMinScrollHeight;
		}
	}

	_getMinScrollHeightForPane(pane) {
		let paneRect = pane.getBoundingClientRect();
		let containerRect = this._paneParent.getBoundingClientRect();
		// No offsetTop property for XUL elements
		let offsetTop = paneRect.top - containerRect.top + this._paneParent.scrollTop;
		return offsetTop + containerRect.height;
	}

	async _waitForScroll() {
		let scrollPromise = Zotero.Promise.defer();
		let lastScrollTop = this._paneParent.scrollTop;
		const checkScrollStart = () => {
			// If the scrollTop is not changed, wait for scroll to happen
			if (lastScrollTop === this._paneParent.scrollTop) {
				requestAnimationFrame(checkScrollStart);
			}
			// Wait for scroll to end
			else {
				requestAnimationFrame(checkScrollEnd);
			}
		};
		const checkScrollEnd = async () => {
			// Wait for 3 frames to make sure not further scrolls
			await this._waitFrames(3);
			if (lastScrollTop === this._paneParent.scrollTop) {
				scrollPromise.resolve();
			}
			else {
				lastScrollTop = this._paneParent.scrollTop;
				requestAnimationFrame(checkScrollEnd);
			}
		};
		checkScrollStart();
		// Abort after 3 seconds, which should be enough
		return Promise.race([
			scrollPromise.promise,
			Zotero.Promise.delay(3000)
		]);
	}

	/**
	 * Called immediately before the scroll begins, after we've decided we will scroll.
	 */
	_beforeScrollToPane(_pane) {}

	/**
	 * Called after the scroll has settled.
	 */
	async _afterScrollToPane(_pane, _panes, _paneIndex) {}

	async scrollToPane(paneID, behavior = 'smooth') {
		let panes = this.getEnabledPanes();
		let paneIndex = panes.findIndex(elem => elem.dataset.pane == paneID);
		let pane = panes[paneIndex];
		if (!pane) return null;

		// If the container is collapsed, just remember which pane needs to be
		// scrolled to when the container is expanded.
		if (this._collapsed) {
			this._lastScrollPaneID = paneID;
			return null;
		}

		// If the pane is already at the top, no need to scroll
		if (Math.abs(pane.getBoundingClientRect().top - this._paneParent.getBoundingClientRect().top) < 1) {
			return true;
		}

		this._beforeScrollToPane(pane);

		// The pane should always be at the very top.
		// If there isn't enough stuff below it for it to be at the top, we add
		// padding via the --min-scroll-height CSS variable so we don't need
		// to add another level to the DOM.
		this._makeSpaceForPane(pane);

		let scrollPromise;
		if (behavior == 'smooth') {
			this._disableScrollHandler = true;
			scrollPromise = this._waitForScroll();
			scrollPromise.then(() => this._disableScrollHandler = false);
		}
		else {
			// Wait for the next DOM update to make sure the height is updated before rendering
			scrollPromise = this._waitDOMUpdate();
		}
		pane.scrollIntoView({ block: 'start', behavior });
		pane.focus();
		await scrollPromise;

		await this._afterScrollToPane(pane, panes, paneIndex);
		return true;
	}

	changePaneOrder() {}

	initPaneOrder() {}
}
