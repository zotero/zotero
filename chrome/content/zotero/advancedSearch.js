var ZoteroAdvancedSearch = new function() {
	this.onLoad = onLoad;
	this.search = search;
	this.clear = clear;
	this.save = save;
	this.onDblClick = onDblClick;
	this.onUnload = onUnload;
	
	this.itemsView = false;
	
	var _searchBox;
	
	function onLoad() {
		_searchBox = document.getElementById('zotero-search-box');
		
		// Set font size from pref
		var sbc = document.getElementById('zotero-search-box-container');
		Zotero.setFontSize(sbc);
		
		var io = window.arguments[0];
		_searchBox.search = io.dataIn.search;
	}
	
	
	function search() {
		_searchBox.updateSearch();
		
		// A minimal implementation of Zotero.CollectionTreeView
		var itemGroup = {
			isSearchMode: function() { return true; },
			getChildItems: function () {
				var search = _searchBox.search.clone();
				// FIXME: Hack to exclude group libraries for now
				var groups = Zotero.Groups.getAll();
				for each(var group in groups) {
					search.addCondition('libraryID', 'isNot', group.libraryID);
				}
				//var search = _searchBox.search;
				var ids = search.search();
				return Zotero.Items.get(ids);
			},
			isLibrary: function () { return false; },
			isCollection: function () { return false; },
			isSearch: function () { return true; },
			isShare: function () { return true; },
			isTrash: function () { return false; }
		}
		
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		
		this.itemsView = new Zotero.ItemTreeView(itemGroup, false);
		document.getElementById('zotero-items-tree').view = this.itemsView;
	}
	
	
	function clear() {
		if (this.itemsView) {
			this.itemsView.unregister();
		}
		document.getElementById('zotero-items-tree').view = null;
		
		var s = new Zotero.Search();
		s.addCondition('title', 'contains', '');
		_searchBox.search = s;
	}
	
	
	function save() {
		_searchBox.updateSearch();
		
		var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		
		var untitled = Zotero.DB.getNextName('collections', 'collectionName',
			Zotero.getString('pane.collections.untitled'));
		
		var name = { value: untitled };
		var result = promptService.prompt(window,
			Zotero.getString('pane.collections.newSavedSeach'),
			Zotero.getString('pane.collections.savedSearchName'), name, "", {});
		
		if (!result)
		{
			return;
		}
		
		if (!name.value)
		{
			newName.value = untitled;
		}
		
		var s = _searchBox.search.clone();
		s.setName(name.value);
		s.save();
	}
	
	
	// Adapted from: http://www.xulplanet.com/references/elemref/ref_tree.html#cmnote-9
	function onDblClick(event, tree)
	{
		if (event && tree && event.type == "dblclick")
		{
			var row = {}, col = {}, obj = {};
			tree.treeBoxObject.getCellAt(event.clientX, event.clientY, row, col, obj);
			// obj.value == cell/text/image
			// TODO: handle collection double-click
			if (obj.value && this.itemsView && this.itemsView.selection.currentIndex > -1)
			{
				var item = this.itemsView.getSelectedItems()[0];
				
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
							   .getService(Components.interfaces.nsIWindowMediator);
				
				var lastWin = wm.getMostRecentWindow("navigator:browser");
				
				if (!lastWin) {
					window.open();
					var newWindow = wm.getMostRecentWindow("navigator:browser");
					var b = newWindow.getBrowser();
					return;
				}
				
				if (lastWin.document.getElementById('zotero-pane').getAttribute('hidden') == 'true') {
					lastWin.ZoteroPane.toggleDisplay();
				}
				
				lastWin.ZoteroPane.selectItem(item.getID(), false, true);
				lastWin.focus();
			}
		}
	}
	
	
	this.startDrag = function (event, element) {
		if (Zotero.isFx2 || Zotero.isFx30) {
			nsDragAndDrop.startDrag(event, element);
			return;
		}
		element.onDragStart(event);
	}
	
	
	function onUnload() {
		// Unregister search from Notifier
		if (this.itemsView) {
			this.itemsView.unregister();
		}
	}
}
