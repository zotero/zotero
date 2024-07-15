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

const React = require('react');
const PropTypes = require('prop-types');
var { Collection } = require('react-virtualized');

// See also .tag-selector-item in _tag-selector.scss
var filterBarHeight = 37;
var tagPaddingLeft = 4;
var tagPaddingRight = 4;
var tagSpaceBetweenX = 2;
var tagSpaceBetweenY = 2;
var panePaddingTop = 8 + 1; // extra 1px offset for margin-bottom: -1px in #zotero-tags-splitter
var panePaddingLeft = 8;
var panePaddingRight = 2; // + scrollbar width (but no less than 8px total)
// var panePaddingBottom = 8; // configurable in _tag-selector.scss
var minHorizontalPadding = panePaddingLeft + tagPaddingLeft + tagPaddingRight + panePaddingRight;


class TagList extends React.PureComponent {
	constructor(props) {
		super(props);
		this.collectionRef = React.createRef();
		this.scrollToTopOnNextUpdate = false;
		this.prevTagCount = 0;
		this.focusedTagIndex = null;
		this.lastFocusedTagIndex = null;
		this.resolveTagsRenderedPromise = null;
		this.state = {
			scrollToCell: null
		};
	}
	
	componentDidUpdate(prevProps) {
		// Redraw all tags on every refresh
		if (this.collectionRef && this.collectionRef.current) {
			// If width or height changed, recompute positions. It seems like this should happen
			// automatically, but it doesn't as of 9.21.0. Also check for density change.

			if (prevProps.height != this.props.height
					|| prevProps.width != this.props.width
					|| prevProps.lineHeight != this.props.lineHeight
					|| prevProps.tags != this.props.tags
					|| prevProps.uiDensity !== this.props.uiDensity) {
				this.collectionRef.current.recomputeCellSizesAndPositions();
			}
			// If dimensions didn't change, just redraw at current positions. Without this, clicking
			// on a tag that doesn't change the tag count (as when clicking on a second tag in an
			// already filtered list) doesn't update the tag's selection state.
			else {
				this.collectionRef.current.forceUpdate();
			}
		}
		
		if (this.scrollToTopOnNextUpdate && this.collectionRef.current) {
			this.scrollToTop();
			this.scrollToTopOnNextUpdate = false;
		}
	}
	
	scrollToTop() {
		if (!this.collectionRef.current) return;
		// Scroll to the top of the view
		document.querySelector('.tag-selector-list').scrollTop = 0;
		// Reset internal component scroll state to force it to redraw components, since that
		// doesn't seem to happen automatically as of 9.21.0. Without this, scrolling down and
		// clicking on a tag blanks out the pane (presumably because it still thinks it's at an
		// offset where no tags exist).
		if (this.collectionRef.current._collectionView) {
			this.collectionRef.current._collectionView._setScrollPosition({
				scrollLeft: 0,
				scrollTop: 0
			});
		}
	}
	
	/**
	 * Calculate the x,y coordinates of all tags
	 */
	updatePositions() {
		const tagPaddingTop = this.props.uiDensity === 'comfortable' ? 2 : 1;
		const tagPaddingBottom = tagPaddingTop;
		this.scrollbarWidth = Math.max(Zotero.Utilities.Internal.getScrollbarWidth(), 6);

		var tagMaxWidth = this.props.width - minHorizontalPadding - this.scrollbarWidth;
		var rowHeight = tagPaddingTop + this.props.lineHeight + tagPaddingBottom + tagSpaceBetweenY;
		var positions = [];
		var row = 0;
		let rowX = panePaddingLeft;

		const separatorHeightCoefficient = 0.25;
		let separatorHeight = Math.round(rowHeight * separatorHeightCoefficient);
		let shouldAddSeparator = false;
		let hasColoredTags = !!this.props.tags[0]?.color;
		let forceNewLine = false;

		for (let i = 0; i < this.props.tags.length; i++) {
			let tag = this.props.tags[i];
			// Add separator after reaching the first non-colored tag, assuming colored tags exist
			if (!shouldAddSeparator && hasColoredTags && !tag.color) {
				shouldAddSeparator = true;
				forceNewLine = true;
			}
			// size of the colored dot + space between the dot and the tag name always sums up to fontSize (e.g., 8px + 3px at 11px fontSize)
			const tagColorWidth = (tag.color && !Zotero.Utilities.Internal.containsEmoji(tag.name)) ? this.props.fontSize : 0;
			let tagWidth = tagPaddingLeft + Math.min(tag.width, tagMaxWidth) + tagPaddingRight + tagColorWidth;
			// If first row or cell fits, add to current row
			if (!forceNewLine && (i == 0 || ((rowX + tagWidth) < (this.props.width - panePaddingRight - this.scrollbarWidth)))) {
				positions[i] = [rowX, panePaddingTop + (row * rowHeight)];
			}
			// Otherwise, start new row
			else {
				row++;
				rowX = panePaddingLeft;
				positions[i] = [rowX, panePaddingTop + (row * rowHeight)];
			}
			// Push all Y coordinates down by the height of the separator
			if (shouldAddSeparator) {
				positions[i][1] += separatorHeight;
				forceNewLine = false;
			}
			rowX += tagWidth + tagSpaceBetweenX;
		}
		this.positions = positions;
	}
	
