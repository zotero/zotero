/* global Zotero: false */
'use strict';

(function() {

const React = require('react');
const ReactDOM = require('react-dom');
const { IntlProvider } = require('react-intl');
const TagSelector = require('components/tag-selector.js');
const noop = Promise.resolve();
const defaults = {
	tagColors: new Map(),
	tags: [],
	showAutomatic: Zotero.Prefs.get('tagSelector.showAutomatic'),
	searchString: '',
	inScope: new Set(),
	loaded: false
};
const { Cc, Ci } = require('chrome');

Zotero.TagSelector = class TagSelectorContainer extends React.Component {
	constructor(props) {
		super(props);
		this._notifierID = Zotero.Notifier.registerObserver(
			this,
			['collection-item', 'item', 'item-tag', 'tag', 'setting'],
			'tagSelector'
		);
		this.displayAllTags = Zotero.Prefs.get('tagSelector.displayAllTags');
		this.selectedTags = new Set();
		this.state = defaults;
	}

	// Update trigger #1 (triggered by ZoteroPane)
	async onItemViewChanged({collectionTreeRow, libraryID, tagsInScope}) {
		this.collectionTreeRow = collectionTreeRow || this.collectionTreeRow;
		
		let newState = {loaded: true};
		
		if (!this.state.tagColors.length && libraryID && this.libraryID != libraryID) {
			newState.tagColors = Zotero.Tags.getColors(libraryID);
		}
		this.libraryID = libraryID;
		
		newState.tags = await this.getTags(tagsInScope,
			this.state.tagColors.length ? this.state.tagColors : newState.tagColors);
		this.setState(newState);
	}
	
	// Update trigger #2
	async notify(event, type, ids, extraData) {
		if (type === 'setting') {
			if (ids.some(val => val.split('/')[1] == 'tagColors')) {
				let tagColors = Zotero.Tags.getColors(this.libraryID);
				this.state.tagColors = tagColors;
				this.setState({tagColors, tags: await this.getTags(null, tagColors)});
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
		if (type == 'item' && (event == 'trash')) {
			return this.setState({tags: await this.getTags()});
		}
						
		// If a selected tag no longer exists, deselect it
		if (type == 'item-tag') {
			if (event == 'delete' || event == 'trash' || event == 'modify') {
				for (let tag of this.selectedTags) {
					if (tag == extraData[ids[0]].old.tag) {
						this.selectedTags.delete(tag);
					}
				}
			}
			return this.setState({tags: await this.getTags()});
		}
		
		this.setState({tags: await this.getTags()});
	}
	
	async getTags(tagsInScope, tagColors) {
		if (!tagsInScope) {
			tagsInScope = await this.collectionTreeRow.getChildTags();
		}
		this.inScope = new Set(tagsInScope.map(t => t.tag));
		let tags;
		if (this.displayAllTags) {
			tags = await Zotero.Tags.getAll(this.libraryID, [0, 1]);
		} else {
			tags = tagsInScope
		}
		
		tagColors = tagColors || this.state.tagColors;
			
		// Add colored tags that aren't already real tags
		let regularTags = new Set(tags.map(tag => tag.tag));
		let coloredTags = Array.from(tagColors.keys());

		coloredTags.filter(ct => !regularTags.has(ct)).forEach(x =>
			tags.push(Zotero.Tags.cleanData({ tag: x }))
		);
			
		// Sort by name (except for colored tags, which sort by assigned number key)
		tags.sort(function (a, b) {
			let aColored = tagColors.get(a.tag);
			let bColored = tagColors.get(b.tag);
			if (aColored && !bColored) return -1;
			if (!aColored && bColored) return 1;
			if (aColored && bColored) {
				return aColored.position - bColored.position;
			}
			
			return Zotero.getLocaleCollation().compareString(1, a.tag, b.tag);
		});
		
		return tags;
	}

	render() {
		let tags = this.state.tags;
		if (!this.state.showAutomatic) {
			tags = tags.filter(t => t.type != 1).map(t => t.tag);
		}
		// Remove duplicates from auto and manual tags
		else {
			tags = Array.from(new Set(tags.map(t => t.tag)));
		}
		if (this.state.searchString) {
			tags = tags.filter(tag => !!tag.match(new RegExp(this.state.searchString, 'i')));
		}
		tags = tags.map((name) => {
			return {
				name,
				selected: this.selectedTags.has(name),
				color: this.state.tagColors.has(name) ? this.state.tagColors.get(name).color : '',
				disabled: !this.inScope.has(name)
			}
		});	
		return <TagSelector
			tags={tags}
			ref={ref => this.focusTextbox = ref && ref.focusTextbox}
			searchString={this.state.searchString}
			shouldFocus={this.state.shouldFocus}
			dragObserver={this.dragObserver}
			onSelect={this.state.viewOnly ? () => {} : this.handleTagSelected}
			onTagContext={this.handleTagContext}
			onSearch={this.handleSearch}
			onSettings={this.handleSettings}
			loaded={this.state.loaded}
		/>;
	}

	setMode(mode) {
		this.state.viewOnly != (mode == 'view') && this.setState({viewOnly: mode == 'view'});
	}

	unregister() {
		ReactDOM.unmountComponentAtNode(this.domEl);
		if (this._notifierID) {
			Zotero.Notifier.unregisterObserver(this._notifierID);
		}
	}

	uninit() {
		this.setState({searchString: ''});
		this.selectedTags = new Set();
	}

	handleTagContext = (tag, ev) => {
		let tagContextMenu = document.getElementById('tag-menu');
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

	handleSearch = Zotero.Utilities.debounce((searchString) => {
		this.setState({searchString});
	})
	
	dragObserver = {
		onDragOver: function(event) {
			if (!event.dataTransfer.getData('zotero/item')) {
				return;
			}
			
			var elem = event.target;
			
			// Ignore drops not on tags
			if (elem.localName != 'li') {
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
			if (elem.localName != 'li') {
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
			var wasSelected = true;
			selectedTags.delete(this.contextTag.name);
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
		
		if (wasSelected) {
			selectedTags.add(newName.value);
		}
		this.setState({tags: await this.getTags()})
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

		this.setState({tags: await this.getTags()});
	}

	async toggleDisplayAllTags(newValue) {
		newValue = typeof(newValue) === 'undefined' ? !this.displayAllTags : newValue;
		Zotero.Prefs.set('tagSelector.displayAllTags', newValue);
		this.displayAllTags = newValue;
		this.setState({tags: await this.getTags()});
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
			<IntlProvider locale={Zotero.locale} messages={ZoteroPane.Containers.intlMessages}>
				<TagSelectorContainer ref={c => ref = c } {...opts} />
			</IntlProvider>
		);
		ReactDOM.render(elem, domEl);
		ref.domEl = domEl;
		return ref;
	}
}
})();
