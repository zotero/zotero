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
			<search-condition-group root="true"/>
			<hbox id="search-option-checkboxes">
				<checkbox id="recursiveCheckbox" label="&zotero.search.recursive.label;" native="true"/>
				<checkbox id="noChildrenCheckbox" label="&zotero.search.noChildren;" native="true"/>
				<checkbox id="includeParentsAndChildrenCheckbox" label="&zotero.search.includeParentsAndChildren;" native="true"/>
			</hbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		get search() {
			return this.searchRef;
		}

		set search(val) {
			this.searchRef = val;
			// Setting condition controls' values during a render shouldn't trigger a
			// rebuild of the search from the half-built tree
			this._rendering = true;
			try {
				this.renderConditions();
			}
			finally {
				this._rendering = false;
			}
		}

		init() {
			this.rootGroup = this.querySelector('search-condition-group[root]');
			this.addEventListener('keypress', event => this.handleKeyPress(event));
			// Re-evaluate which remove buttons are enabled as the conditions change
			this.addEventListener('input', () => this.updateRemoveButtons());
			this.addEventListener('command', () => this.updateRemoveButtons());
		}

		// Build the condition tree (root group, nested groups, and search-global
		// checkboxes) from the search's flat condition list
		renderConditions() {
			var root = this.rootGroup;

			for (let name of ['recursive', 'noChildren', 'includeParentsAndChildren']) {
				this.querySelector('#' + name + 'Checkbox').checked = false;
			}

			root.clear();

			// Walk the flat conditions, pushing/popping a group stack on the group
			// markers. A 'joinMode' applies to the group on top of the stack; anything
			// else becomes a condition row or a nested group within it.
			var stack = [root];
			var conditions = this.search.getConditions();
			for (let id in conditions) {
				let condition = conditions[id];
				switch (condition.condition) {
					case 'recursive':
					case 'noChildren':
					case 'includeParentsAndChildren':
						this.querySelector('#' + condition.condition + 'Checkbox').checked
							= condition.operator == 'true';
						continue;

					case 'joinMode':
						stack[stack.length - 1].joinMode = condition.operator;
						continue;

					case 'groupStart': {
						let group = document.createXULElement('search-condition-group');
						stack[stack.length - 1].conditionsContainer.appendChild(group);
						stack.push(group);
						continue;
					}

					case 'groupEnd':
						if (stack.length > 1) {
							stack.pop();
						}
						continue;

					default:
						stack[stack.length - 1].addCondition(condition);
				}
			}

			// The root always shows at least one condition, even for an empty search
			if (!root.conditionsContainer.childElementCount) {
				root.addCondition();
			}

			this.updateRemoveButtons();
		}

		// Regenerate the search's flat condition list from the current tree. The DOM is
		// the source of truth: on any edit we walk the groups in order and rebuild
		// search._conditions from scratch.
		updateSearch() {
			if (this._rendering || !this.search) {
				return;
			}

			var flat = [];
			this.collectGroup(this.rootGroup, flat, true);

			// Search-global options
			for (let name of ['recursive', 'noChildren', 'includeParentsAndChildren']) {
				if (this.querySelector('#' + name + 'Checkbox').checked) {
					flat.push({ condition: name, operator: 'true', value: null });
				}
			}

			this.rebuildConditions(flat);
		}

		// Append a group's serialized form to `flat`. The root contributes its
		// conditions directly; a nested group is wrapped in groupStart/groupEnd markers.
		// A 'joinMode' marker is emitted only for 'any'; 'all' is the default and is omitted.
		collectGroup(group, flat, isRoot) {
			if (!isRoot) {
				flat.push({ condition: 'groupStart', operator: 'true', value: '' });
			}
			if (group.joinMode == 'any') {
				flat.push({ condition: 'joinMode', operator: 'any', value: null });
			}
			for (let child of group.conditionsContainer.children) {
				if (child.localName == 'zoterosearchcondition') {
					let data = child.getConditionData();
					if (data) {
						flat.push(data);
					}
				}
				else if (child.localName == 'search-condition-group') {
					this.collectGroup(child, flat, false);
				}
			}
			if (!isRoot) {
				flat.push({ condition: 'groupEnd', operator: 'true', value: '' });
			}
		}

		rebuildConditions(flat) {
			var search = this.search;
			var count = Object.keys(search.getConditions()).length;
			// removeCondition() renumbers the remaining conditions, so 0 is always the
			// next one to remove
			for (let i = 0; i < count; i++) {
				search.removeCondition(0);
			}
			for (let condition of flat) {
				search.addCondition(condition.condition, condition.operator, condition.value, condition.required);
			}
		}

		// Enable the remove (-) button on each condition. The root's last remaining
		// condition can be removed only once it's populated, which resets it to the
		// default empty condition.
		updateRemoveButtons() {
			var rootContainer = this.rootGroup.conditionsContainer;
			var loneRootCondition = rootContainer.childElementCount == 1
					&& rootContainer.firstElementChild.localName == 'zoterosearchcondition'
				? rootContainer.firstElementChild
				: null;
			for (let row of this.querySelectorAll('zoterosearchcondition')) {
				if (row == loneRootCondition && !row.isPopulated()) {
					row.disableRemoveButton();
				}
				else {
					row.enableRemoveButton();
				}
			}
		}

		// Remove a condition row, pruning any groups it empties. The root always keeps
		// at least one condition, so emptying it resets it to a single empty default.
		removeRow(row, focusRemoveButton) {
			var group = row.closest('search-condition-group');
			// Remember the row's place so focus can move there after a keyboard removal
			var index = [...group.conditionsContainer.children].indexOf(row);
			row.remove();
			// A group left with no conditions is removed, bubbling up toward the root
			while (!group.isRoot && !group.conditionsContainer.childElementCount) {
				let parent = group.parentElement.closest('search-condition-group');
				group.remove();
				group = parent;
			}

			var reset = this.ensureNotEmpty();
			this.updateSearch();
			this.updateRemoveButtons();
			if (reset) {
				// The removed button is gone, so move focus to the new condition's drop-down
				this.rootGroup.conditionsContainer.firstElementChild
					.querySelector('#conditionsmenu').focus();
			}
			else if (focusRemoveButton && group.isConnected) {
				// After a keyboard removal, move focus to the remove button of the row
				// that took the removed row's place, or the last row if the removed row
				// was last, so conditions can be deleted in succession from the keyboard
				let rows = group.conditionsContainer.children;
				let next = rows[index] || rows[rows.length - 1];
				// A nested group may now hold that slot; focus its first condition
				if (next && next.localName == 'search-condition-group') {
					next = next.querySelector('zoterosearchcondition');
				}
				if (next) {
					let button = next.querySelector('#remove');
					// A disabled remove button can't take focus, so fall back to the drop-down
					let target = button.getAttribute('disabled') == 'true'
						? next.querySelector('#conditionsmenu')
						: button;
					setTimeout(() => target.focus({ focusVisible: true }));
				}
			}
		}

		// The root always shows at least one condition. Returns true if a default
		// condition had to be added back.
		ensureNotEmpty() {
			if (!this.rootGroup.conditionsContainer.childElementCount) {
				this.rootGroup.addCondition();
				return true;
			}
			return false;
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
						// Add to the group holding the focused control, falling back to the root
						let group = event.target.closest
							&& event.target.closest('search-condition-group');
						let row = (group || this.rootGroup).addCondition();
						this.updateSearch();
						this.updateRemoveButtons();
						// Move focus to the new row's drop-down so it can be set from the keyboard
						this.focusNewCondition(row);
					}
					else {
						this.doCommand();
					}
					break;
			}
		}

		// Move focus to a newly added condition's drop-down. Deferred so it isn't
		// immediately undone by the platform's own handling of the key event that
		// triggered the addition (which otherwise keeps focus on the source element).
		focusNewCondition(row) {
			let menu = row.querySelector('#conditionsmenu');
			setTimeout(() => menu.focus({ focusVisible: true }));
		}
	}
	customElements.define("zoterosearch", ZoteroSearch);

	class SearchConditionGroup extends SearchElementBase {
		content = MozXULElement.parseXULToFragment(`
			<groupbox class="search-condition-group">
				<caption align="center">
					<label class="join-mode-prefix" value="&zotero.search.joinMode.prefix;"/>
					<menulist class="join-mode-menu" native="true" aria-label="&zotero.search.joinMode.prefix;">
						<menupopup>
							<menuitem label="&zotero.search.joinMode.any;" value="any"/>
							<menuitem label="&zotero.search.joinMode.all;" value="all" selected="true"/>
						</menupopup>
					</menulist>
					<label class="join-mode-suffix" value="&zotero.search.joinMode.suffix;"/>
					<spacer flex="1"/>
					<hbox class="group-actions">
						<toolbarbutton class="remove-group zotero-clicky zotero-clicky-minus" tabindex="0" hidden="true" data-l10n-id="advanced-search-remove-group-btn" onclick="this.closest('search-condition-group').onRemoveGroupClicked()"/>
						<toolbarbutton class="add-condition zotero-clicky zotero-clicky-plus" tabindex="0" data-l10n-id="advanced-search-add-btn" onclick="this.closest('search-condition-group').onAddSiblingClicked()"/>
						<html:div class="group-action-placeholder"/>
					</hbox>
				</caption>
				<vbox class="conditions"/>
			</groupbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		init() {
			this.joinMenu = this.querySelector('.join-mode-menu');
			this.conditionsContainer = this.querySelector('.conditions');
			// At init the group has no nested groups yet, so these resolve to its own
			// caption buttons
			this.addConditionButton = this.querySelector('.add-condition');
			this.removeGroupButton = this.querySelector('.remove-group');

			// The root group can't be removed and has no parent to add a sibling into, so
			// its caption's remove ("-") and add ("+") buttons stay hidden; a nested group
			// shows both
			if (this.isRoot) {
				this.addConditionButton.hidden = true;
			}
			else {
				this.removeGroupButton.hidden = false;
			}
		}

		get isRoot() {
			return this.hasAttribute('root');
		}

		get searchElement() {
			return this.closest('zoterosearch');
		}

		get search() {
			return this.searchElement && this.searchElement.search;
		}

		get joinMode() {
			return this.joinMenu.value;
		}

		set joinMode(val) {
			this.joinMenu.value = val;
		}

		clear() {
			this.joinMode = 'all';
			while (this.conditionsContainer.firstChild) {
				this.conditionsContainer.removeChild(this.conditionsContainer.firstChild);
			}
		}

		// Add a condition row to this group. Inserts before `beforeNode` if given (e.g.
		// right after the row whose "+" was clicked), otherwise appends.
		addCondition(ref, beforeNode) {
			var condition = document.createXULElement('zoterosearchcondition');
			condition.setAttribute('flex', '1');
			this.conditionsContainer.insertBefore(condition, beforeNode || null);

			// Default to an empty 'title' condition
			if (!ref) {
				ref = { id: undefined, condition: 'title', operator: 'contains', value: '', mode: undefined, required: false };
			}

			condition.initWithParentAndCondition(this.searchElement, ref);
			return condition;
		}

		// "+" in the group caption: add a sibling condition in the parent group, after
		// this group -- the group's caption row acts as the group's single line item in
		// its parent, so its "+" mirrors a condition row's "+". The root has no parent,
		// so its "+" stays hidden.
		onAddSiblingClicked() {
			var parent = this.parentElement.closest('search-condition-group');
			if (!parent) {
				return;
			}
			var row = parent.addCondition(null, this.nextElementSibling);
			var search = this.searchElement;
			search.updateSearch();
			search.updateRemoveButtons();
			row.querySelector('#conditionsmenu').focus();
		}

		onRemoveGroupClicked() {
			var search = this.searchElement;
			var parent = this.parentElement.closest('search-condition-group');
			this.remove();
			// Removing a group can leave its parent empty; prune up toward the root
			while (parent && !parent.isRoot && !parent.conditionsContainer.childElementCount) {
				let grandparent = parent.parentElement.closest('search-condition-group');
				parent.remove();
				parent = grandparent;
			}
			search.ensureNotEmpty();
			search.updateSearch();
			search.updateRemoveButtons();
		}
	}
	customElements.define("search-condition-group", SearchConditionGroup);

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
				<toolbarbutton id="group" tabindex="0" data-l10n-id="advanced-search-group-btn" class="zotero-clicky search-group-button" onclick="this.closest('zoterosearchcondition').onGroupClicked(event)"/>
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

			// Cache the (alphabetically sorted) condition list and set up
			// find-as-you-type on the closed menu
			this._conditions = conditions;
			this._typeAheadBuffer = '';
			this._typeAheadTime = 0;
			conditionsMenu.addEventListener('keydown', event => this.handleConditionKeyDown(event), true);

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
				catch {}
				
				// Add tooltip, building it if it doesn't exist
				if (baseFields) {
					if (!this.querySelector('#' + condition.name + '-tooltip')) {
						var fieldName = null;
						try {
							fieldName = Zotero.ItemFields.getLocalizedString(condition.name);
						}
						catch {}
						
						let localized;
						if (fieldName) {
							localized = [fieldName];
						}
						else {
							localized = [];
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
						label.setAttribute('value', Zotero.getString('search-conditions-tooltip-fields'));
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
				case 'lastRead':
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
				// When "More" option is selected, the condition value remains unchanged,
				// so make sure that it still has the checkbox.
				this.updateMenuCheckboxesRecursive(conditionsMenu, this.selectedCondition);
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
			var selectThis = null;
			for (var i = 0, len = operatorsList.firstChild.childNodes.length; i < len; i++) {
				var val = operatorsList.firstChild.childNodes[i].getAttribute('value');
				var hidden = !operators[val];
				operatorsList.firstChild.childNodes[i].setAttribute('hidden', hidden);
				if (!hidden && (selectThis === null || this.selectedOperator == val)) {
					selectThis = i;
				}
			}
			operatorsList.selectedIndex = selectThis;
			this.updateMenuCheckboxesRecursive(operatorsList, operatorsList.selectedItem.getAttribute('value'));
			
			// Generate drop-down menu instead of textbox for certain conditions
			switch (conditionName) {
				case 'collection':
				{
					let rows = [];

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
							name: indent + Zotero.Utilities.trimInternal(col.name),
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
				}
				case 'itemType':
				{
					let rows = Zotero.ItemTypes.getTypes().map(type => ({
						name: Zotero.ItemTypes.getLocalizedString(type.id),
						value: type.name
					}));
					
					// Sort by localized name
					let collation = Zotero.getLocaleCollation();
					rows.sort((a, b) => collation.compareString(1, a.name, b.name));
					
					this.createValueMenu(rows);
					break;
				}
				case 'fileTypeID':
				{
					let rows = Zotero.FileTypes.getTypes().map(type => ({
						name: Zotero.getString('file-type-' + type.name),
						value: type.id
					}));
					
					// Sort by localized name
					let collation = Zotero.getLocaleCollation();
					rows.sort((a, b) => collation.compareString(1, a.name, b.name));
					
					this.createValueMenu(rows);
					break;
				}
				default:
				{
					if (operatorsList.value == 'isInTheLast') {
						this.querySelector('#value-date-age').value = this.value;
					}
					
					// Textbox
					else {
						// If switching from menu to textbox, clear value
						if (this.querySelector('#valuefield').hidden) {
							this.querySelector('#valuefield').value = '';
						}
						// If switching between textbox conditions, get loaded value for new one
						else {
							this.querySelector('#valuefield').value = this.value;
						}
						
						// Update field drop-down if applicable
						this.querySelector('#valuefield').update(
							conditionName, this.mode, this.parent && this.parent.scopeLibraryIDs
						);
					}
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
			else if (operatorsList.value == 'isInTheLast') {
				// If switching from text field, clear value
				if (this.querySelector('#value-date-age').hidden) {
					this.value = '';
				}
				this.querySelector('#valuefield').hidden = true;
				this.querySelector('#valuemenu').hidden = true;
				this.querySelector('#value-date-age').hidden = false;
			}
			
			// Textbox
			else {
				// If switching from date age, clear value
				if (this.querySelector('#valuefield').hidden) {
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

			while (valueMenu.hasChildNodes()) {
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
			
			if (this.value) {
				valueMenu.value = this.value;
				// If the value isn't in the menu (e.g., a collection from another
				// library after a library change), fall back to the first item
				if (!valueMenu.selectedItem) {
					valueMenu.selectedIndex = 0;
				}
			}
		}

		initWithParentAndCondition(parent, condition) {
			this.parent = parent;
			this.conditionID = condition.id;
			var menu = this.querySelector('#conditionsmenu');

			// Collection and saved search conditions resolve within a single library, so
			// remove the Collection condition (which also covers saved searches) when the
			// selection spans multiple libraries
			if (this.parent.scopeLibraryIDs && this.parent.scopeLibraryIDs.length > 1) {
				let collectionItem = menu.querySelector('menuitem[value="collection"]');
				if (collectionItem) {
					collectionItem.remove();
				}
			}

			if (this.parent.search) {
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
				if ((condition.condition == 'accessDate'
						|| condition.condition == 'dateAdded'
						|| condition.condition == 'dateModified')
						&& Zotero.Date.isSQLDateTime(condition.value)) {
					condition.value
						= Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(condition.value, true));
				}
				
				this.mode = condition.mode;
				this.querySelector('#operatorsmenu').value = condition.operator;
				this.value = prefix
					+ (condition.value ? condition.value : '');

				this.dontupdate = false;
			}
			
			this.onConditionSelected(menu.value);
		}

		// Return this row's current {condition, operator, value} for serialization.
		// The owning <zoterosearch> collects these across the tree and rebuilds the
		// search from scratch. Returns null while the row is still being set up.
		getConditionData() {
			if (!(this.parent && this.parent.search) || this.dontupdate) {
				return null;
			}

			var condition = this.selectedCondition;
			var operator = this.querySelector('#operatorsmenu').value;
			let value;

			// Regular text field
			if (!this.querySelector('#valuefield').hidden) {
				value = this.querySelector('#valuefield').value;

				// Convert datetimes to UTC before saving
				switch (condition) {
					case 'accessDate':
					case 'dateAdded':
					case 'dateModified':
						if (Zotero.Date.isSQLDateTime(value)) {
							value = Zotero.Date.dateToSQL(Zotero.Date.sqlToDate(value), true);
						}
				}

				// Append mode to condition
				if (this.querySelector('#valuefield').mode) {
					condition += '/' + this.querySelector('#valuefield').mode;
				}
			}

			// isInTheLast operator
			else if (!this.querySelector('#value-date-age').hidden) {
				value = this.querySelector('#value-date-age').value;
			}

			// Handle special C1234 and S5678 form for
			// collections and searches
			else if (condition == 'collection') {
				var letter = this.querySelector('#valuemenu').value.substr(0, 1);
				if (letter == 'C') {
					condition = 'collection';
				}
				else if (letter == 'S') {
					condition = 'savedSearch';
				}
				value = this.querySelector('#valuemenu').value.substr(1);
			}

			// Regular drop-down menu
			else {
				value = this.querySelector('#valuemenu').value;
			}

			return { condition, operator, value };
		}

		updateMenuCheckboxesRecursive(menu, value) {
			for (let i = 0; i < menu.itemCount; i++) {
				let item = menu.getItemAtIndex(i);
				if (item.localName == 'menuitem') {
					if (item.getAttribute('value') == value) {
						item.setAttribute('checked', true);
						item.setAttribute('selected', true);
					}
					else {
						item.removeAttribute('checked');
						item.removeAttribute('selected');
					}
				}
				else {
					this.updateMenuCheckboxesRecursive(item, value);
				}
			}
		}

		revealSelectedCondition(menu) {
			if (!this.selectedCondition || this.isPrimaryCondition(this.selectedCondition)) {
				return false;
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

		// Find-as-you-type on the closed conditions menu. The native incremental
		// find within the open popup only matches the visible top-level items, so
		// this handles typing while the menu is closed to reach any condition,
		// including the ~67 in the "More" submenu.
		handleConditionKeyDown(event) {
			var menu = this.querySelector('#conditionsmenu');
			// Let the native incremental find handle typing while the popup is open,
			// and ignore in-progress IME composition (event.key is "Process")
			if (menu.open || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
				return;
			}
			// Only act on a single printable character. Count code points rather
			// than UTF-16 units so supplementary-plane characters (e.g. some CJK
			// extension blocks) aren't treated as multi-key sequences.
			if (Array.from(event.key).length != 1) {
				return;
			}

			var now = Date.now();
			// Start a new search if enough time has passed since the last keystroke
			if (now - this._typeAheadTime > 1000) {
				this._typeAheadBuffer = '';
			}
			this._typeAheadTime = now;

			// With no search in progress, a space opens the menu instead of starting
			// a search, matching the native menulist behavior
			if (event.key == ' ' && !this._typeAheadBuffer) {
				return;
			}

			this._typeAheadBuffer += event.key.toLowerCase();

			var conditionName = this.findConditionByPrefix();
			if (conditionName) {
				event.preventDefault();
				event.stopPropagation();
				this.onConditionSelected(conditionName);
			}
		}

		findConditionByPrefix() {
			var buffer = this._typeAheadBuffer;
			var conditions = this._conditions;

			// When the same character is typed repeatedly, cycle through the
			// matching conditions, starting after the currently selected one
			var cycling = buffer.length > 1 && [...buffer].every(c => c == buffer[0]);
			var prefix = cycling ? buffer[0] : buffer;

			var startIndex = 0;
			if (cycling) {
				startIndex = conditions.findIndex(c => c.name == this.selectedCondition) + 1;
			}

			for (let i = 0; i < conditions.length; i++) {
				let condition = conditions[(startIndex + i) % conditions.length];
				if (condition.localized.toLowerCase().startsWith(prefix)) {
					return condition.name;
				}
			}
			return null;
		}

		onLibraryChange() {
			switch (this.selectedCondition) {
				case 'collection':
					this.onConditionSelected(this.selectedCondition, true);
					break;
			}
		}

		onRemoveClicked(event) {
			if (this.parent) {
				// A keyboard-synthesized click has detail 0, unlike a mouse click
				this.parent.removeRow(this, event?.detail === 0);
			}
		}

		onAddClicked(event) {
			event.preventDefault();
			if (!this.parent) {
				return;
			}
			// Add a sibling condition right after this one, seeded with this row's
			// condition and operator
			let group = this.closest('search-condition-group');
			let row = group.addCondition({
				id: undefined,
				condition: this.querySelector('#conditionsmenu').getAttribute('data-value'),
				operator: this.querySelector('#operatorsmenu').value,
				value: '',
				mode: undefined,
				required: false
			}, this.nextElementSibling);
			this.parent.updateSearch();
			this.parent.updateRemoveButtons();
			// When activated from the keyboard (a synthesized click has detail 0,
			// unlike a mouse click), move focus to the new row's drop-down
			if (event.detail === 0) {
				this.parent.focusNewCondition(row);
			}
		}

		// Wrap this condition in a new group in its place, so further conditions can be
		// added to the group to combine with it under a separate join mode
		onGroupClicked(event) {
			event.preventDefault();
			if (!this.parent) {
				return;
			}
			var group = this.closest('search-condition-group');
			// Rebuild the condition inside the new group rather than moving the row, since
			// detaching a custom element wipes its contents
			var ref;
			var data = this.getConditionData();
			if (data) {
				let [condition, mode] = Zotero.SearchConditions.parseCondition(data.condition);
				ref = { id: undefined, condition, mode, operator: data.operator, value: data.value, required: false };
			}
			var newGroup = document.createXULElement('search-condition-group');
			group.conditionsContainer.insertBefore(newGroup, this);
			newGroup.addCondition(ref);
			this.remove();

			this.parent.updateSearch();
			this.parent.updateRemoveButtons();
			newGroup.conditionsContainer.firstElementChild.querySelector('#conditionsmenu').focus();
		}

		// Whether a value has been entered, used to decide whether the last
		// remaining condition can be cleared back to the default state
		isPopulated() {
			let valueField = this.querySelector('#valuefield');
			if (!valueField.hidden) {
				return !!valueField.value;
			}
			let ageField = this.querySelector('#value-date-age');
			if (!ageField.hidden) {
				return !!ageField.querySelector('.input').value;
			}
			// The drop-down value menus (collection, item type, etc.) always have a selection
			return true;
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
			if (this.getAttribute('hasOptions') != 'true') {
				return false;
			}
			
			var menu = this.querySelector('#textbox-fulltext-menu');
			
			var selectedIndex = -1;
			for (var i = 0; i < menu.childNodes.length; i++) {
				if (menu.childNodes[i].getAttribute('checked') == 'true') {
					selectedIndex = i;
					break;
				}
			}
			switch (selectedIndex) {
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

		update(condition, mode, scopeLibraryIDs) {
			var textbox = this.querySelector('#search-textbox');
			var button = this.querySelector('#textbox-button');
			
			switch (condition) {
				case 'fulltextContent':
					var menu = this.querySelector('#textbox-fulltext-menu');
					this.setAttribute('hasOptions', true);
					button.removeAttribute('hidden');
					
					var selectedIndex = 0;
					if (mode) {
						switch (mode) {
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
					switch (condition) {
						// Skip autocomplete for these fields
						case 'date':
						case 'note':
						case 'extra':
							textbox.setAttribute('disableautocomplete', 'true');
							break;
						
						default:
							textbox.setAttribute('disableautocomplete', 'false');

							var autocompleteParams = {
								fieldName: condition
							};
							// Scope suggestions to the selected libraries (the same set the
							// collection condition menu uses). Empty/unset falls back to all libraries.
							if (scopeLibraryIDs && scopeLibraryIDs.length) {
								autocompleteParams.libraryIDs = scopeLibraryIDs;
							}
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
			for (var i = 0; i < menupopup.childNodes.length; i++) {
				if (menupopup.childNodes[i].value == units) {
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