	cellSizeAndPositionGetter = ({ index }) => {
		const tagPaddingTopBottom = this.props.uiDensity === 'comfortable' ? 2 : 1;
		const tagMaxWidth = this.props.width - minHorizontalPadding - this.scrollbarWidth;
		
		// NOTE: box-sizing is set to border-box on tags for i.e. padding needs to be included
		return {
			width: Math.min(this.props.tags[index].width + tagPaddingLeft + tagPaddingRight, tagMaxWidth),
			height: this.props.lineHeight + (2 * tagPaddingTopBottom),
			x: this.positions[index][0],
			y: this.positions[index][1]
		};
	};
	
	renderTag = ({ index, _key, style }) => {
		var tag = this.props.tags[index];
		
		const { onDragOver, onDragExit, onDrop } = this.props.dragObserver;
		
		var className = 'tag-selector-item keyboard-clickable';
		if (tag.selected) {
			className += ' selected';
		}
		if (tag.color) {
			className += ' colored';
		}
		if (tag.disabled) {
			className += ' disabled';
		}
		if (Zotero.Utilities.Internal.containsEmoji(tag.name)) {
			className += ' emoji';
		}
		
		let props = {
			className,
			onClick: ev => !tag.disabled && this.props.onSelect(tag.name, ev),
			onContextMenu: ev => this.props.onTagContext(tag, ev),
			onDragOver,
			onDragExit,
			onDrop,
			onFocus: (_) => {
				this.lastFocusedTagIndex = this.focusedTagIndex;
				this.focusedTagIndex = index;
			}
		};
		
		props.style = {
			...style
		};
		props.tabIndex = "0";
		props.role = "checkbox";
		props['aria-checked'] = tag.selected;
		props['aria-disabled'] = tag.disabled;
		// Don't specify explicit width unless we're truncating, because for some reason the width
		// from canvas can sometimes be slightly smaller than the actual width, resulting in an
		// unnecessary ellipsis.
		var tagMaxWidth = this.props.width - minHorizontalPadding - this.scrollbarWidth;
		if (props.style.width < tagMaxWidth) {
			delete props.style.width;
		}
		else {
			props.onMouseOver = function (event) {
				event.target.setAttribute('title', tag.name);
			};
		}
		
		if (tag.color) {
			props.style.color = tag.color;
			props['data-color'] = tag.color.toLowerCase();
		}
		
		return (
			<div key={tag.name} {...props}>
				<span>{tag.name}</span>
			</div>
		);
	};

	tagSelectorList() {
		return document.querySelector('.tag-selector-list');
	}

	isEmpty() {
		return this.props.tags.length == 0;
	}

	clearRecordedFocusedTag() {
		this.lastFocusedTagIndex = null;
		this.focusedTagIndex = null;
	}

	// Focus the last focused tag from the list. If there is none, focus the first
	// non-disabled tag. If there are no enabled tags, focus the first visible tag.
	async focus() {
		if (this.isEmpty()) {
			document.querySelector('.tag-selector-list').focus();
			return;
		}
		if (this.focusedTagIndex === null) {
			let enabledTagIndex = this.props.tags.findIndex(tag => !tag.disabled);
			if (enabledTagIndex !== -1) {
				this.focusedTagIndex = enabledTagIndex;
			}
			else {
				this.focusedTagIndex = 0;
			}
		}
		let tagRefocused = this.refocusTag();
		if (tagRefocused) return;
		// If the tag could not be refocused, it means it was removed due to windowing,
		// so we need to scroll to it.
		this.setState({ scrollToCell: this.focusedTagIndex });
		await this.waitForSectionRender();
	}

	// Try to refocus a focused tag that was removed due to windowing
	refocusTag() {
		let tagsList = document.querySelector('.tag-selector-list');
		let tagsNodes = [...tagsList.querySelectorAll(".tag-selector-item")];
		let tagToFocus = this.props.tags[this.focusedTagIndex];
		let nodeToFocus = tagsNodes.find(node => node.textContent == tagToFocus.name);
		if (nodeToFocus) {
			nodeToFocus.focus();
			return true;
		}
		return false;
	}

