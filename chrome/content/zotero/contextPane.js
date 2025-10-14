/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
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

var ZoteroContextPane = new function () {
	let _loadingMessageContainer;
	let _contextPane;
	let _contextPaneInner;
	let _contextPaneSplitter;
	let _contextPaneSplitterStacked;
	let _librarySidenav;
	let _readerSidenav;
	let _sidePaneState;

	Object.defineProperty(this, 'activeEditor', {
		get: () => _contextPaneInner.activeEditor
	});

	Object.defineProperty(this, 'sidenav', {
		get: () => (Zotero_Tabs.selectedType == "library"
			? _librarySidenav
			: _readerSidenav)
	});

	Object.defineProperty(this, 'splitter', {
		get: () => (_isStacked()
			? _contextPaneSplitterStacked
			: _contextPaneSplitter)
	});

	Object.defineProperty(this, 'collapsed', {
		get: () => {
			return this.splitter.getAttribute('state') === 'collapsed';
		},
		set: (collapsed) => {
			_contextPane.setAttribute('collapsed', !!collapsed);
			_contextPaneInner.setAttribute('collapsed', !!collapsed);
			_contextPaneSplitter.setAttribute('state', collapsed ? 'collapsed' : 'open');
			_contextPaneSplitterStacked.setAttribute('state', collapsed ? 'collapsed' : 'open');
			this.update();
		}
	});

	this.focus = () => {
		return _contextPaneInner.handleFocus();
	};

	this.showLoadingMessage = (isShow) => {
		_loadingMessageContainer.classList.toggle('hidden', !isShow);
	};

	this.getSidePaneState = (tabType) => {
		if (!_sidePaneState) {
			_loadSidePaneState();
		}
		if (!_sidePaneState[tabType]) {
			_sidePaneState[tabType] = {
				width: 0,
				open: false,
			};
		}
		return _sidePaneState[tabType];
	};

	this.updateSidePaneState = (tabType, state) => {
		if (!_sidePaneState) {
			_loadSidePaneState();
		}
		if (!_sidePaneState[tabType]) {
			_sidePaneState[tabType] = {};
		}
		state = state || {};
		let hasChanges = false;
		for (let key in state) {
			if (_sidePaneState[tabType][key] !== state[key]) {
				hasChanges = true;
				break;
			}
		}
		if (!hasChanges) {
			return _sidePaneState[tabType];
		}
		Object.assign(_sidePaneState[tabType], state);
		_saveSidePaneState();
		return _sidePaneState[tabType];
	};

	this.init = function () {
		if (!Zotero) {
			return;
		}

		_loadingMessageContainer = document.getElementById('zotero-tab-cover');
		_contextPane = document.getElementById('zotero-context-pane');
		// <context-pane> CE
		_contextPaneInner = document.getElementById('zotero-context-pane-inner');
		_contextPaneSplitter = document.getElementById('zotero-context-splitter');
		_contextPaneSplitterStacked = document.getElementById('zotero-context-splitter-stacked');
		_librarySidenav = document.querySelector("#zotero-view-item-sidenav");
		_readerSidenav = document.getElementById('zotero-context-pane-sidenav');

		_loadSidePaneState();

		// Never use default status for the reader sidenav
		_readerSidenav.toggleDefaultStatus(false);
		
		_contextPaneInner.sidenav = _readerSidenav;

		this.context = _contextPaneInner;

		window.addEventListener('resize', this.update);
	};

	this.destroy = function () {
		window.removeEventListener('resize', this.update);

		_saveSidePaneState();
	};

	this.updateAddToNote = () => {
		let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			let editor = ZoteroContextPane.activeEditor;
			let libraryReadOnly = editor && editor.item && _isLibraryReadOnly(editor.item.libraryID);
			let noteReadOnly = editor && editor.item
				&& (editor.item.deleted || editor.item.parentItem && editor.item.parentItem.deleted);
			reader.enableAddToNote(!!editor && !libraryReadOnly && !noteReadOnly);
		}
	};

	/**
	 * Update the layout of the context pane and side pane.
	 * @param {Object} options - Options for updating the layout.
	 * @param {number | boolean} [options.sidePaneWidth] - The width of the side pane in pixels.
	 * If boolean, it indicates whether the side pane is open (true) or collapsed (false).
	 * @param {number} [options.contextPaneWidth] - The width of the context pane in pixels.
	 * @returns {Object} An object containing the updated layout state.
	 */
	this.updateLayout = ({ sidePaneWidth, contextPaneWidth } = {}) => {
		let stacked = _isStacked();
		let { tabContentType: tabType } = Zotero_Tabs.parseTabType();
		let sidePaneState;
		if (typeof sidePaneWidth === 'number') {
			// If sidePaneWidth is a number, update the width and open state
			sidePaneState = this.updateSidePaneState(tabType, { width: sidePaneWidth, open: sidePaneWidth > 0 });
		}
		else if (typeof sidePaneWidth === 'boolean') {
			// If sidePaneWidth is a boolean, update the open state only
			sidePaneState = this.updateSidePaneState(tabType, { open: sidePaneWidth });
			sidePaneWidth = sidePaneState.width || 0;
		}
		else {
			// If sidePaneWidth is not provided, use the saved state
			sidePaneState = this.getSidePaneState(tabType);
			sidePaneWidth = sidePaneState.width || 0;
			if (sidePaneState.open === false) {
				sidePaneWidth = 0;
			}
		}

		if (typeof contextPaneWidth !== 'number') {
			contextPaneWidth = _contextPane.getAttribute("width");
		}

		let sidebarWidth = `${sidePaneWidth}px`;
		if (contextPaneWidth && !_contextPane.style.width) {
			_contextPane.style.width = `${contextPaneWidth}px`;
		}
		if (Zotero.rtl) {
			_contextPane.style.left = 0;
			_contextPane.style.right = stacked ? sidebarWidth : 'unset';
		}
		else {
			_contextPane.style.left = stacked ? sidebarWidth : 'unset';
			_contextPane.style.right = 0;
		}

		let placeholder = document.getElementById('zotero-reader-sidebar-pane');
		placeholder.setAttribute('collapsed', sidebarWidth ? 'false' : 'true');
		// Don't set width if 0 to prevent layout issues in older versions
		if (sidePaneWidth) {
			placeholder.setAttribute('width', sidebarWidth);
		}

		return { sidePaneState };
	};

	this.update = () => {
		let updatedState = {};
		if (Zotero_Tabs.selectedType === 'library') {
			return updatedState;
		}
		if (_isStacked()) {
			_contextPaneSplitterStacked.setAttribute('hidden', false);
			_contextPaneSplitter.setAttribute('hidden', true);
			_contextPane.classList.add('stacked');
			_contextPane.classList.remove('standard');
			_readerSidenav.classList.add('stacked');
			if (_readerSidenav.parentElement != _contextPaneInner) {
				_contextPaneInner.append(_readerSidenav);
				_readerSidenav.render();
			}
			// Fx115: in stacked layout, make contextPane occupy all width and remove min-height
			// needed for standard layout
			_contextPane.style.width = 'auto';
			_contextPaneInner.style.removeProperty("min-height");

			// Propagate state to standard splitter
			_contextPaneSplitter.setAttribute('state', this.collapsed ? 'collapsed' : 'open');
		}
		else {
			_contextPaneSplitter.setAttribute('hidden', false);
			_contextPaneSplitterStacked.setAttribute('hidden', true);
			_contextPane.classList.add('standard');
			_contextPane.classList.remove('stacked');
			_readerSidenav.classList.remove('stacked');
			if (_readerSidenav.parentElement != _contextPane) {
				_contextPane.append(_readerSidenav);
				_readerSidenav.render();
			}
			// FX115: in standard layout, make contextPane have the width it's supposed to and
			// force it to occupy all height available
			_contextPaneInner.style.minHeight = `100%`;
			_contextPane.style.width = `${_contextPane.getAttribute("width")}px`;

			// Propagate state to stacked splitter
			_contextPaneSplitterStacked.setAttribute('state', this.collapsed ? 'collapsed' : 'open');
		}
		
		var height = null;
		if (_isStacked()) {
			height = 0;
			if (_contextPane.getAttribute('collapsed') != 'true') {
				height = _contextPaneInner.getBoundingClientRect().height;
			}
		}

		let tabContent = _getTabContent();
		if (tabContent) {
			tabContent.setBottomPlaceholderHeight(height);
			tabContent.setContextPaneOpen(!this.collapsed);
		}

		Object.assign(updatedState, this.updateLayout());
		this.updateAddToNote();

		ZoteroPane.updateLayoutConstraints();
		return updatedState;
	};

	this.togglePane = () => {
		this.collapsed = !this.collapsed;
	};

	function _loadSidePaneState() {
		let sidePaneState = Zotero.Prefs.get('sidePaneState') || "{}";
		try {
			sidePaneState = JSON.parse(sidePaneState);
		}
		catch {
			sidePaneState = {};
		}
		_sidePaneState = sidePaneState;
	}

	function _saveSidePaneState() {
		let sidePaneState;
		try {
			sidePaneState = JSON.stringify(_sidePaneState);
		}
		catch {
			// Default status if serialization fails
			sidePaneState = JSON.stringify({
				reader: {
					width: 0,
					open: false,
				},
				note: {
					width: 0,
					open: false,
				},
			});
		}
		Zotero.Prefs.set('sidePaneState', sidePaneState);
	}

	function _getTabContent(tabID) {
		if (!tabID) {
			tabID = Zotero_Tabs.selectedID;
		}
		return document.querySelector(`#${tabID}`);
	}

	function _isStacked() {
		return Zotero.Prefs.get('layout') == 'stacked';
	}

	function _isLibraryReadOnly(libraryID) {
		return !Zotero.Libraries.get(libraryID).editable;
	}
};
