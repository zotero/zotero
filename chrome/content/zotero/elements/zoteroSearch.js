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
			<vbox id="search-binding-hint" hidden="true"/>
			<hbox id="search-option-checkboxes">
				<checkbox id="recursiveCheckbox" label="&zotero.search.recursive.label;" native="true"/>
			</hbox>
			<hbox id="search-legacy-options" align="center" hidden="true">
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
			// Re-evaluate which remove buttons are enabled and which groups can bind to the
			// same descendant as the conditions change
			this.addEventListener('input', (event) => {
				this.clearPendingAdd(event);
				this.updateRemoveButtons();
				this.updateBindingMenus();
				this.updateBindingHint();
				this.updateLevelWarning();
				this.updateSearchOptions();
			});
			this.addEventListener('command', (event) => {
				this.clearPendingAdd(event);
				this.updateRemoveButtons();
				this.updateBindingMenus();
				this.updateBindingHint();
				this.updateLevelWarning();
				this.updateSearchOptions();
			});
		}

		// A condition row added via the "+" button doesn't count toward the binding hint or
		// level warning until the user engages with it, so adding a row (seeded with the previous
		// row's condition) doesn't immediately warn before they've had a chance to change it.
		// This clears that flag when a value edit bubbles up from a row -- typing in the field
		// or picking from a value menu. Changing the condition doesn't bubble here (its menu
		// stops propagation), so onConditionSelected() has to clear the flag itself.
		clearPendingAdd(event) {
			let row = event.target.closest && event.target.closest('zoterosearchcondition');
			if (row) {
				row._pendingAdd = false;
			}
		}

		// Build the condition tree (root group, nested groups, and search-global
		// checkboxes) from the search's flat condition list
		renderConditions() {
			var root = this.rootGroup;

			this.querySelector('#recursiveCheckbox').checked = false;
			// 'Include parent and child items' is a legacy hack subsumed by result levels;
			// its checkbox is shown only for an existing search that still carries the flag
			this.querySelector('#includeParentsAndChildrenCheckbox').checked = false;
			this.querySelector('#search-legacy-options').hidden = true;

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
						this.querySelector('#recursiveCheckbox').checked = condition.operator == 'true';
						continue;

					// Legacy "show only top-level items" is exactly result level = item, so
					// fold it into the root result level rather than a checkbox
					case 'noChildren':
						if (condition.operator == 'true') {
							root.resultLevel = 'item';
						}
						continue;

					// Legacy include-parents-and-children: keep it editable for searches that
					// have it, but don't offer it on new ones
					case 'includeParentsAndChildren':
						this.querySelector('#includeParentsAndChildrenCheckbox').checked
							= condition.operator == 'true';
						if (condition.operator == 'true') {
							this.querySelector('#search-legacy-options').hidden = false;
						}
						continue;

					case 'joinMode':
						stack[stack.length - 1].joinMode = condition.operator;
						continue;

					case 'resultLevel':
						stack[stack.length - 1].resultLevel = condition.operator;
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
			this.updateBindingMenus();
			this.updateBindingHint();
			this.updateLevelWarning();
			this.updateSearchOptions();
		}

		// "Search subcollections" only affects Collection conditions (it expands them to
		// their descendants), so show it only when the search actually has one
		updateSearchOptions() {
			let hasCollection = [...this.querySelectorAll('zoterosearchcondition')]
				.some(row => row.selectedCondition == 'collection');
			this.querySelector('#search-option-checkboxes').hidden = !hasCollection;
		}

		// Refresh each nested group's same-entity binding menu (visibility and options)
		updateBindingMenus() {
			for (let group of this.querySelectorAll('search-condition-group')) {
				group.updateBindingMenu();
			}
		}

		// Refresh every group's level warning. Each group flags only its own conditions, so the
		// message sits on the group whose conditions actually conflict and speaks to that group's
		// controls (see SearchConditionGroup.updateLevelWarning).
		updateLevelWarning() {
			for (let group of this.querySelectorAll('search-condition-group')) {
				group.updateLevelWarning();
			}
		}

		// Offer to bind ungrouped sibling conditions at the root. The root can't bind itself
		// (it returns the result level), so 2+ of its conditions sharing a level below the
		// result level are wrappable into a "same attachment" group -- surfaced as a hint
		// with a button per such level. Nested groups use their own binding menu instead.
		updateBindingHint() {
			var hint = this.querySelector('#search-binding-hint');
			var resultLevel = this.rootGroup.resultLevel;
			var counts = {};
			for (let row of this.rootGroup.conditionsContainer.children) {
				// Skip a row just added via "+" until the user engages with it, so adding a row
				// doesn't immediately suggest grouping it
				if (row.localName != 'zoterosearchcondition' || row._pendingAdd) {
					continue;
				}
				let level = row.conditionLevel;
				if (Zotero.Search._isAncestorLevel(resultLevel, level)) {
					counts[level] = (counts[level] || 0) + 1;
				}
			}
			var levels = ['attachment', 'note', 'annotation'].filter(l => counts[l] >= 2);
			// Only rebuild when the set of bindable levels changes, so re-running this on every
			// keystroke doesn't recreate the rows and make the hint flicker.
			let key = levels.join(',');
			if (key === this._bindingHintKey) {
				return;
			}
			this._bindingHintKey = key;
			hint.replaceChildren();
			if (!levels.length) {
				hint.hidden = true;
				return;
			}
			// One self-contained line per level: a statement naming that level and a button to
			// group its conditions into one entity. Separate lines when 2+ levels each qualify.
			for (let level of levels) {
				let row = document.createXULElement('hbox');
				row.setAttribute('align', 'center');
				let label = document.createXULElement('label');
				label.setAttribute('data-l10n-id', 'advanced-search-binding-hint-' + level);
				let button = document.createXULElement('button');
				button.setAttribute('data-l10n-id', 'advanced-search-bind-same-' + level);
				button.addEventListener('command', () => this.rootGroup.bindSameEntity(level));
				row.append(label, button);
				hint.append(row);
			}
			hint.hidden = false;
		}

		// Regenerate the search's flat condition list from the current tree. The DOM is
		// the source of truth: on any edit we walk the groups in order and rebuild
		// search._conditions from scratch.
		updateSearch() {
			if (this._rendering || !this.search) {
				return;
			}

			// Refresh the binding menus first: a condition edit can disqualify a group's
			// same-entity binding, and collectGroup() below serializes the binding state
			this.updateBindingMenus();

			var flat = [];
			this.collectGroup(this.rootGroup, flat, true);

			// Search-global options. noChildren is no longer emitted here -- it's carried by
			// the result level (resultLevel = item). includeParentsAndChildren is emitted only when
			// its legacy checkbox is present and still checked, so unchecking it drops it.
			// 'recursive' only does anything alongside a Collection condition, so emit it only
			// when the search has one, matching the checkbox's visibility.
			if (this.querySelector('#recursiveCheckbox').checked
					&& flat.some(c => c.condition == 'collection')) {
				flat.push({ condition: 'recursive', operator: 'true', value: null });
			}
			if (this.querySelector('#includeParentsAndChildrenCheckbox').checked) {
				flat.push({ condition: 'includeParentsAndChildren', operator: 'true', value: null });
			}

			this.rebuildConditions(flat);

			// Any mutation runs through here (including paths whose menus stopPropagation, like
			// changing or removing a condition), so refresh the derived UI from one place
			this.updateBindingHint();
			this.updateLevelWarning();
			this.updateSearchOptions();
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
			// A concrete result level is emitted as a marker inside the group, like joinMode; 'any'
			// (the default) is omitted
			if (group.resultLevel && group.resultLevel != 'any') {
				flat.push({ condition: 'resultLevel', operator: group.resultLevel, value: null });
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
				search.addCondition(condition.condition, condition.operator, condition.value);
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
				// The pruned group's slot in its parent is now where focus should land
				index = [...parent.conditionsContainer.children].indexOf(group);
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
					if (event.shiftKey) {
						// Add to the group holding the focused control, falling back to the root
						let group = event.target.closest
							&& event.target.closest('search-condition-group');
						let row = (group || this.rootGroup).addCondition();
						// Don't let the new row trigger the binding hint/warning until the user
						// engages with it (see clearPendingAdd)
						row._pendingAdd = true;
						this.updateSearch();
						this.updateRemoveButtons();
						// Move focus to the new row's drop-down so it can be set from the keyboard
						this.focusNewCondition(row);
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
					<label class="result-level-prefix"/>
					<menulist class="result-level-menu" native="true" data-l10n-id="advanced-search-result-level-menu">
						<menupopup>
							<menuitem value="any" data-l10n-id="advanced-search-result-level-any" selected="true"/>
							<menuitem value="item" data-l10n-id="advanced-search-result-level-item"/>
							<menuitem value="attachment" data-l10n-id="advanced-search-result-level-attachment"/>
							<menuitem value="note" data-l10n-id="advanced-search-result-level-note"/>
							<menuitem value="annotation" data-l10n-id="advanced-search-result-level-annotation"/>
						</menupopup>
					</menulist>
					<label class="join-mode-prefix" value="&zotero.search.joinMode.prefix;"/>
					<menulist class="join-mode-menu" native="true" aria-label="&zotero.search.joinMode.prefix;">
						<menupopup>
							<menuitem label="&zotero.search.joinMode.any;" value="any"/>
							<menuitem label="&zotero.search.joinMode.all;" value="all" selected="true"/>
						</menupopup>
					</menulist>
					<label class="join-mode-following" data-l10n-id="advanced-search-of-the-following" hidden="true"/>
					<menulist class="binding-menu" native="true" hidden="true" data-l10n-id="advanced-search-binding-menu">
						<menupopup/>
					</menulist>
					<label class="join-mode-suffix" value="&zotero.search.joinMode.suffix;"/>
					<spacer flex="1"/>
					<hbox class="group-actions">
						<toolbarbutton class="remove-group zotero-clicky zotero-clicky-minus" tabindex="0" hidden="true" data-l10n-id="advanced-search-remove-group-btn" onclick="this.closest('search-condition-group').onRemoveGroupClicked()"/>
						<toolbarbutton class="add-condition zotero-clicky zotero-clicky-plus" tabindex="0" data-l10n-id="advanced-search-add-btn" onclick="this.closest('search-condition-group').onAddSiblingClicked()"/>
						<toolbarbutton class="ungroup-group zotero-clicky search-group-button" tabindex="0" hidden="true" data-l10n-id="advanced-search-ungroup-btn" onclick="this.closest('search-condition-group').onUngroupClicked()"/>
						<html:div class="group-action-placeholder"/>
					</hbox>
				</caption>
				<vbox class="conditions"/>
				<hbox class="level-warning" hidden="true">
					<description/>
				</hbox>
			</groupbox>
		`, ['chrome://zotero/locale/zotero.dtd', 'chrome://zotero/locale/searchbox.dtd']);

		init() {
			this.joinMenu = this.querySelector('.join-mode-menu');
			this.resultLevelMenu = this.querySelector('.result-level-menu');
			this.bindingMenu = this.querySelector('.binding-menu');
			this.conditionsContainer = this.querySelector('.conditions');
			// The group's own warning element, stashed at init to avoid re-querying.
			this.levelWarning = this.querySelector('.level-warning');

			// The result level is tracked here and reflected to whichever control is active: the root's
			// result-level menu ("Find ..."), or a nested group's binding menu ("... in the
			// same attachment"). collectGroup/renderConditions read and write `resultLevel`.
			this._resultLevel = 'any';

			// The root surfaces the result-level menu; a nested group hides it and instead
			// shows a binding menu (built on demand by updateBindingMenu) when it holds
			// conditions that can be bound to the same descendant.
			this.resultLevelMenu.value = 'any';
			var scopePrefix = this.querySelector('.result-level-prefix');
			if (this.isRoot) {
				// Read as one sentence: "Find [Top-level items] matching [all] of the following:"
				scopePrefix.setAttribute('data-l10n-id', 'advanced-search-result-level-prefix-root');
				this.querySelector('.join-mode-prefix').setAttribute('data-l10n-id', 'advanced-search-join-prefix-root');
				this.resultLevelControl = this.resultLevelMenu;
			}
			else {
				// Nested: "Match [all] of the following:" -- the result level lives on the
				// root. The binding menu (and its hiding of the suffix) is set up in
				// updateBindingMenu().
				this.resultLevelMenu.hidden = true;
				scopePrefix.hidden = true;
				this.resultLevelControl = this.bindingMenu;
			}

			// Keep the stored result level in sync when the user changes the control (the
			// command target may be the menulist or a menuitem inside it), so a nested
			// binding that later hides still round-trips its last value
			this.addEventListener('command', (event) => {
				if (this.resultLevelControl && this.resultLevelControl.contains(event.target)) {
					this._resultLevel = this.resultLevelControl.value || 'any';
				}
			});
			// At init the group has no nested groups yet, so these resolve to its own
			// caption buttons
			this.addConditionButton = this.querySelector('.add-condition');
			this.removeGroupButton = this.querySelector('.remove-group');
			this.ungroupButton = this.querySelector('.ungroup-group');

			// remove-group and ungroup default to hidden in the template, so the root only also
			// hides its add button. A nested group shows all three and swaps the empty spacer
			// for the ungroup button.
			if (this.isRoot) {
				this.addConditionButton.hidden = true;
			}
			else {
				this.removeGroupButton.hidden = false;
				this.ungroupButton.hidden = false;
				this.querySelector('.group-action-placeholder').hidden = true;
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

		// The group's result level: 'any' (no level constraint -- mixed result for the root,
		// plain grouping for a nested group) or a concrete 'item'/'attachment'/'note'/
		// 'annotation' level for cross-level mapping. The active control's current
		// selection is the source of truth; fall back to the stored value for a nested
		// binding menu that's hidden (it has no options to read).
		get resultLevel() {
			if (this.resultLevelControl && !this.resultLevelControl.hidden) {
				return this.resultLevelControl.value || 'any';
			}
			return this._resultLevel;
		}

		set resultLevel(val) {
			this._resultLevel = val || 'any';
			// Reflect to the active control if it currently offers a matching option; the
			// binding menu's options are (re)built by updateBindingMenu()
			let popup = this.resultLevelControl && this.resultLevelControl.querySelector('menupopup');
			if (popup && [...popup.children].some(item => item.value == this._resultLevel)) {
				this.resultLevelControl.value = this._resultLevel;
			}
		}

		// Build the nested-group binding menu ("... in the same attachment"), shown when
		// binding is meaningful -- 2+ conditions sharing a level below the result level --
		// or when the group is already bound.
		updateBindingMenu() {
			if (this.isRoot) {
				return;
			}
			let resultLevel = 'any';
			if (this.searchElement && this.searchElement.rootGroup) {
				resultLevel = this.searchElement.rootGroup.resultLevel;
			}
			// Count this group's direct condition rows by level, keeping only levels below the
			// result level -- those are what a group can bind to the same entity. A mixed
			// ('any') result anchors a bound group to the top-level item (see
			// Zotero.Search.combineConditions), so treat it as 'item' here.
			let bindableBelow = resultLevel == 'any' ? 'item' : resultLevel;
			let counts = {};
			for (let row of this.conditionsContainer.children) {
				// Skip a row just added via "+" until the user engages with it, so adding a row
				// doesn't immediately suggest grouping it
				if (row.localName != 'zoterosearchcondition' || row._pendingAdd) {
					continue;
				}
				let level = row.conditionLevel;
				if (Zotero.Search._isAncestorLevel(bindableBelow, level)) {
					counts[level] = (counts[level] || 0) + 1;
				}
			}
			let levels = Object.keys(counts);
			// Drop a stored binding once no condition at its level remains
			if (this._resultLevel != 'any' && !levels.includes(this._resultLevel)) {
				this._resultLevel = 'any';
			}
			// Binding is offered once some level has 2+ conditions, and an existing binding
			// stays visible (and clearable) even when its group no longer qualifies, so it
			// can't invisibly constrain the group from a hidden menu
			if (this._resultLevel == 'any' && !levels.some(l => counts[l] >= 2)) {
				this.bindingMenu.hidden = true;
				// Plain group: "Match [all] of the following:" (the suffix carries the colon)
				this.querySelector('.join-mode-suffix').hidden = false;
				this.querySelector('.join-mode-following').hidden = true;
				this._bindingMenuKey = null;
				return;
			}

			// Rebuild the popup only when its option set changes. Rebuilding it on every refresh
			// would replace the menuitems mid-selection -- when the change came from this menu
			// itself -- and wedge the drop-down.
			let optionLevels = ['attachment', 'note', 'annotation'].filter(l => levels.includes(l));
			let key = optionLevels.join(',');
			if (key !== this._bindingMenuKey) {
				this._bindingMenuKey = key;
				let popup = this.bindingMenu.querySelector('menupopup');
				popup.replaceChildren();
				let separate = document.createXULElement('menuitem');
				separate.setAttribute('value', 'any');
				separate.setAttribute('data-l10n-id', 'advanced-search-binding-separate');
				popup.append(separate);
				for (let level of optionLevels) {
					let item = document.createXULElement('menuitem');
					item.setAttribute('value', level);
					item.setAttribute('data-l10n-id', 'advanced-search-binding-same-' + level);
					popup.append(item);
				}
			}
			this.bindingMenu.hidden = false;
			// Bound group: "Match [all] of the following in the same attachment". The binding
			// phrase ends the caption, so swap the legacy "of the following:" (with its colon)
			// for the colon-less "of the following" that precedes the binding menu.
			this.querySelector('.join-mode-suffix').hidden = true;
			this.querySelector('.join-mode-following').hidden = false;
			this.bindingMenu.value = this._resultLevel;
		}

		// The level this group's conditions are actually matched at: its own result level (the
		// result type for the root, the binding for a nested group) if set, otherwise the level
		// it inherits from its enclosing group. Mirrors the engine, where an unbound
		// ("separately") group maps its conditions to the parent's level rather than
		// combining them at no level.
		effectiveLevel() {
			if (this.resultLevel != 'any') {
				return this.resultLevel;
			}
			let parent = this.parentElement && this.parentElement.closest('search-condition-group');
			return parent ? parent.effectiveLevel() : this.resultLevel;
		}

		// Warn when this group's own conditions can never combine: a child whose level can't
		// reach the group's effective level, or -- with no level anywhere up the chain (a mixed
		// result type) -- an "all" of children on different item-hierarchy branches. Each group
		// flags only its own conditions, so the message sits where the problem is.
		updateLevelWarning() {
			let ownLevel = this.resultLevel;
			let level = this.effectiveLevel();
			// Collect each direct child's level: a condition row's, or a nested group's binding
			// (null for a "+"-added row not yet engaged with).
			let childLevels = [...this.conditionsContainer.children].map((child) => {
				if (child.localName == 'zoterosearchcondition') {
					return child._pendingAdd ? null : child.conditionLevel;
				}
				if (child.localName == 'search-condition-group') {
					return child.resultLevel;
				}
				return null;
			})
				// Drop those nulls and 'any', which combines with anything
				.filter(l => l && l != 'any');

			let messageID = null;
			let args = null;
			let resultTypeArgs = () => {
				let item = this.resultLevelMenu.querySelector('menuitem[value="item"]');
				return { topLevelItems: item ? item.getAttribute('label') : 'top-level items' };
			};
			if (level != 'any') {
				// A child that can't reach the effective level can never match here
				if (childLevels.some(l => !this.levelsCombine(l, level))) {
					if (!this.isRoot && ownLevel != 'any') {
						// This group's own binding is the constraint, so "match separately" fixes it
						messageID = 'advanced-search-group-warning-unreachable';
						args = { entity: ownLevel };
					}
					else {
						// The result type (this group's, or one it inherits) is the constraint
						messageID = 'advanced-search-level-warning-unreachable';
						args = resultTypeArgs();
					}
				}
			}
			else if (this.joinMode == 'all' && new Set(childLevels).size >= 2) {
				// No level anywhere up the chain (mixed result type): ANDing conditions on
				// different branches can never all match
				let anyItem = this.joinMenu.querySelector('menuitem[value="any"]');
				let matchAny = anyItem ? anyItem.getAttribute('label') : 'any';
				if (this.isRoot) {
					messageID = 'advanced-search-level-warning-mixed';
					args = { matchAny, ...resultTypeArgs() };
				}
				else {
					// Reachable only when the result type is "any", so setting one fixes it too
					messageID = 'advanced-search-group-warning-mixed';
					args = { matchAny, ...resultTypeArgs() };
				}
			}

			// Only touch the DOM when the message changes, so re-running on every keystroke
			// doesn't re-translate the string and make the warning flicker.
			let key = messageID ? messageID + '\n' + JSON.stringify(args) : '';
			if (key === this._levelWarningKey) {
				return;
			}
			this._levelWarningKey = key;
			if (messageID) {
				document.l10n.setAttributes(this.levelWarning.querySelector('description'), messageID, args);
			}
			this.levelWarning.hidden = !messageID;
		}

		// Two levels combine if one is an ancestor of the other (or equal); 'any' matches any.
		levelsCombine(a, b) {
			return a == 'any' || b == 'any' || a == b
				|| Zotero.Search._isAncestorLevel(a, b) || Zotero.Search._isAncestorLevel(b, a);
		}

		// Wrap this group's direct condition rows that match `level` into a new child group
		// bound to that level ("the same attachment"). Used by the discoverability hint.
		// Rows are rebuilt from their data rather than moved, since detaching a custom element
		// wipes its contents.
		bindSameEntity(level) {
			let rows = [...this.conditionsContainer.children].filter(
				row => row.localName == 'zoterosearchcondition' && row.conditionLevel == level);
			if (rows.length < 2) {
				return;
			}
			let newGroup = document.createXULElement('search-condition-group');
			this.conditionsContainer.insertBefore(newGroup, rows[0]);
			for (let row of rows) {
				let data = row.getConditionData();
				let ref;
				if (data) {
					let [condition, mode] = Zotero.SearchConditions.parseCondition(data.condition);
					ref = { id: undefined, condition, mode, operator: data.operator, value: data.value };
				}
				newGroup.addCondition(ref);
				row.remove();
			}
			newGroup.resultLevel = level;

			let search = this.searchElement;
			search.updateSearch();
			search.updateRemoveButtons();
			search.updateBindingMenus();
			search.updateBindingHint();
		}

		clear() {
			this.joinMode = 'all';
			this.resultLevel = 'any';
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
				ref = { id: undefined, condition: 'title', operator: 'contains', value: '', mode: undefined };
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
			// Don't let the new row trigger the binding hint/warning until the user engages with
			// it (see ZoteroSearch.clearPendingAdd)
			row._pendingAdd = true;
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

		// "Ungroup": dissolve this group, moving its conditions (and any nested groups) up into
		// the parent in this group's place and dropping this group's own join mode and binding.
		// The inverse of a condition row's group button.
		onUngroupClicked() {
			var search = this.searchElement;
			var parent = this.parentElement.closest('search-condition-group');
			if (!parent) {
				return;
			}
			this.rebuildChildrenInto(parent, this);
			this.remove();
			search.updateSearch();
			search.updateRemoveButtons();
			search.updateBindingMenus();
			search.updateBindingHint();
		}

		// Recreate this group's children inside `target`, before `beforeNode`, preserving any
		// nested groups and their join mode and result level. Rows are rebuilt from their data
		// rather than moved, since detaching a custom element wipes its contents.
		rebuildChildrenInto(target, beforeNode) {
			for (let child of [...this.conditionsContainer.children]) {
				if (child.localName == 'zoterosearchcondition') {
					let ref;
					let data = child.getConditionData();
					if (data) {
						let [condition, mode] = Zotero.SearchConditions.parseCondition(data.condition);
						ref = { id: undefined, condition, mode, operator: data.operator, value: data.value };
					}
					target.addCondition(ref, beforeNode);
				}
				else if (child.localName == 'search-condition-group') {
					let newGroup = document.createXULElement('search-condition-group');
					target.conditionsContainer.insertBefore(newGroup, beforeNode);
					newGroup.joinMode = child.joinMode;
					newGroup.resultLevel = child.resultLevel;
					child.rebuildChildrenInto(newGroup, null);
				}
			}
		}
	}
	customElements.define("search-condition-group", SearchConditionGroup);

	class ZoteroSearchCondition extends XULElementBase {
		content = MozXULElement.parseXULToFragment(`
			<html:div class="search-condition">
				<popupset id="condition-tooltips"/>
				
				<menulist id="conditionsmenu" oncommand="this.closest('zoterosearchcondition').onConditionSelected(event.target.value); event.stopPropagation()" native="true">
					<menupopup onpopupshown="if (event.target == this) this.closest('zoterosearchcondition').revealSelectedCondition()">
						<menu id="attachment-conditions-menu">
							<menupopup/>
						</menu>
						<menu id="annotation-conditions-menu">
							<menupopup/>
						</menu>
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
			var attachmentConditionsMenu = this.querySelector('#attachment-conditions-menu');
			var annotationConditionsMenu = this.querySelector('#annotation-conditions-menu');
			var conditions = Zotero.SearchConditions.getStandardConditions();

			// Cache the (alphabetically sorted) condition list and set up
			// find-as-you-type on the closed menu
			this._conditions = conditions;
			this._typeAheadBuffer = '';
			this._typeAheadTime = 0;
			conditionsMenu.addEventListener('keydown', event => this.handleConditionKeyDown(event), true);

			// Label the submenus and seed the top-level entries with them, so the
			// headings sort alphabetically alongside the primary conditions
			attachmentConditionsMenu.setAttribute(
				'label', Zotero.getString('search-conditions-submenu-attachment')
			);
			annotationConditionsMenu.setAttribute(
				'label', Zotero.getString('search-conditions-submenu-annotation')
			);
			let topLevelEntries = [
				{ label: attachmentConditionsMenu.getAttribute('label'), node: attachmentConditionsMenu },
				{ label: annotationConditionsMenu.getAttribute('label'), node: annotationConditionsMenu },
			];

			for (let condition of conditions) {
				let menuitem;
				let submenu = this.getConditionSubmenu(condition.name);
				// Attachment- and annotation-level conditions go in their own submenus,
				// with a short label since the submenu heading supplies the context
				if (submenu == 'attachment' || submenu == 'annotation') {
					let parentMenu = submenu == 'attachment'
						? attachmentConditionsMenu
						: annotationConditionsMenu;
					menuitem = parentMenu.appendItem(
						Zotero.getString('search-conditions-short-' + condition.name),
						condition.name
					);
				}
				else if (this.isPrimaryCondition(condition.name)) {
					menuitem = document.createXULElement('menuitem');
					menuitem.setAttribute('label', condition.localized);
					menuitem.setAttribute('value', condition.name);
					topLevelEntries.push({ label: condition.localized, node: menuitem });
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

			// Insert the top-level conditions and the two submenus alphabetically,
			// before the catch-all "More" submenu
			let collation = Zotero.getLocaleCollation();
			topLevelEntries.sort((a, b) => collation.compareString(1, a.label, b.label));
			for (let entry of topLevelEntries) {
				moreConditionsMenu.before(entry.node);
			}

			conditionsMenu.selectedIndex = 0;
		}

		isPrimaryCondition(condition) {
			switch (condition) {
				case 'anyField':
				case 'collection':
				case 'savedSearch':
				case 'creator':
				case 'title':
				case 'date':
				case 'dateAdded':
				case 'dateModified':
				case 'itemType':
				case 'publicationTitle':
				case 'tag':
				case 'note':
					return true;
			}

			return false;
		}

		// Conditions that live in the Attachment or Annotation submenu rather than
		// at the top level of the conditions menu. Returns 'attachment', 'annotation',
		// or null.
		getConditionSubmenu(condition) {
			switch (condition) {
				case 'fulltextContent':
				case 'fileTypeID':
				case 'attachmentStorageType':
				case 'lastRead':
					return 'attachment';
				case 'annotationText':
				case 'annotationComment':
				case 'annotationType':
				case 'annotationColor':
				case 'annotationAuthor':
					return 'annotation';
			}

			return null;
		}

		async onConditionSelected(conditionName, reload) {
			var conditionsMenu = this.querySelector('#conditionsmenu');
			var operatorsList = this.querySelector('#operatorsmenu');
			
			// Skip if no condition or correct condition already selected
			if (!conditionName || (conditionName == this.selectedCondition && !reload)) {
				// When "More" option is selected, the condition value remains unchanged,
				// so make sure that it still has the checkbox.
				this.updateMenuCheckboxesRecursive(conditionsMenu, this.selectedCondition);
				return;
			}
			
			// Carry the user's live edit forward to the new condition, since this.value is
			// otherwise only set at load time and would revert on a switch. Skipped during the
			// initial load, when there's no prior condition.
			if (this.selectedCondition) {
				this.value = this.getCurrentValue();
			}

			// Changing the condition counts as engaging with a "+"-added row (see clearPendingAdd)
			this._pendingAdd = false;

			this.selectedCondition = conditionName;
			this.selectedOperator = operatorsList.value;

			// Invalidate any in-flight async value-menu population (annotationAuthor) from a
			// previous selection, and clear the pending flag for synchronous conditions
			let valueMenuToken = this._valueMenuToken = {};
			this._valueMenuPending = false;

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

					let cols = Zotero.Collections.getByLibrary(libraryID, true);
					for (let col of cols) {
						rows.push({
							name: Zotero.Utilities.trimInternal(col.name),
							value: 'C' + col.key,
							image: Zotero.Collection.prototype.treeViewImage,
							level: col.level
						});
					}

					this.createValueMenu(rows);
					break;
				}
				case 'savedSearch':
				{
					let rows = [];

					let libraryID = this.parent.search.libraryID;

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
				case 'annotationType':
				{
					let types = [
						['highlight', Zotero.Annotations.ANNOTATION_TYPE_HIGHLIGHT],
						['underline', Zotero.Annotations.ANNOTATION_TYPE_UNDERLINE],
						['note', Zotero.Annotations.ANNOTATION_TYPE_NOTE],
						['text', Zotero.Annotations.ANNOTATION_TYPE_TEXT],
						['image', Zotero.Annotations.ANNOTATION_TYPE_IMAGE],
						['ink', Zotero.Annotations.ANNOTATION_TYPE_INK],
					];
					let rows = types.map(([name, value]) => ({
						name: Zotero.getString('reader-' + name + '-annotation'),
						value
					}));
					this.createValueMenu(rows);
					break;
				}
				case 'annotationColor':
				{
					let rows = Zotero.Annotations.COLORS.map(([name, value]) => ({
						name: Zotero.getString(name),
						value
					}));
					this.createValueMenu(rows);
					break;
				}
				case 'annotationAuthor':
				{
					// The author list loads asynchronously; until the menu is populated, the
					// row serializes its stored value (see getConditionData())
					this._valueMenuPending = true;
					let authors = await Zotero.Annotations.getAllAuthors(this.parent.search.libraryID);
					// A newer selection took over while the list was loading
					if (valueMenuToken !== this._valueMenuToken) {
						return;
					}
					let collation = Zotero.getLocaleCollation();
					let rows = authors.map(a => ({ name: a.name, value: a.userID }));
					rows.sort((a, b) => collation.compareString(1, a.name, b.name));
					this.createValueMenu(rows);
					this._valueMenuPending = false;
					break;
				}
				case 'attachmentStorageType':
				{
					let rows = ['stored', 'linked'].map(type => ({
						name: Zotero.getString('attachment-storage-type-' + type),
						value: type
					}));
					
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
					|| this.selectedCondition == 'savedSearch'
					|| this.selectedCondition == 'itemType'
					|| this.selectedCondition == 'fileTypeID'
					|| this.selectedCondition == 'annotationType'
					|| this.selectedCondition == 'annotationColor'
					|| this.selectedCondition == 'annotationAuthor'
					|| this.selectedCondition == 'attachmentStorageType') {
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

			// Changing the condition or operator is a mutation like add/remove, so rebuild the
			// search and refresh the derived UI (binding hint, level warning) right away. The
			// condition/operator menus stopPropagation, so this won't happen via event bubbling.
			// (updateSearch no-ops during the initial render via its own guard.)
			if (this.parent) {
				this.parent.updateSearch();
			}
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
				// Indent nested rows (subcollections)
				if (row.level) {
					menuitem.style.setProperty('--nesting-level', row.level);
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
			// remove both when the selection spans multiple libraries
			if (this.parent.scopeLibraryIDs && this.parent.scopeLibraryIDs.length > 1) {
				for (let value of ['collection', 'savedSearch']) {
					let item = menu.querySelector(`menuitem[value="${value}"]`);
					if (item) {
						item.remove();
					}
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
				
				menu.setAttribute('value', condition.condition);
				
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

		// The live value from whichever value control is currently shown, in the same prefixed
		// form this.value is stored in (so it can be carried across a condition change)
		getCurrentValue() {
			// While a value menu is still being populated asynchronously, the old control is
			// still the visible one, so use the stored value (see getConditionData())
			if (this._valueMenuPending) {
				return this.value;
			}
			let valueField = this.querySelector('#valuefield');
			if (!valueField.hidden) {
				return valueField.value;
			}
			let ageField = this.querySelector('#value-date-age');
			if (!ageField.hidden) {
				return ageField.value;
			}
			return this.querySelector('#valuemenu').value;
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

			// A value menu still being populated asynchronously (annotationAuthor) hasn't been
			// swapped in yet, so serialize the stored value rather than reading the wrong control
			if (this._valueMenuPending) {
				return { condition, operator, value: this.value || '' };
			}

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
			else if (condition == 'collection' || condition == 'savedSearch') {
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
				mode: undefined
			}, this.nextElementSibling);
			// Don't let the seeded row trigger the binding hint/warning until the user engages
			// with it (see ZoteroSearch.clearPendingAdd)
			row._pendingAdd = true;
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
				ref = { id: undefined, condition, mode, operator: data.operator, value: data.value };
			}
			var newGroup = document.createXULElement('search-condition-group');
			group.conditionsContainer.insertBefore(newGroup, this);
			newGroup.addCondition(ref);
			this.remove();

			this.parent.updateSearch();
			this.parent.updateRemoveButtons();
			newGroup.conditionsContainer.firstElementChild.querySelector('#conditionsmenu').focus();
		}

		// The item level this condition matches at ('item' by default), used to decide
		// cross-level binding in a group
		get conditionLevel() {
			let data = this.selectedCondition && Zotero.SearchConditions.get(this.selectedCondition);
			return (data && data.level) || 'item';
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