	waitForSectionRender() {
		return new Promise((resolve, _) => {
			this.resolveTagsRenderedPromise = resolve;
		});
	}

	handleSectionRendered = ({ indices }) => {
		let tagsList = document.querySelector('.tag-selector-list');
		// <Collection> sets role="grid" which is not semantically correct
		tagsList.setAttribute("role", "group");

		if (this.focusedTagIndex === null) return;
		// If the focused tag does not changed, the scrollToCell won't change
		// either, so the <Collection> won't scroll to the desired tag if we don't reset it.
		// E.g. second arrowLeft keypress when first tag is focused won't scroll to it.
		if (this.lastFocusedTagIndex === this.focusedTagIndex) {
			this.setState({ scrollToCell: null });
		}
		// Check if the tag that is supposed to be focused is within the rendered tags range.
		// If it is, make sure it is focused. If it is not - focus the tags list.
		if (indices.includes(this.focusedTagIndex)) {
			this.refocusTag();
			if (this.resolveTagsRenderedPromise) {
				this.resolveTagsRenderedPromise();
			}
		}
		else {
			tagsList.focus();
		}
	};

	async handleKeyDown(e) {
		if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
		// If the windowing kicks in, the node of the initially-focused tag may not
		// exist, so first we may need to scroll to it.
		if (!document.activeElement.classList.contains("tag-selector-item")) {
			this.setState({ scrollToCell: this.focusedTagIndex });
			// Even after the <Collection> re-renders, the new tag nodes may not be rendered yet.
			// So we have to wait for handleSectionRendered to run before proceeding.
			await this.waitForSectionRender();
		}
		// Sanity check to make sure that now a tag node is focused
		if (!document.activeElement.classList.contains("tag-selector-item")) return;
		// Handle arrow navigation
		let nextTag = (node) => {
			if (e.key == "ArrowRight") return node.nextElementSibling;
			return node.previousElementSibling;
		};
		let nextOne = nextTag(document.activeElement);
		if (nextOne) {
			nextOne.focus();
		}
	}
	
	render() {
		Zotero.debug("Rendering tag list");
		const tagCount = this.props.tags.length;
		
		var tagList;
		if (!this.props.loaded) {
			tagList = (
				<div className="tag-selector-message">
					{Zotero.getString('zotero.tagSelector.loadingTags')}
				</div>
			);
		}
		else if (tagCount == 0) {
			tagList = (
				<div className="tag-selector-message">
					{Zotero.getString('zotero.tagSelector.noTagsToDisplay')}
				</div>
			);
		}
		else {
			// Scroll to top if more than one tag was removed
			if (tagCount < this.prevTagCount - 1) {
				this.scrollToTopOnNextUpdate = true;
			}
			this.prevTagCount = tagCount;
			this.updatePositions();
			tagList = (
				<Collection
					ref={this.collectionRef}
					className="tag-selector-list"
					cellCount={tagCount}
					cellRenderer={this.renderTag}
					cellSizeAndPositionGetter={this.cellSizeAndPositionGetter}
					verticalOverscanSize={300}
					width={this.props.width}
					height={this.props.height - filterBarHeight}
					aria-label={document.querySelector("#zotero-tag-selector").getAttribute("label") || ""}
					onSectionRendered={this.handleSectionRendered}
					scrollToCell={Number.isInteger(this.state.scrollToCell) ? this.state.scrollToCell : undefined}
				/>
			);
		}
		
		return (
			<div className="tag-selector-list-container" onKeyDown={this.handleKeyDown.bind(this)}>
				{tagList}
			</div>
		);
	}
	
	static propTypes = {
		tags: PropTypes.arrayOf(PropTypes.shape({
			name: PropTypes.string,
			selected: PropTypes.bool,
			color: PropTypes.string,
			disabled: PropTypes.bool,
			width: PropTypes.number
		})),
		dragObserver: PropTypes.shape({
			onDragOver: PropTypes.func,
			onDragExit: PropTypes.func,
			onDrop: PropTypes.func
		}),
		onSelect: PropTypes.func,
		onKeyDown: PropTypes.func,
		onTagContext: PropTypes.func,
		loaded: PropTypes.bool,
		width: PropTypes.number.isRequired,
		height: PropTypes.number.isRequired,
		fontSize: PropTypes.number.isRequired,
		lineHeight: PropTypes.number.isRequired,
		uiDensity: PropTypes.string.isRequired
	};
}

module.exports = TagList;
