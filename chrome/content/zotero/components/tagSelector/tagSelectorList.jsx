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
const { FormattedMessage } = require('react-intl');
var { Collection } = require('react-virtualized');

// See also .tag-selector-item in _tag-selector.scss
var filterBarHeight = 32;
var tagPaddingTop = 4;
var tagPaddingLeft = 2;
var tagPaddingRight = 2;
var tagPaddingBottom = 4;
var tagSpaceBetweenX = 7;
var tagSpaceBetweenY = 4;
var panePaddingTop = 2;
var panePaddingLeft = 2;
var panePaddingRight = 25;
//var panePaddingBottom = 2;
var minHorizontalPadding = panePaddingLeft + tagPaddingLeft + tagPaddingRight + panePaddingRight;

class TagList extends React.PureComponent {
	constructor(props) {
		super(props);
		this.collectionRef = React.createRef();
		this.scrollToTopOnNextUpdate = false;
		this.prevTagCount = 0;
	}
	
	componentDidUpdate(prevProps) {
		// Redraw all tags on every refresh
		if (this.collectionRef && this.collectionRef.current) {
			// If width or height changed, recompute positions. It seems like this should happen
			// automatically, but it doesn't as of 9.21.0.
			if (prevProps.height != this.props.height
					|| prevProps.width != this.props.width
					|| prevProps.fontSize != this.props.fontSize
					|| prevProps.tags != this.props.tags) {
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
		var tagMaxWidth = this.props.width - minHorizontalPadding;
		var rowHeight = tagPaddingTop + this.props.fontSize + tagPaddingBottom + tagSpaceBetweenY;
		var positions = [];
		var row = 0;
		let rowX = panePaddingLeft;
		for (let i = 0; i < this.props.tags.length; i++) {
			let tag = this.props.tags[i];
			let tagWidth = tagPaddingLeft + Math.min(tag.width, tagMaxWidth) + tagPaddingRight;
			// If first row or cell fits, add to current row
			if (i == 0 || ((rowX + tagWidth) < (this.props.width - panePaddingLeft - panePaddingRight))) {
				positions[i] = [rowX, panePaddingTop + (row * rowHeight)];
			}
			// Otherwise, start new row
			else {
				row++;
				rowX = panePaddingLeft;
				positions[i] = [rowX, panePaddingTop + (row * rowHeight)];
			}
			rowX += tagWidth + tagSpaceBetweenX;
		}
		this.positions = positions;
	}
	
	cellSizeAndPositionGetter = ({ index }) => {
		var tagMaxWidth = this.props.width - minHorizontalPadding;
		return {
			width: Math.min(this.props.tags[index].width, tagMaxWidth),
			height: this.props.fontSize,
			x: this.positions[index][0],
			y: this.positions[index][1]
		};
	}
	
	renderTag = ({ index, _key, style }) => {
		var tag = this.props.tags[index];
		
		const { onDragOver, onDragExit, onDrop } = this.props.dragObserver;
		
		var className = 'tag-selector-item zotero-clicky';
		if (tag.selected) {
			className += ' selected';
		}
		if (tag.color) {
			className += ' colored';
		}
		if (tag.disabled) {
			className += ' disabled';
		}
		
		let props = {
			className,
			onClick: ev => !tag.disabled && this.props.onSelect(tag.name, ev),
			onContextMenu: ev => this.props.onTagContext(tag, ev),
			onDragOver,
			onDragExit,
			onDrop
		};
		
		props.style = {
			...style
		};
		
		// Don't specify explicit width unless we're truncating, because for some reason the width
		// from canvas can sometimes be slightly smaller than the actual width, resulting in an
		// unnecessary ellipsis.
		var tagMaxWidth = this.props.width - minHorizontalPadding;
		if (props.style.width < tagMaxWidth) {
			delete props.style.width;
		}
		else {
			// Setting this via props doesn't seem to work in XUL, but setting it on hover does.
			// Hopefully in an HTML window we'll be able to just set 'title'.
			props.onMouseOver = function (event) {
				event.target.setAttribute('tooltiptext', tag.name);
			};
		}
		
		if (tag.color) {
			props.style.color = tag.color;
		}
		
		return (
			<div key={tag.name} {...props}>
				{tag.name}
			</div>
		);
	}
	
	render() {
		Zotero.debug("Rendering tag list");
		const tagCount = this.props.tags.length;
		
		var tagList;
		if (!this.props.loaded) {
			tagList = (
				<div className="tag-selector-message">
					<FormattedMessage id="zotero.tagSelector.loadingTags" />
				</div>
			);
		}
		else if (tagCount == 0) {
			tagList = (
				<div className="tag-selector-message">
					<FormattedMessage id="zotero.tagSelector.noTagsToDisplay" />
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
				/>
			);
		}
		
		return (
			<div className="tag-selector-list-container">
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
		onTagContext: PropTypes.func,
		loaded: PropTypes.bool,
		width: PropTypes.number.isRequired,
		height: PropTypes.number.isRequired,
		fontSize: PropTypes.number.isRequired,
	};
}

module.exports = TagList;
