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
					id="search-box" flex="1" onkeypress="this.closest('zoterosearch').handleKeyPress(event)">
				<hbox align="center">
					<label id="libraryMenu-label" value="&zotero.search.searchInLibrary;" control="libraryMenu"/>
					<menulist id="libraryMenu" aria-labelledby="libraryMenu-label" oncommand="this.closest('zoterosearch').updateLibrary();" native="true">
						<menupopup/>
					</menulist>
				</hbox>
				<groupbox>
					<caption align="center">
						<label id="joinModeMenu-label" value="&zotero.search.joinMode.prefix;"/>
						<menulist id="joinModeMenu" aria-labelledby="joinModeMenu-label" oncommand="this.closest('zoterosearch').updateJoinMode();" native="true">
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
					<checkbox id="recursiveCheckbox" label="&zotero.search.recursive.label;" oncommand="this.closest('zoterosearch').updateCheckbox('recursive');" native="true"/>
					<checkbox id="noChildrenCheckbox" label="&zotero.search.noChildren;" oncommand="this.closest('zoterosearch').updateCheckbox('noChildren');" native="true"/>
				</hbox>
				<hbox>
					<checkbox id="includeParentsAndChildrenCheckbox" label="&zotero.search.includeParentsAndChildren;" oncommand="this.closest('zoterosearch').updateCheckbox('includeParentsAndChildren');" native="true"/>
				</hbox>
			</vbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get search() {
			return this.searchRef;
		}

		set search(val) {
			this.searchRef = val;

			var libraryMenu = this.querySelector('#libraryMenu');
			var libraries = Zotero.Libraries.getAll();
			Zotero.Utilities.Internal.buildLibraryMenu(
				libraryMenu, libraries, this.searchRef.libraryID
			);
			if (this.searchRef.id) {
				libraryMenu.disabled = true;
			}
			this.updateLibrary();

			this.querySelector('#joinModeMenu').removeAttribute('condition');
			this.querySelector('#joinModeMenu').value = 'all';

			var conditionsBox = this.querySelector('#conditions');
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
						this.querySelector(`#${checkbox}`).setAttribute('condition', id);
						this.querySelector(`#${checkbox}`).checked = condition.operator == 'true';
						continue;
				}

				if (condition.condition == 'joinMode') {
					this.querySelector('#joinModeMenu').setAttribute('condition', id);
					this.querySelector('#joinModeMenu').value = condition.operator;
				}
				else {
					this.addCondition(condition);
				}
			}
		}

		addCondition(ref) {
			var conditionsBox = this.querySelector('#conditions');
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
			var conditionsBox = this.querySelector('#conditions');
			
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
			var menu = this.querySelector('#libraryMenu');
			var libraryID = parseInt(menu.selectedItem.value);
			
			if (this.onLibraryChange) {
				this.onLibraryChange(libraryID);
			}
			if (!this.searchRef.id) {
				this.searchRef.libraryID = libraryID;
			}
			
			[...this.querySelector('#conditions').childNodes].forEach(x => x.onLibraryChange());
		}

		updateJoinMode() {
			var menu = this.querySelector('#joinModeMenu');
			if(menu.hasAttribute('condition'))
				this.search.updateCondition(menu.getAttribute('condition'),'joinMode',menu.value,null);
			else
				menu.setAttribute('condition', this.search.addCondition('joinMode',menu.value,null));
		}

		updateCheckbox(condition) {
			var checkbox = this.querySelector('#' + condition + 'Checkbox');
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
			var conditionsBox = this.querySelector('#conditions');
			if (conditionsBox.hasChildNodes()) {
				for(var i = 0, len=conditionsBox.childNodes.length; i < len; i++) {
					conditionsBox.childNodes[i].updateSearch();
				}
			}
		}

		handleKeyPress(event) {
			// Space/Enter on toolbarbutton will click it
			if (event.target.tagName == "toolbarbutton" && [" ", "Enter"].includes(event.key)) {
				event.target.click();
				return;
			}
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

	class ZoteroSearchCondition extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="search-condition">
				<popupset id="condition-tooltips"/>
				
				<menulist id="conditionsmenu" oncommand="this.closest('zoterosearchcondition').onConditionSelected(event.target.value); event.stopPropagation()" native="true">
					<menupopup onpopupshown="this.closest('zoterosearchcondition').revealSelectedCondition()">
						<menu id="more-conditions-menu" label="&zotero.general.more;">
							<menupopup/>
						</menu>
					</menupopup>
				</menulist>
				<menulist id="operatorsmenu" oncommand="this.closest('zoterosearchcondition').onOperatorSelected(); event.stopPropagation()" native="true">
					<menupopup/>
				</menulist>
				<zoterosearchtextbox id="valuefield" class="valuefield"/>
				<menulist id="valuemenu" class="valuemenu" hidden="true" native="true">
					<menupopup/>
				</menulist>
				<zoterosearchagefield id="value-date-age" class="value-date-age" hidden="true"/>
				<toolbarbutton id="remove" tabindex="0" data-l10n-id="advanced-search-remove-btn" class="zotero-clicky zotero-clicky-minus" value="-" onclick="this.closest('zoterosearchcondition').onRemoveClicked(event)"/>
				<toolbarbutton id="add" tabindex="0" data-l10n-id="advanced-search-add-btn" class="zotero-clicky zotero-clicky-plus" value="+" onclick="this.closest('zoterosearchcondition').onAddClicked(event)"/>
			</html:div>
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
			var operatorsList = this.querySelector('#operatorsmenu');
			
			// Build operator menu
			for (let operator of operators) {
				operatorsList.appendItem(
					Zotero.getString('searchOperator.' + operator),
					operator
				);
			}
			
			// Build conditions menu
			var conditionsMenu = this.querySelector('#conditionsmenu');
			var moreConditionsMenu = this.querySelector('#more-conditions-menu');
			var conditions = Zotero.SearchConditions.getStandardConditions();
			
			for (let condition of conditions) {
				let menuitem;
				if (this.isPrimaryCondition(condition.name)) {
					menuitem = document.createXULElement('menuitem');
					menuitem.setAttribute('label', condition.localized);
					menuitem.setAttribute('value', condition.name);
					moreConditionsMenu.before(menuitem);
				}
				else {
					menuitem = moreConditionsMenu.appendItem(
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
					if (!this.querySelector('#' + condition.name + '-tooltip')) {
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
						
						this.querySelector('#condition-tooltips').appendChild(tt);
					}
					
					menuitem.setAttribute('tooltip', condition.name + '-tooltip');
				}
			}
			conditionsMenu.selectedIndex = 0;
		}

		isPrimaryCondition(condition) {
			switch (condition) {
				case 'anyField':
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
			var conditionsMenu = this.querySelector('#conditionsmenu');
			var operatorsList = this.querySelector('#operatorsmenu');
			
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
			
			this.updateMenuCheckboxesRecursive(conditionsMenu, this.selectedCondition);
			
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
			// Setting `selected` does not change `checked`. Should explicitly set it.
			operatorsList.selectedItem.setAttribute('checked', true);
			this.updateMenuCheckboxesRecursive(operatorsList, operatorsList.selectedItem.getAttribute('value'));
			
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
						this.querySelector('#value-date-age').value = this.value;
					}
					
					// Textbox
					else {
						// If switching from menu to textbox, clear value
						if (this.querySelector('#valuefield').hidden){
							this.querySelector('#valuefield').value = '';
						}
						// If switching between textbox conditions, get loaded value for new one
						else {
							this.querySelector('#valuefield').value = this.value;
						}
						
						// Update field drop-down if applicable
						this.querySelector('#valuefield').update(conditionName, this.mode);
					}
			}
			
			this.onOperatorSelected();
		}

		onOperatorSelected() {
			var operatorsList = this.querySelector('#operatorsmenu');
			
			// Drop-down menu
			if (this.selectedCondition == 'collection'
					|| this.selectedCondition == 'itemType'
					|| this.selectedCondition == 'fileTypeID') {
				this.querySelector('#valuefield').hidden = true;
				this.querySelector('#valuemenu').hidden = false;
				this.querySelector('#value-date-age').hidden = true;
			}
			
			// Textbox + units dropdown for isInTheLast operator
			else if (operatorsList.value=='isInTheLast')
			{
				// If switching from text field, clear value
				if (this.querySelector('#value-date-age').hidden){
					this.value = '';
				}
				this.querySelector('#valuefield').hidden = true;
				this.querySelector('#valuemenu').hidden = true;
				this.querySelector('#value-date-age').hidden = false;
			}
			
			// Textbox
			else
			{
				// If switching from date age, clear value
				if (this.querySelector('#valuefield').hidden){
					this.value = '';
				}
				this.querySelector('#valuefield').hidden = false;
				this.querySelector('#valuemenu').hidden = true;
				this.querySelector('#value-date-age').hidden = true;
			}
			var conditionsMenu = this.querySelector('#conditionsmenu');
			document.l10n.setAttributes(conditionsMenu, 'advanced-search-conditions-menu', { label: conditionsMenu.label });
			document.l10n.setAttributes(operatorsList, 'advanced-search-operators-menu', { label: operatorsList.label });
			var valueMenu = this.querySelector("#valuemenu");
			if (!valueMenu.hidden) {
				document.l10n.setAttributes(valueMenu, 'advanced-search-condition-input', { label: valueMenu.label });
			}
			this.updateMenuCheckboxesRecursive(operatorsList, operatorsList.selectedItem.getAttribute('value'));
		}

		createValueMenu(rows) {
			let valueMenu = this.querySelector('#valuemenu');

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
			var menu = this.querySelector('#conditionsmenu');
			
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
				this.querySelector('#operatorsmenu').value = condition['operator'];
				this.value = prefix +
					(condition.value ? condition.value : '');

				this.dontupdate = false;
			}
			
			this.onConditionSelected(menu.value);
		}

		updateSearch() {
			if(this.parent && this.parent.search && !this.dontupdate)
			{
				var condition = this.selectedCondition;
				var operator = this.querySelector('#operatorsmenu').value;
				
				// Regular text field
				if (!this.querySelector('#valuefield').hidden)
				{
					var value = this.querySelector('#valuefield').value;
					
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
					if (this.querySelector('#valuefield').mode){
						condition += '/' + this.querySelector('#valuefield').mode;
					}
				}
				
				// isInTheLast operator
				else if (!this.querySelector('#value-date-age').hidden)
				{
					var value = this.querySelector('#value-date-age').value;
				}
				
				// Handle special C1234 and S5678 form for
				// collections and searches
				else if (condition == 'collection') {
					var letter = this.querySelector('#valuemenu').value.substr(0,1);
					if (letter=='C')
					{
						condition = 'collection';
					}
					else if (letter=='S')
					{
						condition = 'savedSearch';
					}
					var value = this.querySelector('#valuemenu').value.substr(1);
				}
				
				// Regular drop-down menu
				else
				{
					var value = this.querySelector('#valuemenu').value;
				}
				this.parent.search.updateCondition(this.conditionID, condition, operator, value);
			}
		}

		updateMenuCheckboxesRecursive(menu, value) {
			for (let i = 0; i < menu.itemCount; i++) {
				let item = menu.getItemAtIndex(i);
				if (item.localName == 'menuitem') {
					if (item.getAttribute('value') == value) {
						item.setAttribute('checked', true);
					}
					else {
						item.removeAttribute('checked');
					}
				}
				else {
					this.updateMenuCheckboxesRecursive(item, value);
				}
			}
		}

		revealSelectedCondition(menu) {
			if (!this.selectedCondition || this.isPrimaryCondition(this.selectedCondition)) {
				return;
			}
			
			if (!menu) {
				menu = this.querySelector('#conditionsmenu');
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
				window.resizeBy(0, -1 * this.getBoundingClientRect().height);
				window.dispatchEvent(new CustomEvent('resize'));
				this.parent.removeCondition(this.conditionID);
			}
		}

		onAddClicked(event) {
			event.preventDefault();
			if (this.parent){
				let ref = this.parent.search.getCondition(
					this.parent.search.addCondition(
						this.querySelector('#conditionsmenu').getAttribute('data-value'),
						this.querySelector('#operatorsmenu').value,
						""
					)
				)
				this.parent.addCondition(ref);
				window.resizeBy(0, this.getBoundingClientRect().height);
			}
		}

		disableRemoveButton() {
			var button = this.querySelector("#remove");
			button.setAttribute('disabled', true);
			button.removeAttribute('onclick');
		}

		enableRemoveButton() {
			var button = this.querySelector("#remove");
			button.setAttribute('disabled', false);
			button.setAttribute('onclick', "this.closest('zoterosearchcondition').onRemoveClicked(event)");
		}
	}
	customElements.define("zoterosearchcondition", ZoteroSearchCondition);

	class ZoteroSearchTextbox extends XULElementBase {
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
					type="search"
					data-l10n-id="advanced-search-condition-input"
					/>
				
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
			return this.querySelector('#search-textbox').value;
		}

		set value(val) {
			this.querySelector('#search-textbox').value = val;
		}

		get mode() {
			if (this.getAttribute('hasOptions')!='true'){
				return false;
			}
			
			var menu = this.querySelector('#textbox-fulltext-menu');
			
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
			var textbox = this.querySelector('#search-textbox');
			var button = this.querySelector('#textbox-button');
			
			switch (condition){
				case 'fulltextContent':
					var menu = this.querySelector('#textbox-fulltext-menu');
					this.setAttribute('hasOptions', true);
					button.removeAttribute('hidden');
					
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

	class ZoteroSearchAgeField extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="search-in-the-last">
				<html:input class="input"/>
				<menulist class="age-list" native="true">
					<menupopup>
						<menuitem label="&zotero.search.date.units.days;" value="days" selected="true"/>
						<menuitem label="&zotero.search.date.units.months;" value="months"/>
						<menuitem label="&zotero.search.date.units.years;" value="years"/>
					</menupopup>
				</menulist>
			</html:div>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get value() {
			var input = this.querySelector('.input');
			var menulist = this.querySelector('.age-list');
			return input.value + ' '
				+ menulist.firstChild.childNodes[menulist.selectedIndex].getAttribute('value');
		}

		set value(val) {
			var input = this.querySelector('.input');

			var [num, units] = val.split(' ');
			input.setAttribute('value', num);
			
			var menulist = this.querySelector('.age-list');
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
			// Setting `selected` does not change `checked`. Should explicitly set it.
			menulist.selectedItem.setAttribute('checked', true);
		}
	}
	customElements.define("zoterosearchagefield", ZoteroSearchAgeField);
}
