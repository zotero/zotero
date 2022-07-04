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
	var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

	Services.scriptloader.loadSubScript("chrome://global/content/customElements.js", this);
	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);
	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/shadowAutocompleteInput.js", this);

	class SearchElementBase extends XULElementBase {
		get stylesheets() {
			return [
				'chrome://global/skin/global.css',
				'chrome://zotero-platform/content/zoteroSearch.css'
			];
		}
	}

	class ZoteroSearch extends SearchElementBase {
		content = MozXULElement.parseXULToFragment(`
			<vbox xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
					id="search-box" flex="1" onkeypress="this.getRootNode().host.handleKeyPress(event)">
				<hbox align="center">
					<label value="&zotero.search.searchInLibrary;" control="libraryMenu"/>
					<menulist id="libraryMenu" oncommand="this.getRootNode().host.updateLibrary();" native="true">
						<menupopup/>
					</menulist>
				</hbox>
				<groupbox>
					<caption align="center">
						<label value="&zotero.search.joinMode.prefix;"/>
						<menulist id="joinModeMenu" oncommand="this.getRootNode().host.updateJoinMode();" native="true">
							<menupopup>
								<menuitem label="&zotero.search.joinMode.any;" value="any"/>
								<menuitem label="&zotero.search.joinMode.all;" value="all" selected="true"/>
							</menupopup>
						</menulist>
						<label value="&zotero.search.joinMode.suffix;"/>
					</caption>
					<vbox id="conditions"/>
				</groupbox>
				<hbox>
					<checkbox id="recursiveCheckbox" label="&zotero.search.recursive.label;" oncommand="this.getRootNode().host.updateCheckbox('recursive');" native="true"/>
					<checkbox id="noChildrenCheckbox" label="&zotero.search.noChildren;" oncommand="this.getRootNode().host.updateCheckbox('noChildren');" native="true"/>
				</hbox>
				<hbox>
					<checkbox id="includeParentsAndChildrenCheckbox" label="&zotero.search.includeParentsAndChildren;" oncommand="this.getRootNode().host.updateCheckbox('includeParentsAndChildren');" native="true"/>
				</hbox>
			</vbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get search() {
			return this.searchRef;
		}

		set search(val) {
			this.searchRef = val;

			var libraryMenu = this.shadowRoot.getElementById('libraryMenu');
			var libraries = Zotero.Libraries.getAll();
			Zotero.Utilities.Internal.buildLibraryMenu(
				libraryMenu, libraries, this.searchRef.libraryID
			);
			if (this.searchRef.id) {
				libraryMenu.disabled = true;
			}
			this.updateLibrary();


			var conditionsBox = this.shadowRoot.getElementById('conditions');
			while (conditionsBox.hasChildNodes())
				conditionsBox.removeChild(conditionsBox.firstChild);

			var conditions = this.search.getConditions();
			for (let id in conditions) {
				let condition = conditions[id];
				// Checkboxes
				switch (condition.condition) {
					case 'recursive':
					case 'noChildren':
					case 'includeParentsAndChildren':
						let checkbox = condition.condition + 'Checkbox';
						this.shadowRoot.getElementById(checkbox).setAttribute('condition', id);
						this.shadowRoot.getElementById(checkbox).checked = condition.operator == 'true';
						continue;
				}

				if (condition.condition == 'joinMode') {
					this.shadowRoot.getElementById('joinModeMenu').setAttribute('condition', id);
					this.shadowRoot.getElementById('joinModeMenu').value = condition.operator;
				}
				else {
					this.addCondition(condition);
				}
			}
		}

		addCondition(ref) {
			var conditionsBox = this.shadowRoot.getElementById('conditions');
			var condition = document.createXULElement('zoterosearchcondition');
			condition.setAttribute('flex', '1');
			
			conditionsBox.appendChild(condition);
			
			// Default to an empty 'title' condition
			if (!ref) {
				ref = this.search.getCondition(this.search.addCondition("title","contains",""))
			}
			
			condition.initWithParentAndCondition(this, ref);
			
			if (conditionsBox.childNodes.length == 2){
				conditionsBox.childNodes[0].enableRemoveButton();
			}
			else if (conditionsBox.childNodes.length == 1){
				conditionsBox.childNodes[0].disableRemoveButton();
			}
		}

		removeCondition(id) {
			var conditionsBox = this.shadowRoot.getElementById('conditions');
			
			this.search.removeCondition(id);
			
			for (var i = 0, len=conditionsBox.childNodes.length; i < len; i++){
				if (conditionsBox.childNodes[i].conditionID == id){
					conditionsBox.removeChild(conditionsBox.childNodes[i]);
					break;
				}
			}
			
			if (conditionsBox.childNodes.length == 1){
				conditionsBox.childNodes[0].disableRemoveButton();
			}
		}

		updateLibrary() {
			var menu = this.shadowRoot.getElementById('libraryMenu');
			var libraryID = parseInt(menu.selectedItem.value);
			
			if (this.onLibraryChange) {
				this.onLibraryChange(libraryID);
			}
			if (!this.searchRef.id) {
				this.searchRef.libraryID = libraryID;
			}
			
			[...this.shadowRoot.getElementById('conditions').childNodes].forEach(x => x.onLibraryChange());
		}

		updateJoinMode() {
			var menu = this.shadowRoot.getElementById('joinModeMenu');
			if(menu.hasAttribute('condition'))
				this.search.updateCondition(menu.getAttribute('condition'),'joinMode',menu.value,null);
			else
				menu.setAttribute('condition', this.search.addCondition('joinMode',menu.value,null));
		}

		updateCheckbox(condition) {
			var checkbox = this.shadowRoot.getElementById(condition + 'Checkbox');
			var value = checkbox.checked ? 'true' : 'false';
			if(checkbox.hasAttribute('condition'))
			{
				this.search.updateCondition(checkbox.getAttribute('condition'),
					condition, value, null);
			}
			else
			{
				checkbox.setAttribute('condition',
					this.search.addCondition(condition, value, null));
			}
		}

		// Calls updateSearch() on all search conditions
		updateSearch() {
			var conditionsBox = this.shadowRoot.getElementById('conditions');
			if (conditionsBox.hasChildNodes()) {
				for(var i = 0, len=conditionsBox.childNodes.length; i < len; i++) {
					conditionsBox.childNodes[i].updateSearch();
				}
			}
		}

		handleKeyPress(event) {
			switch (event.keyCode) {
				case event.DOM_VK_RETURN:
					this.active = true;
					
					if (event.shiftKey) {
						this.addCondition();
					}
					else {
						this.doCommand();
					}
					break;
			}
		}
	}
	customElements.define("zoterosearch", ZoteroSearch);

	class ZoteroSearchCondition extends SearchElementBase {
		content = MozXULElement.parseXULToFragment(`
			<xul:hbox id="search-condition" xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
					flex="1">
				<xul:popupset id="condition-tooltips"/>
				
				<xul:menulist id="conditionsmenu" oncommand="this.getRootNode().host.onConditionSelected(event.target.value); event.stopPropagation()" native="true">
					<xul:menupopup onpopupshown="this.getRootNode().host.revealSelectedCondition()">
						<xul:menu id="more-conditions-menu" label="&zotero.general.more;">
							<xul:menupopup/>
						</xul:menu>
					</xul:menupopup>
				</xul:menulist>
				<xul:menulist id="operatorsmenu" oncommand="this.getRootNode().host.onOperatorSelected(); event.stopPropagation()" native="true">
					<xul:menupopup/>
				</xul:menulist>
				<xul:zoterosearchtextbox id="valuefield" flex="1"/>
				<xul:menulist id="valuemenu" flex="1" hidden="true" native="true">
					<xul:menupopup/>
				</xul:menulist>
				<xul:zoterosearchagefield id="value-date-age" hidden="true" flex="1"/>
				<xul:label id="remove" class="zotero-clicky zotero-clicky-minus" value="-" onclick="this.getRootNode().host.onRemoveClicked(event)"/>
				<xul:label id="add" class="zotero-clicky zotero-clicky-plus" value="+" onclick="this.getRootNode().host.onAddClicked(event)"/>
			</xul:hbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		init() {
			var operators = [
				'is',
				'isNot',
				'beginsWith',
				'contains',
				'doesNotContain',
				'isLessThan',
				'isGreaterThan',
				'isBefore',
				'isAfter',
				'isInTheLast'
			];
			var operatorsList = this.shadowRoot.getElementById('operatorsmenu');
			
			// Build operator menu
			for (let operator of operators) {
				operatorsList.appendItem(
					Zotero.getString('searchOperator.' + operator),
					operator
				);
			}
			
			// Build conditions menu
			var conditionsMenu = this.shadowRoot.getElementById('conditionsmenu');
			var moreConditionsMenu = this.shadowRoot.getElementById('more-conditions-menu');
			var conditions = Zotero.SearchConditions.getStandardConditions();
			
			for (let condition of conditions) {
				if (this.isPrimaryCondition(condition.name)) {
					var menuitem = document.createXULElement('menuitem');
					menuitem.setAttribute('label', condition.localized);
					menuitem.setAttribute('value', condition.name);
					moreConditionsMenu.before(menuitem);
				}
				else {
					var menuitem = moreConditionsMenu.appendItem(
						condition.localized, condition.name
					);
				}
				
				var baseFields = null;
				try {
					baseFields = Zotero.ItemFields.getTypeFieldsFromBase(condition.name);
				}
				catch (e) {}
				
				// Add tooltip, building it if it doesn't exist
				if (baseFields) {
					if (!this.shadowRoot.getElementById(condition.name + '-tooltip')) {
						var fieldName = null;
						try {
							fieldName = Zotero.ItemFields.getLocalizedString(condition.name);
						}
						catch (e) {}
						
						if (fieldName) {
							var localized = [fieldName];
						}
						else {
							var localized = [];
						}
						
						for (let baseField of baseFields) {
							var str = Zotero.SearchConditions.getLocalizedName(
								Zotero.ItemFields.getName(baseField)
							);
							
							if (localized.indexOf(str) == -1) {
								localized.push(str);
							}
						}
						localized.sort();
						
						var tt = document.createXULElement('tooltip');
						tt.setAttribute('id', condition.name + '-tooltip');
						tt.setAttribute('noautohide', true);
						
						var hbox = document.createXULElement('hbox');
						
						var label = document.createXULElement('label');
						label.setAttribute('value', Zotero.getString('searchConditions.tooltip.fields'));
						hbox.appendChild(label);
						var vbox = document.createXULElement('vbox');
						for (let str of localized) {
							let label = document.createXULElement('label');
							label.setAttribute('value', str);
							vbox.appendChild(label);
						}
						hbox.appendChild(vbox);
						tt.appendChild(hbox);
						
						this.shadowRoot.getElementById('condition-tooltips').appendChild(tt);
					}
					
					menuitem.setAttribute('tooltip', condition.name + '-tooltip');
				}
			}
			conditionsMenu.selectedIndex = 0;
		}

		isPrimaryCondition(condition) {
			switch (condition) {
				case 'collection':
				case 'creator':
				case 'title':
				case 'date':
				case 'dateAdded':
				case 'dateModified':
				case 'itemType':
				case 'fileTypeID':
				case 'publicationTitle':
				case 'tag':
				case 'note':
				case 'childNote':
				case 'fulltextContent':
					return true;
			}
			
			return false;
		}

		onConditionSelected(conditionName, reload) {
			var conditionsMenu = this.shadowRoot.getElementById('conditionsmenu');
			var operatorsList = this.shadowRoot.getElementById('operatorsmenu');
			
			// Skip if no condition or correct condition already selected
			if (!conditionName || (conditionName == this.selectedCondition && !reload)) {
				return;
			}
			
			this.selectedCondition = conditionName;
			this.selectedOperator = operatorsList.value;
			
			var condition = Zotero.SearchConditions.get(conditionName);
			var operators = condition.operators;
			
			conditionsMenu.value = conditionName;
			// Store in attribute as well because the value doesn't get set properly when
			// the value is from a menuitem in the More menu, and we need this to select
			// the previous condition when creating a new row
			conditionsMenu.setAttribute('data-value', conditionName);
			
			// Parent state isn't set automatically for submenu selections
			if (!this.isPrimaryCondition(conditionName)) {
				conditionsMenu.selectedIndex = -1;
				conditionsMenu.setAttribute(
					'label',
					Zotero.SearchConditions.getLocalizedName(conditionName)
				);
			}
			
			this.updateSubmenuCheckboxes(conditionsMenu);
			
			// Display appropriate operators for condition
			var selectThis;
			for(var i = 0, len = operatorsList.firstChild.childNodes.length; i < len; i++)
			{
				var val = operatorsList.firstChild.childNodes[i].getAttribute('value');
				var hidden = !operators[val];
				operatorsList.firstChild.childNodes[i].setAttribute('hidden', hidden);
				if (!hidden && (selectThis == null || this.selectedOperator == val))
				{
					selectThis = i;
				}
			}
			operatorsList.selectedIndex = selectThis;
			
			// Generate drop-down menu instead of textbox for certain conditions
			switch (conditionName) {
				case 'collection':
					var rows = [];
					
					var libraryID = this.parent.search.libraryID;
					
					// Add collections
					let cols = Zotero.Collections.getByLibrary(libraryID, true);
					for (let col of cols) {
						// Indent subcollections
						var indent = '';
						if (col.level) {
							for (let j = 1; j < col.level; j++) {
								indent += '    ';
							}
							indent += '- ';
						}
						rows.push({
							name: indent + col.name,
							value: 'C' + col.key,
							image: Zotero.Collection.prototype.treeViewImage
						});
					}
					
					// Add saved searches
					let searches = Zotero.Searches.getByLibrary(libraryID);
					for (let search of searches) {
						if (search.id != this.parent.search.id) {
							rows.push({
								name: search.name,
								value: 'S' + search.key,
								image: Zotero.Search.prototype.treeViewImage
							});
						}
					}
					this.createValueMenu(rows);
					break;
				
				case 'itemType':
					var rows = Zotero.ItemTypes.getTypes().map(type => ({
						name: Zotero.ItemTypes.getLocalizedString(type.id),
						value: type.name
					}));
					
					// Sort by localized name
					var collation = Zotero.getLocaleCollation();
					rows.sort((a, b) => collation.compareString(1, a.name, b.name));
					
					this.createValueMenu(rows);
					break;
				
				case 'fileTypeID':
					var rows = Zotero.FileTypes.getTypes().map(type => ({
						name: Zotero.getString('fileTypes.' + type.name),
						value: type.id
					}));
					
					// Sort by localized name
					var collation = Zotero.getLocaleCollation();
					rows.sort((a, b) => collation.compareString(1, a.name, b.name));
					
					this.createValueMenu(rows);
					break;
				
				default:
					if (operatorsList.value=='isInTheLast')
					{
						this.shadowRoot.getElementById('value-date-age').value = this.value;
					}
					
					// Textbox
					else {
						// If switching from menu to textbox, clear value
						if (this.shadowRoot.getElementById('valuefield').hidden){
							this.shadowRoot.getElementById('valuefield').value = '';
						}
						// If switching between textbox conditions, get loaded value for new one
						else {
							this.shadowRoot.getElementById('valuefield').value = this.value;
						}
						
						// Update field drop-down if applicable
						this.shadowRoot.getElementById('valuefield').update(conditionName, this.mode);
					}
			}
			
			this.onOperatorSelected();
		}

		onOperatorSelected() {
			var operatorsList = this.shadowRoot.getElementById('operatorsmenu');
			
			// Drop-down menu
			if (this.selectedCondition == 'collection'
					|| this.selectedCondition == 'itemType'
					|| this.selectedCondition == 'fileTypeID') {
				this.shadowRoot.getElementById('valuefield').hidden = true;
				this.shadowRoot.getElementById('valuemenu').hidden = false;
				this.shadowRoot.getElementById('value-date-age').hidden = true;
			}
			
			// Textbox + units dropdown for isInTheLast operator
			else if (operatorsList.value=='isInTheLast')
			{
				// If switching from text field, clear value
				if (this.shadowRoot.getElementById('value-date-age').hidden){
					this.value = '';
				}
				this.shadowRoot.getElementById('valuefield').hidden = true;
				this.shadowRoot.getElementById('valuemenu').hidden = true;
				this.shadowRoot.getElementById('value-date-age').hidden = false;
			}
			
			// Textbox
			else
			{
				// If switching from date age, clear value
				if (this.shadowRoot.getElementById('valuefield').hidden){
					this.value = '';
				}
				this.shadowRoot.getElementById('valuefield').hidden = false;
				this.shadowRoot.getElementById('valuemenu').hidden = true;
				this.shadowRoot.getElementById('value-date-age').hidden = true;
			}
		}

		createValueMenu(rows) {
			let valueMenu = this.shadowRoot.getElementById('valuemenu');

			while (valueMenu.hasChildNodes()){
				valueMenu.removeChild(valueMenu.firstChild);
			}
			
			for (let row of rows) {
				let menuitem = valueMenu.appendItem(row.name, row.value);
				if (row.image) {
					menuitem.className = 'menuitem-iconic';
					menuitem.setAttribute('image', row.image);
				}
			}
			valueMenu.selectedIndex = 0;
			
			if (this.value)
			{
				valueMenu.value = this.value;
			}

			valueMenu.shadowRoot.querySelector('#label-box > image').style.maxHeight = '16px';
		}

		initWithParentAndCondition(parent, condition) {
			this.parent = parent;
			this.conditionID = condition['id'];
			var menu = this.shadowRoot.getElementById('conditionsmenu');
			
			if(this.parent.search)
			{
				this.dontupdate = true;	//so that the search doesn't get updated while we are creating controls.
				var prefix = '';
				
				// Handle special conditions
				switch (condition.condition) {
					case 'savedSearch':
						prefix = 'S';
						break;
					
					case 'collection':
						prefix = 'C';
						break;
				}
				
				// Map certain conditions to other menu items
				let uiCondition = condition.condition;
				switch (condition.condition) {
					case 'savedSearch':
						uiCondition = 'collection';
						break;
				}
				
				menu.setAttribute('value', uiCondition);
				
				// Convert datetimes from UTC to localtime
				if ((condition['condition']=='accessDate' ||
						condition['condition']=='dateAdded' ||
						condition['condition']=='dateModified') &&
						Zotero.Date.isSQLDateTime(condition['value'])){
					
					condition['value'] =
						Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(condition['value'], true));
				}
				
				this.mode = condition['mode'];
				this.shadowRoot.getElementById('operatorsmenu').value = condition['operator'];
				this.value = prefix +
					(condition.value ? condition.value : '');

				this.dontupdate = false;
			}
			
			this.onConditionSelected(menu.value);
			
			this.shadowRoot.getElementById('conditionsmenu').focus();
		}

		updateSearch() {
			if(this.parent && this.parent.search && !this.dontupdate)
			{
				var condition = this.selectedCondition;
				var operator = this.shadowRoot.getElementById('operatorsmenu').value;
				
				// Regular text field
				if (!this.shadowRoot.getElementById('valuefield').hidden)
				{
					var value = this.shadowRoot.getElementById('valuefield').value;
					
					// Convert datetimes to UTC before saving
					switch (condition) {
						case 'accessDate':
						case 'dateAdded':
						case 'dateModified':
							if (Zotero.Date.isSQLDateTime(value)) {
								var value = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(value), true);
							}
					}
					
					// Append mode to condition
					if (this.shadowRoot.getElementById('valuefield').mode){
						condition += '/' + this.shadowRoot.getElementById('valuefield').mode;
					}
				}
				
				// isInTheLast operator
				else if (!this.shadowRoot.getElementById('value-date-age').hidden)
				{
					var value = this.shadowRoot.getElementById('value-date-age').value;
				}
				
				// Handle special C1234 and S5678 form for
				// collections and searches
				else if (condition == 'collection') {
					var letter = this.shadowRoot.getElementById('valuemenu').value.substr(0,1);
					if (letter=='C')
					{
						condition = 'collection';
					}
					else if (letter=='S')
					{
						condition = 'savedSearch';
					}
					var value = this.shadowRoot.getElementById('valuemenu').value.substr(1);
				}
				
				// Regular drop-down menu
				else
				{
					var value = this.shadowRoot.getElementById('valuemenu').value;
				}
				this.parent.search.updateCondition(this.conditionID, condition, operator, value);
			}
		}

		updateSubmenuCheckboxes(menu) {
			for (let i = 0; i < menu.itemCount; i++) {
				let item = menu.getItemAtIndex(i);
				if (item.localName == 'menuitem') {
					if (item.getAttribute('value') == this.selectedCondition) {
						item.setAttribute('checked', true);
					}
					else {
						item.removeAttribute('checked');
					}
				}
				else {
					this.updateSubmenuCheckboxes(item);
				}
			}
		}

		revealSelectedCondition(menu) {
			if (!this.selectedCondition || this.isPrimaryCondition(this.selectedCondition)) {
				return;
			}
			
			if (!menu) {
				menu = this.shadowRoot.getElementById('conditionsmenu');
			}
			for (let i = 0; i < menu.itemCount; i++) {
				let item = menu.getItemAtIndex(i);
				if (item.localName == 'menuitem') {
					if (item.getAttribute('value') == this.selectedCondition) {
						menu.open = true;
						return true;
					}
				}
				else {
					var opened = this.revealSelectedCondition(item);
					if (opened) {
						return true;
					}
				}
			}
			
			return false;
		}

		onLibraryChange() {
			switch (this.selectedCondition) {
			case 'collection':
				this.onConditionSelected(this.selectedCondition, true);
				break;
			}
		}

		onRemoveClicked() {
			if (this.parent){
				this.parent.removeCondition(this.conditionID);
				window.sizeToContent()
			}
		}

		onAddClicked() {
			if (this.parent){
				let ref = this.parent.search.getCondition(
					this.parent.search.addCondition(
						this.shadowRoot.getElementById('conditionsmenu').getAttribute('data-value'),
						this.shadowRoot.getElementById('operatorsmenu').value,
						""
					)
				)
				this.parent.addCondition(ref);
				window.sizeToContent();
			}
		}

		disableRemoveButton() {
			var button = this.shadowRoot.getElementById("remove");
			button.setAttribute('disabled', true);
			button.removeAttribute('onclick');
		}

		enableRemoveButton() {
			var button = this.shadowRoot.getElementById("remove");
			button.setAttribute('disabled', false);
			button.setAttribute('onclick', "this.getRootNode().host.onRemoveClicked(event)");
		}
	}
	customElements.define("zoterosearchcondition", ZoteroSearchCondition);

	class ZoteroSearchTextbox extends SearchElementBase {
		content = MozXULElement.parseXULToFragment(`
			<xul:stack
					xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
					xmlns:html="http://www.w3.org/1999/xhtml"
					flex="1">
				<html:input id="search-textbox"
					is="shadow-autocomplete-input"
					autocompletesearch="zotero"
					autocompletepopup="search-autocomplete-popup"
					timeout="250"
					type="search"/>
				
				<xul:toolbarbutton
						id="textbox-button"
						type="menu">
					<dropmarker type="menu" class="toolbarbutton-menu-dropmarker"/>
					<xul:menupopup id="textbox-fulltext-menu">
						<xul:menuitem type="radio" label="&zotero.search.textModes.phrase;"/>
						<xul:menuitem type="radio" label="&zotero.search.textModes.phraseBinary;"/>
						<xul:menuitem type="radio" label="&zotero.search.textModes.regexp;"/>
						<xul:menuitem type="radio" label="&zotero.search.textModes.regexpCS;"/>
					</xul:menupopup>
				</xul:toolbarbutton>
			</xul:stack>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get value() {
			return this.shadowRoot.getElementById('search-textbox').value;
		}

		set value(val) {
			this.shadowRoot.getElementById('search-textbox').value = val;
		}

		get mode() {
			if (this.getAttribute('hasOptions')!='true'){
				return false;
			}
			
			var menu = this.shadowRoot.getElementById('textbox-fulltext-menu');
			
			var selectedIndex = -1;
			for (var i=0; i<menu.childNodes.length; i++){
				if (menu.childNodes[i].getAttribute('checked')=='true'){
					selectedIndex = i;
					break;
				}
			}
			switch (selectedIndex){
				case 0:
					return false;
				
				case 1:
					return 'phraseBinary';
				
				case 2:
					return 'regexp';
				
				case 3:
					return 'regexpCS';
			}
			
			throw new Error('Invalid search textbox popup');
		}

		update(condition, mode) {
			var textbox = this.shadowRoot.getElementById('search-textbox');
			var button = this.shadowRoot.getElementById('textbox-button');
			
			switch (condition){
				case 'fulltextContent':
					var menu = this.shadowRoot.getElementById('textbox-fulltext-menu');
					this.setAttribute('hasOptions', true);
					button.setAttribute('hidden', false);
					
					var selectedIndex = 0;
					if (mode){
						switch (mode){
							case 'phrase':
								selectedIndex = 0;
								break;
							
							case 'phraseBinary':
								selectedIndex = 1;
								break;
							
							case 'regexp':
								selectedIndex = 2;
								break;
							
							case 'regexpCS':
								selectedIndex = 3;
								break;
						}
					}
					menu.childNodes[selectedIndex].setAttribute('checked', true);
					textbox.setAttribute('disableautocomplete', 'true');
					break;
					
				default:
					this.setAttribute('hasOptions', false);
					button.setAttribute('hidden', true);
					
					// Set textbox to autocomplete mode
					switch (condition)
					{
						// Skip autocomplete for these fields
						case 'date':
						case 'note':
						case 'extra':
							textbox.setAttribute('disableautocomplete', 'true');
							break;
						
						default:
							textbox.setAttribute('disableautocomplete', 'false');
							
							// TODO: Provide current libraryID
							var autocompleteParams = {
								fieldName: condition
							};
							switch (condition) {
								case 'creator':
								case 'author':
								case 'bookAuthor':
								case 'editor':
									autocompleteParams.fieldMode = 2;
									break;
							}
							textbox.setAttribute(
								'autocompletesearchparam',
								JSON.stringify(autocompleteParams)
							);
					}
			}
		}
	}
	customElements.define("zoterosearchtextbox", ZoteroSearchTextbox);

	class ZoteroSearchAgeField extends SearchElementBase {
		content = MozXULElement.parseXULToFragment(`
			<xul:hbox id="search-in-the-last" flex="1"
					xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
					xmlns:html="http://www.w3.org/1999/xhtml">
				<html:input id="input" style="-moz-box-flex: 1"/>
				<xul:menulist id="age-list" native="true">
					<xul:menupopup flex="1">
						<xul:menuitem label="&zotero.search.date.units.days;" value="days" selected="true"/>
						<xul:menuitem label="&zotero.search.date.units.months;" value="months"/>
						<xul:menuitem label="&zotero.search.date.units.years;" value="years"/>
					</xul:menupopup>
				</xul:menulist>
			</xul:hbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get value() {
			var input = this.shadowRoot.getElementById('input');
			var menulist = this.shadowRoot.getElementById('age-list');
			return input.value + ' '
				+ menulist.firstChild.childNodes[menulist.selectedIndex].getAttribute('value');
		}

		set value(val) {
			var input = this.shadowRoot.getElementById('input');

			var [num, units] = val.split(' ');
			input.setAttribute('value', num);
			
			var menulist = this.shadowRoot.getElementById('age-list');
			var menupopup = menulist.firstChild;
			
			var selectThis = 0;
			for (var i=0; i<menupopup.childNodes.length; i++){
				if (menupopup.childNodes[i].value == units)
				{
					selectThis = i;
					break;
				}
			}
			menulist.selectedIndex = selectThis;
		}
	}
	customElements.define("zoterosearchagefield", ZoteroSearchAgeField);
}
