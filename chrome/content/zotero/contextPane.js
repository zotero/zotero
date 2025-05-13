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
			_contextPaneSplitter.setAttribute('collapse', 'after');
			_contextPaneSplitterStacked.setAttribute('state', collapsed ? 'collapsed' : 'open');
			_contextPaneSplitterStacked.setAttribute('collapse', 'after');
			_update();
		}
	});

	this.update = _update;

	this.focus = () => {
		return _contextPaneInner.handleFocus();
	};

	this.showLoadingMessage = (isShow) => {
		_loadingMessageContainer.classList.toggle('hidden', !isShow);
	};

	this.updateAddToNote = _updateAddToNote;

	this.togglePane = _togglePane;

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
		
		_contextPaneInner.sidenav = _readerSidenav;

		this.context = _contextPaneInner;

		window.addEventListener('resize', _update);
		Zotero.Reader.onChangeSidebarWidth = _updatePaneWidth;
		Zotero.Reader.onToggleSidebar = _updatePaneWidth;
	};

	this.destroy = function () {
		window.removeEventListener('resize', _update);
		Zotero.Reader.onChangeSidebarWidth = () => {};
		Zotero.Reader.onToggleSidebar = () => {};
	};

	function _updateAddToNote() {
		let reader = Zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
		if (reader) {
			let editor = ZoteroContextPane.activeEditor;
			let libraryReadOnly = editor && editor.item && _isLibraryReadOnly(editor.item.libraryID);
			let noteReadOnly = editor && editor.item
				&& (editor.item.deleted || editor.item.parentItem && editor.item.parentItem.deleted);
			reader.enableAddToNote(!!editor && !libraryReadOnly && !noteReadOnly);
		}
	}
	
	function _updatePaneWidth() {
		let stacked = _isStacked();
		let width = Zotero.Reader.getSidebarWidth() + 'px';
		if (!Zotero.Reader.getSidebarOpen()) {
			width = 0;
		}
		let contextPaneWidth = _contextPane.getAttribute("width");
		if (contextPaneWidth && !_contextPane.style.width) {
			_contextPane.style.width = `${contextPaneWidth}px`;
		}
		if (Zotero.rtl) {
			_contextPane.style.left = 0;
			_contextPane.style.right = stacked ? width : 'unset';
		}
		else {
			_contextPane.style.left = stacked ? width : 'unset';
			_contextPane.style.right = 0;
		}
	}

	function _isStacked() {
		return Zotero.Prefs.get('layout') == 'stacked';
	}

	function _update() {
		if (Zotero_Tabs.selectedIndex == 0) {
			return;
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
		}
		
		if (Zotero_Tabs.selectedIndex > 0) {
			var height = null;
			if (_isStacked()) {
				height = 0;
				if (_contextPane.getAttribute('collapsed') != 'true') {
					height = _contextPaneInner.getBoundingClientRect().height;
				}
			}
			Zotero.Reader.setBottomPlaceholderHeight(height);
		}
		
		_updatePaneWidth();
		_updateAddToNote();

		ZoteroPane.updateLayoutConstraints();
	}
	
	function _isLibraryReadOnly(libraryID) {
		return !Zotero.Libraries.get(libraryID).editable;
	}

	function _togglePane() {
		this.collapsed = !this.collapsed;
	}
};
