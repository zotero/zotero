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
const { IntlProvider } = require('react-intl');
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

Zotero.TagSelector = class TagSelectorContainer extends React.PureComponent {
	constructor(props) {
		super(props);
		this._notifierID = Zotero.Notifier.registerObserver(
			this,
			['collection-item', 'item', 'item-tag', 'tag', 'setting'],
			'tagSelector'
		);
		this._prefObserverID = Zotero.Prefs.registerObserver('fontSize', this.handleFontChange.bind(this));
		
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
			...this.getFontInfo()
		};
	}
	
	focusTextbox() {
		this.searchBoxRef.current.focus();
	}
	
	componentDidUpdate(_prevProps, _prevState) {
		Zotero.debug("Tag selector updated");
		
		// If we changed collections, scroll to top
		if (this.collectionTreeRow && this.collectionTreeRow.id != this.prevTreeViewID) {
			this.tagListRef.current.scrollToTop();
			this.prevTreeViewID = this.collectionTreeRow.id;
		}
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
			newState.tagColors = Zotero.Tags.getColors(libraryID);
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
		var elem = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
		elem.className = 'tag-selector-item';
		elem.style.position = 'absolute';
		elem.style.opacity = 0;
		var container = document.getElementById(this.props.container);
		container.appendChild(elem);
		var style = window.getComputedStyle(elem);
		var props = {
			fontSize: style.getPropertyValue('font-size'),
			fontFamily: style.getPropertyValue('font-family')
		};
		container.removeChild(elem);
		return props;
	}
	
	/**
	 * Recompute tag widths based on the current font settings
	 */
	handleFontChange() {
		this.widths.clear();
		this.widthsBold.clear();
		this.setState({
			...this.getFontInfo()
		});
	}
	
	/**
	 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
	 *
	 * @param {String} text The text to be rendered.
	 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "bold 14px verdana").
	 *
	 * @see https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
	 */
	getTextWidth(text, font) {
		// re-use canvas object for better performance
		var canvas = this.canvas || (this.canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas"));
		var context = canvas.getContext("2d");
		context.font = font;
		// Add a little more to make sure we don't crop
		var metrics = context.measureText(text);
		return Math.ceil(metrics.width);
	}
	
	getWidth(name) {
		var num = 0;
		var font = this.state.fontSize + ' ' + this.state.fontFamily;
		// Colored tags are shown in bold, which results in a different width
		var fontBold = 'bold ' + font;
		let hasColor = this.state.tagColors.has(name);
		let widths = hasColor ? this.widthsBold : this.widths;
		let width = widths.get(name);
		if (width === undefined) {
			width = this.getTextWidth(name, hasColor ? fontBold : font);
			//Zotero.debug(`Calculated ${hasColor ? 'bold ' : ''}width of ${width} for tag '${name}'`);
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
		tags = tags.map((tag) => {
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
			tag.width = this.getWidth(name);
			return tag;
		});
		//Zotero.debug(`Prepared tags in ${new Date() - d} ms`);
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
		tagContextMenu.openPopup(null, null, ev.clientX+2, ev.clientY+2);
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
			
			var elem = event.target;
			
			// Ignore drops not on tags
			if (!elem.classList.contains('tag-selector-item')) {
				return;
			}
			
			// Store the event, because drop event does not have shiftKey attribute set
			Zotero.DragDrop.currentEvent = event;
			elem.classList.add('dragged-over');
			event.preventDefault();
			event.dataTransfer.dropEffect = "copy";
		},
		onDragExit: function (event) {
			Zotero.DragDrop.currentEvent = null;
			event.target.classList.remove('dragged-over');
		},
		onDrop: async function(event) {
			var elem = event.target;
			
			// Ignore drops not on tags
			if (!elem.classList.contains('tag-selector-item')) {
				return;
			}

			elem.classList.remove('dragged-over');
			
			var dt = event.dataTransfer;
			var ids = dt.getData('zotero/item');
			if (!ids) {
				return;
			}
			
			return Zotero.DB.executeTransaction(function* () {
				ids = ids.split(',');
				var items = Zotero.Items.get(ids);
				var value = elem.textContent;
				
				for (let i=0; i<items.length; i++) {
					let item = items[i];
					if (Zotero.DragDrop.currentEvent.shiftKey) {
						item.removeTag(value);
					} else {
						item.addTag(value);
					}
					yield item.save();
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
			var ps = Cc['@mozilla.org/embedcomp/prompt-service;1']
				.getService(Ci.nsIPromptService);
			ps.alert(null, '', Zotero.getString('pane.tagSelector.maxColoredTags', Zotero.Tags.MAX_COLORED_TAGS));
			return;
		}
		
		io.tagColors = tagColors;
		
		window.openDialog(
			'chrome://zotero/content/tagColorChooser.xul',
			'zotero-tagSelector-colorChooser',
			'chrome,modal,centerscreen', io
		);
		
		// Dialog cancel
		if (typeof io.color == 'undefined') {
			return;
		}
		
		await Zotero.Tags.setColor(this.libraryID, io.name, io.color, io.position);
	}

	async openRenamePrompt() {
		var promptService = Cc['@mozilla.org/embedcomp/prompt-service;1']
			.getService(Ci.nsIPromptService);

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
		var promptService = Cc['@mozilla.org/embedcomp/prompt-service;1']
			.getService(Ci.nsIPromptService);
			
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
		
		var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
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
	
	static init(domEl, opts) {
		var ref;
		let elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<TagSelectorContainer ref={c => ref = c } {...opts} />
			</IntlProvider>
		);
		ReactDOM.render(elem, domEl);
		ref.domEl = domEl;
		return ref;
	}
	
	uninit() {
		ReactDOM.unmountComponentAtNode(this.domEl);
		Zotero.Notifier.unregisterObserver(this._notifierID);
		Zotero.Prefs.unregisterObserver(this._prefObserverID);
	}
	
	static propTypes = {
		container: PropTypes.string.isRequired,
		onSelection: PropTypes.func.isRequired,
	};
};

})();