/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
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

/* global Zotero: false */
'use strict';

(function () {

const React = require('react');
const ReactDOM = require('react-dom');
const PropTypes = require('prop-types');
const TagSelector = require('components/tagSelector.js');
const defaults = {
	tagColors: new Map(),
	tags: [],
	scope: null,
	showAutomatic: Zotero.Prefs.get('tagSelector.showAutomatic'),
	searchString: '',
	loaded: false
};
const { Cc, Ci } = require('chrome');

// first n tags will be measured using DOM method for more accurate measurment (at the cost of performance)
const FORCE_DOM_TAGS_FOR_COUNT = 200;

Zotero.TagSelector = class TagSelectorContainer extends React.PureComponent {
	constructor(props) {
		super(props);
		this._notifierID = Zotero.Notifier.registerObserver(
			this,
			['collection-item', 'item', 'item-tag', 'tag', 'setting'],
			'tagSelector'
		);
		this._prefObserverID = Zotero.Prefs.registerObserver('fontSize', this.handleUIPropertiesChange.bind(this));
		this._prefObserverID = Zotero.Prefs.registerObserver('uiDensity', this.handleUIPropertiesChange.bind(this));
		this._mediaQueryList = window.matchMedia("(min-resolution: 1.5dppx)");
		this._mediaQueryList.addEventListener("change", this.handleUIPropertiesChange.bind(this));
		
		this.tagListRef = React.createRef();
		this.searchBoxRef = React.createRef();
		
		this.displayAllTags = Zotero.Prefs.get('tagSelector.displayAllTags');
		// Not stored in state to avoid an unnecessary refresh. Instead, when a tag is selected, we
		// trigger the selection handler, which updates the visible items, which triggers
		// onItemViewChanged(), which triggers a refresh with the new tags.
		this.selectedTags = new Set();
		this.widths = new Map();
		this.widthsBold = new Map();
		
		this.state = {
			...defaults,
			...this.getContainerDimensions(),
			...this.getFontInfo(),
			isHighDensity: this._mediaQueryList.matches
		};
	}
	
	focusTextbox() {
		this.searchBoxRef.current.focus();
	}

	focusTagList() {
		this.tagListRef.current.focus();
	}

	isTagListEmpty() {
		return this.tagListRef.current.isEmpty();
	}

	componentDidCatch(error, info) {
		// Async operations might attempt to update the react components
		// after window close in tests, which will cause unnecessary crashing.
		if (this._uninitialized) return;
		Zotero.debug("TagSelectorContainer: React threw an error");
		Zotero.logError(error);
		Zotero.debug(info);
		Zotero.crash();
	}
	
	componentDidUpdate(_prevProps, _prevState) {
		Zotero.debug("Tag selector updated");
		
		// If we changed collections, scroll to top
		if (this.collectionTreeRow && this.collectionTreeRow.id != this.prevTreeViewID) {
			this.tagListRef.current.scrollToTop();
			this.prevTreeViewID = this.collectionTreeRow.id;
		}
	}

	getSnapshotBeforeUpdate(_) {
		// Clear the focused tag's record if the props change
		this.tagListRef.current.clearRecordedFocusedTag();
		return null;
	}
	
	// Update trigger #1 (triggered by ZoteroPane)
	async onItemViewChanged({ collectionTreeRow, libraryID }) {
		Zotero.debug('Updating tag selector from current view');
		
		var prevLibraryID = this.libraryID;
		this.collectionTreeRow = collectionTreeRow;
		this.libraryID = libraryID;
		
		var newState = {
			loaded: true
		};
		if (prevLibraryID != libraryID) {
			if (libraryID) {
				newState.tagColors = Zotero.Tags.getColors(libraryID);
			}
			else {
				newState.tagColors = new Map();
			}
		}
		var { tags, scope } = await this.getTagsAndScope();
		newState.tags = tags;
		newState.scope = scope;
		this.setState(newState);
	}
	
	// Update trigger #2
	async notify(event, type, ids, extraData) {
		if (type === 'setting') {
			if (ids.some(val => val.split('/')[1] == 'tagColors')) {
				Zotero.debug("Updating tag selector after tag color change");
				this.setState({
					tagColors: Zotero.Tags.getColors(this.libraryID)
				});
			}
			return;
		}
		
		// Ignore anything other than deletes in duplicates view
		if (this.collectionTreeRow && this.collectionTreeRow.isDuplicates()) {
			switch (event) {
				case 'delete':
				case 'trash':
					break;
				
				default:
					return;
			}
		}
		
		// Ignore item events other than 'trash'
		if (type == 'item' && event != 'trash') {
			return;
		}
		
		// Ignore tag deletions, which are handled by 'item-tag' 'remove'
		if (type == 'tag') {
			return;
		}
		
		Zotero.debug("Updating tag selector after tag change");
		
		if (type == 'item-tag' && ['add', 'remove'].includes(event)) {
			let changedTagsInScope = [];
			let changedTagsInView = [];
			// Group tags by tag type for lookup
			let tagsByType = new Map();
			for (let id of ids) {
				let [_, tagID] = id.split('-');
				let type = extraData[id].type;
				let typeTags = tagsByType.get(type);
				if (!typeTags) {
					typeTags = [];
					tagsByType.set(type, typeTags);
				}
				typeTags.push(parseInt(tagID));
			}
			// Check tags for each tag type to see if they're in view/scope
			for (let [type, tagIDs] of tagsByType) {
				changedTagsInScope.push(...await this.collectionTreeRow.getTags([type], tagIDs));
				if (this.displayAllTags) {
					changedTagsInView.push(
						...await Zotero.Tags.getAllWithin({ libraryID: this.libraryID, tagIDs })
					);
				}
			}
			if (!this.displayAllTags) {
				changedTagsInView = changedTagsInScope;
			}
			changedTagsInScope = new Set(changedTagsInScope.map(tag => tag.tag));
			
			if (event == 'add') {
				this.sortTags(changedTagsInView);
				if (!changedTagsInView.length) {
					return;
				}
				this.setState((state, _props) => {
					// Insert sorted
					var newTags = [...state.tags];
					var newScope = state.scope ? new Set(state.scope) : new Set();
					var scopeChanged = false;
					var start = 0;
					var collation = Zotero.getLocaleCollation();
					for (let tag of changedTagsInView) {
						let name = tag.tag;
						let added = false;
						for (let i = start; i < newTags.length; i++) {
							start++;
							let cmp = collation.compareString(1, newTags[i].tag, name);
							// Skip tag if it already exists
							if (cmp == 0) {
								added = true;
								break;
							}
							if (cmp > 0) {
								newTags.splice(i, 0, tag);
								added = true;
								break;
							}
						}
						if (!added) {
							newTags.push(tag);
						}
						
						if (changedTagsInScope.has(name) && !newScope.has(name)) {
							newScope.add(name);
							scopeChanged = true;
						}
					}
					
					var newState = {
						tags: newTags
					};
					if (scopeChanged) {
						newState.scope = newScope;
					}
					return newState;
				});
				return;
			}
			else if (event == 'remove') {
				changedTagsInView = new Set(changedTagsInView.map(tag => tag.tag));
				
				this.setState((state, props) => {
					var previousTags = new Set(state.tags.map(tag => tag.tag));
					var tagsToRemove = new Set();
					var newScope;
					var selectionChanged = false;
					for (let id of ids) {
						let name = extraData[id].tag;
						let removed = false;
						
						// If tag was shown previously and shouldn't be anymore, remove from view
						if (previousTags.has(name) && !changedTagsInView.has(name)) {
							tagsToRemove.add(name);
							removed = true;
						}
						
						// Remove from scope if there is one
						if (state.scope && state.scope.has(name) && !changedTagsInScope.has(name)) {
							if (!newScope) {
								newScope = new Set(state.scope);
							}
							newScope.delete(name);
							removed = true;
						}
						
						// Removed from either view or scope
						if (removed) {
							// Deselect if selected
							if (this.selectedTags.has(name)) {
								this.selectedTags.delete(name);
								selectionChanged = true;
							}
							
							// If removing a tag from view, clear its cached width. It might still
							// be in this or another library, but if so we'll just recalculate its
							// width the next time it's needed.
							this.widths.delete(name);
							this.widthsBold.delete(name);
						}
					}
					if (selectionChanged && typeof props.onSelection == 'function') {
						props.onSelection(this.selectedTags);
					}
					var newState = {};
					if (tagsToRemove.size) {
						newState.tags = state.tags.filter(tag => !tagsToRemove.has(tag.tag));
					}
					if (newScope) {
						newState.scope = newScope;
					}
					return newState;
				});
				return;
			}
		}
		
		this.setState(await this.getTagsAndScope());
	}
	
	async getTagsAndScope() {
		var tags = await this.collectionTreeRow.getTags();
		// The scope is all visible tags, not all tags in the library
		var scope = new Set(tags.map(t => t.tag));
		if (this.displayAllTags) {
			tags = await Zotero.Tags.getAll(this.libraryID);
		}
		
		// If tags haven't changed, return previous array without sorting again
		if (this.state.tags.length == tags.length) {
			let prevTags = new Set(this.state.tags.map(tag => tag.tag));
			let same = true;
			for (let tag of tags) {
				if (!prevTags.has(tag.tag)) {
					same = false;
					break;
				}
			}
			if (same) {
				Zotero.debug("Tags haven't changed");
				return {
					tags: this.state.tags,
					scope
				};
			}
		}
		
		this.sortTags(tags);
		return { tags, scope };
	}
	
	sortTags(tags) {
		var d = new Date();
		var collation = Zotero.Intl.collation;
		tags.sort(function (a, b) {
			return collation.compareString(1, a.tag, b.tag);
		});
		Zotero.debug(`Sorted tags in ${new Date() - d} ms`);
	}
	
	getContainerDimensions() {
		var container = document.getElementById(this.props.container);
		return {
			width: container.clientWidth,
			height: container.clientHeight
		};
	}
	
	handleResize() {
		//Zotero.debug("Resizing tag selector");
		var { width, height } = this.getContainerDimensions();
		this.setState({ width, height });
	}
	
	getFontInfo() {
		var elem = document.createElement("div");
		elem.className = 'tag-selector-item';
		elem.style.position = 'absolute';
		elem.style.opacity = 0;
		var container = document.getElementById(this.props.container);
		container.appendChild(elem);
		var style = window.getComputedStyle(elem);
		var props = {
			lineHeight: style.getPropertyValue('line-height'),
			fontSize: style.getPropertyValue('font-size'),
			fontFamily: style.getPropertyValue('font-family')
		};
		container.removeChild(elem);
		return props;
	}
	
	/**
	 * Recompute tag widths when either font, UI density or pixel density changes
	 */
	handleUIPropertiesChange(ev) {
		this.widths.clear();
		this.widthsBold.clear();
		const isHighDensity = ev.target instanceof MediaQueryList ? ev.matches : this.state.isHighDensity;
		this.setState({
			...this.getFontInfo(),
			uiDensity: Zotero.Prefs.get('uiDensity'),
			isHighDensity
		});
	}
	
	/**
	 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
	 * Except for emoji tags, where, on high-density screens, we use actual DOM element for more accurate
	 * measurement (which is 4-5x slower) because canvas method can be off by enough to cause visible artifacts.
	 * It's possible to force use of DOM method for other tags using forceUseDOM parameter.
	 *
	 * @param {String} text The text to be rendered.
	 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
	 * @param {String} forceUseDOM Force use of DOM method for measuring text width
	 *
	 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
	 */
	getTextWidth(text, font, forceUseDOM = false) {
		let width;
		const useDOM = forceUseDOM || (this.state.isHighDensity && Zotero.Utilities.Internal.includesEmoji(text));
		if (useDOM) {
			if (!this.divMeasure) {
				this.divMeasure = document.createElement('div');
				this.divMeasure.style.position = 'absolute';
				this.divMeasure.style.top = '-9999px';
				this.divMeasure.whiteSpace = 'nowrap';
				document.querySelector('#zotero-tag-selector').appendChild(this.divMeasure);
			}

			this.divMeasure.style.font = font;
			this.divMeasure.textContent = text;
			width = this.divMeasure.clientWidth;
			this.divMeasure.textContent = '';
		}
		else {
			// re-use canvas object for better performance
			var canvas = this.canvas || (this.canvas = document.createElement("canvas"));
			var context = canvas.getContext("2d");
			context.font = font;
			var metrics = context.measureText(text);
			width = metrics.width;
		}
		
		return width;
	}
	
	getWidth(name, forceUseDOM = false) {
		var font = this.state.fontSize + ' ' + this.state.fontFamily;
		// Colored tags are shown in bold, which results in a different width
		var fontBold = 'bold ' + font;
		let hasColor = this.state.tagColors.has(name);
		let widths = hasColor ? this.widthsBold : this.widths;
		let width = widths.get(name);
		if (width === undefined) {
			width = this.getTextWidth(name, hasColor ? fontBold : font, forceUseDOM);
			// Zotero.debug(`Calculated ${hasColor ? 'bold ' : ''}width of ${width} for tag '${name}' using ${forceUseDOM ? 'DOM' : 'hybrid'} method`);
			widths.set(name, width);
		}
		return width;
	}
	
	render() {
		Zotero.debug("Rendering tag selector");
		var tags = this.state.tags;
		var tagColors = this.state.tagColors;
		
		if (!this.state.showAutomatic) {
			tags = tags.filter(t => t.type != 1);
		}
		// Remove duplicates from auto and manual tags
		else {
			let seen = new Set();
			let newTags = [];
			for (let tag of tags) {
				if (!seen.has(tag.tag)) {
					newTags.push(tag);
					seen.add(tag.tag);
				}
			}
			tags = newTags;
		}
		
		// Extract colored tags
		var coloredTags = [];
		for (let i = 0; i < tags.length; i++) {
			if (tagColors.has(tags[i].tag)) {
				coloredTags.push(...tags.splice(i, 1));
				i--;
			}
		}
		
		// Add colored tags that aren't already real tags
		var extractedColoredTags = new Set(coloredTags.map(tag => tag.tag));
		[...tagColors.keys()]
			.filter(tag => !extractedColoredTags.has(tag))
			.forEach(tag => coloredTags.push(Zotero.Tags.cleanData({ tag })));
		
		// Sort colored tags and place at beginning
		coloredTags.sort((a, b) => {
			return tagColors.get(a.tag).position - tagColors.get(b.tag).position;
		});
		tags = coloredTags.concat(tags);
		
		// Filter
		if (this.state.searchString) {
			let lcStr = this.state.searchString.toLowerCase();
			tags = tags.filter(tag => tag.tag.toLowerCase().includes(lcStr));
		}
		
		// Prepare tag objects for list component
		//var d = new Date();
		var inTagColors = true;
		tags = tags.map((tag, i) => {
			let name = tag.tag;
			tag = {
				name,
				width: tag.width
			};
			if (this.selectedTags.has(name)) {
				tag.selected = true;
			}
			if (inTagColors && tagColors.has(name)) {
				tag.color = tagColors.get(name).color;
			}
			else {
				inTagColors = false;
			}
			// If we're not displaying all tags, we only need to check the scope for colored tags,
			// since everything else will be in scope
			if ((this.displayAllTags || inTagColors) && !this.state.scope.has(name)) {
				tag.disabled = true;
			}
			const forceUseDOM = this.state.isHighDensity && i < FORCE_DOM_TAGS_FOR_COUNT;
			tag.width = this.getWidth(name, forceUseDOM);
			return tag;
		});
		// clean up divMeasure, which might have been used for measuring emoji tags
		this.divMeasure?.parentNode?.removeChild?.(this.divMeasure);
		this.divMeasure = null;
		// Zotero.debug(`Prepared ${tags.length} tags in ${new Date() - d} ms`);
		return <TagSelector
			tags={tags}
			searchBoxRef={this.searchBoxRef}
			tagListRef={this.tagListRef}
			searchString={this.state.searchString}
			dragObserver={this.dragObserver}
			onSelect={this.handleTagSelected}
			onTagContext={this.handleTagContext}
			onSearch={this.handleSearch}
			onSettings={this.handleSettings.bind(this)}
			loaded={this.state.loaded}
			width={this.state.width}
			height={this.state.height}
			fontSize={parseInt(this.state.fontSize.replace('px', ''))}
			lineHeight={parseInt(this.state.lineHeight.replace('px', ''))}
			uiDensity={Zotero.Prefs.get('uiDensity')}
		/>;
	}

	setMode(mode) {
		this.state.viewOnly != (mode == 'view') && this.setState({viewOnly: mode == 'view'});
	}

	handleTagContext = (tag, ev) => {
		let tagContextMenu = document.getElementById('tag-menu');
		// Disable menu options in read-only mode
		for (let i = 0; i < tagContextMenu.childNodes.length; i++) {
			tagContextMenu.childNodes[i].disabled = this.state.viewOnly;
		}
		ev.preventDefault();
		
		tagContextMenu.openPopupAtScreen(
			ev.screenX + 1,
			ev.screenY + 1,
			true
		);
		this.contextTag = tag;
	}

	handleSettings = (ev) => {
		let settingsContextMenu = document.getElementById('tag-selector-view-settings-menu');
		ev.preventDefault();
		settingsContextMenu.openPopup(ev.target, 'end_before', 0, 0, true);
	}

	handleTagSelected = (tag) => {
		let selectedTags = this.selectedTags;
		if(selectedTags.has(tag)) {
			selectedTags.delete(tag);
		} else {
			selectedTags.add(tag);
		}

		if (typeof(this.props.onSelection) === 'function') {
			this.props.onSelection(selectedTags);
		}
	}

	handleSearch = (searchString) => {
		this.setState({searchString});
	}
	
	dragObserver = {
		onDragOver: function(event) {
			if (!event.dataTransfer.getData('zotero/item')) {
				return;
			}
			
			let elem = event.target.closest('.tag-selector-item');
			
			// Ignore drops not on tags
			if (elem === null) {
				return;
			}
			
			elem.classList.add('dragged-over');
			event.preventDefault();
			// Don't show + cursor when removing tags
			var remove = (Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey);
			event.dataTransfer.dropEffect = remove ? "move" : "copy";
		},
		onDragExit: function (event) {
			event.target.closest('.tag-selector-item')?.classList?.remove?.('dragged-over');
		},
		onDrop: async function(event) {
			let elem = event.target.closest('.tag-selector-item');
			
			// Ignore drops not on tags
			if (elem === null) {
				return;
			}

			elem.classList.remove('dragged-over');
			
			var dt = event.dataTransfer;
			var ids = dt.getData('zotero/item');
			if (!ids) {
				return;
			}
			
			// Remove tags on Cmd-drag/Shift-drag
			var remove = (Zotero.isMac && event.metaKey) || (!Zotero.isMac && event.shiftKey);
			
			return Zotero.DB.executeTransaction(async function () {
				ids = ids.split(',');
				var items = Zotero.Items.get(ids);
				var value = elem.textContent;
				
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					if (remove) {
						item.removeTag(value);
					}
					else {
						item.addTag(value);
					}
					await item.save();
				}
			}.bind(this));
		}
	}

	getTagSelection() {
		return this.selectedTags;
	}

	clearTagSelection() {
		this.selectedTags = new Set();
	}
	
	async openColorPickerWindow() {
		var io = {
			libraryID: this.libraryID,
			name: this.contextTag.name
		};
		
		var tagColors = this.state.tagColors;
		if (tagColors.size >= Zotero.Tags.MAX_COLORED_TAGS && !tagColors.has(io.name)) {
			var ps = Services.prompt;
			ps.alert(null, '', Zotero.getString('pane.tagSelector.maxColoredTags', Zotero.Tags.MAX_COLORED_TAGS));
			return;
		}
		
		io.tagColors = tagColors;
		
		window.openDialog(
			'chrome://zotero/content/tagColorChooser.xhtml',
			'zotero-tagSelector-colorChooser',
			'chrome,modal,centerscreen', io
		);
		
		// Dialog cancel
		if (typeof io.color == 'undefined') {
			return;
		}
		
		await Zotero.Tags.setColor(this.libraryID, io.name, io.color, io.position);
	}

	async openTagSplitterWindow() {
		const oldTagName = this.contextTag.name; // contextTag contains { name, width, color }
		const dataIn = {
			oldTag: this.contextTag.name,
			isLongTag: false
		};
		const dataOut = { result: null };
		
		window.openDialog(
			'chrome://zotero/content/longTagFixer.xhtml',
			'',
			'chrome,modal,centerscreen',
			dataIn, dataOut
		);

		if (!dataOut.result) {
			return;
		}

		const oldTagID = Zotero.Tags.getID(oldTagName);

		if (dataOut.result.op === 'split') {
			const itemIDs = await Zotero.Tags.getTagItems(this.libraryID, oldTagID);
			await Zotero.DB.executeTransaction(async () => {
				for (const itemID of itemIDs) {
					const item = await Zotero.Items.getAsync(itemID);
					const tagType = item.getTagType(oldTagName);
					for (const newTagName of dataOut.result.tags) {
						item.addTag(newTagName, tagType);
					}
					item.removeTag(oldTagName);
					await item.save();
				}
				await Zotero.Tags.purge(oldTagID);
			});
		} else {
			throw new Error('Unsupported op: ' + dataOut.result.op);
		}
	}

	async openRenamePrompt() {
		var promptService = Services.prompt;

		var newName = { value: this.contextTag.name };
		var result = promptService.prompt(window,
			Zotero.getString('pane.tagSelector.rename.title'),
			Zotero.getString('pane.tagSelector.rename.message'),
			newName, '', {});

		if (!result || !newName.value || this.contextTag.name == newName.value) {
			return;
		}
		
		let selectedTags = this.selectedTags;
		if (selectedTags.has(this.contextTag.name)) {
			selectedTags.delete(this.contextTag.name);
			selectedTags.add(newName.value);
		}
		
		if (Zotero.Tags.getID(this.contextTag.name)) {
			await Zotero.Tags.rename(this.libraryID, this.contextTag.name, newName.value);
		}
		// Colored tags don't need to exist, so in that case
		// just rename the color setting
		else {
			let color = Zotero.Tags.getColor(this.libraryID, this.contextTag.name);
			if (!color) {
				throw new Error("Can't rename missing tag");
			}
			await Zotero.Tags.setColor(this.libraryID, this.contextTag.name, false);
			await Zotero.Tags.setColor(this.libraryID, newName.value, color.color);
		}
	}

	async openDeletePrompt() {
		var promptService = Services.prompt;
			
		var confirmed = promptService.confirm(window,
			Zotero.getString('pane.tagSelector.delete.title'),
			Zotero.getString('pane.tagSelector.delete.message'));
			
		if (!confirmed) {
			return;
		}
			
		var tagID = Zotero.Tags.getID(this.contextTag.name);

		if (tagID) {
			await Zotero.Tags.removeFromLibrary(this.libraryID, tagID);
		}
		// If only a tag color setting, remove that
		else {
			await Zotero.Tags.setColor(this.libraryID, this.contextTag.name, false);
		}
	}

	async toggleDisplayAllTags(newValue) {
		newValue = typeof(newValue) === 'undefined' ? !this.displayAllTags : newValue;
		Zotero.Prefs.set('tagSelector.displayAllTags', newValue);
		this.displayAllTags = newValue;
		this.setState(await this.getTagsAndScope());
	}

	toggleShowAutomatic(newValue) {
		newValue = typeof(newValue) === 'undefined' ? !this.showAutomatic : newValue;
		Zotero.Prefs.set('tagSelector.showAutomatic', newValue);
		this.setState({showAutomatic: newValue});
	}

	deselectAll() {
		this.selectedTags = new Set();
		if('onSelection' in this.props && typeof(this.props.onSelection) === 'function') {
			this.props.onSelection(this.selectedTags);
		}
	}
	
	async deleteAutomatic() {
		var num = (await Zotero.Tags.getAutomaticInLibrary(this.libraryID)).length;
		if (!num) {
			return;
		}
		
		var ps = Services.prompt;
		var confirmed = ps.confirm(
			window,
			Zotero.getString('pane.tagSelector.deleteAutomatic.title'),
			Zotero.getString(
					'pane.tagSelector.deleteAutomatic.message',
					new Intl.NumberFormat().format(num),
					num
				)
				+ "\n\n"
				+ Zotero.getString('general.actionCannotBeUndone')
		);
		if (confirmed) {
			Zotero.showZoteroPaneProgressMeter(null, true);
			try {
				await Zotero.Tags.removeAutomaticFromLibrary(
					this.libraryID,
					(progress, progressMax) => {
						Zotero.updateZoteroPaneProgressMeter(
							Math.round(progress / progressMax * 100)
						);
					}
				);
			}
			finally {
				Zotero.hideZoteroPaneOverlays();
			}
		}
	}

	get label() {
		let count = this.selectedTags.size;
		let mod = count === 1 ? 'singular' : count === 0 ? 'none' : 'plural';

		return Zotero.getString('pane.tagSelector.numSelected.' + mod, [count]);
	}

	get showAutomatic() {
		return this.state.showAutomatic;
	}
	
	static async init(domEl, opts) {
		var ref;
		await new Promise((resolve) => {
			let root = ReactDOM.createRoot(domEl);
			opts.root = root;
			root.render(<TagSelectorContainer ref={(c) => {
				ref = c;
				resolve();
			} } {...opts} />);
		});
		return ref;
	}
	
	uninit() {
		this._uninitialized = true;
		this.props.root.unmount();
		Zotero.Notifier.unregisterObserver(this._notifierID);
		Zotero.Prefs.unregisterObserver(this._prefObserverID);
	}
	
	static propTypes = {
		container: PropTypes.string.isRequired,
		onSelection: PropTypes.func.isRequired,
		root: PropTypes.object,
	};
};

})();