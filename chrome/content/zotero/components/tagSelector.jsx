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

'use strict';

const React = require('react');
const PropTypes = require('prop-types');
const TagList = require('./tagSelector/tagSelectorList');
const { Button } = require('./button');
const { IconTagSelectorMenu } = require('./icons');
const Search = require('./search');

class TagSelector extends React.PureComponent {
	render() {
		return (
			<div className="tag-selector">
				<TagList
					ref={this.props.tagListRef}
					tags={this.props.tags}
					dragObserver={this.props.dragObserver}
					onSelect={this.props.onSelect}
					onTagContext={this.props.onTagContext}
					loaded={this.props.loaded}
					width={this.props.width}
					height={this.props.height}
					fontSize={this.props.fontSize}
				/>
				<div className="tag-selector-filter-container">
					<Search
						ref={this.props.searchBoxRef}
						value={this.props.searchString}
						onSearch={this.props.onSearch}
						className="tag-selector-filter"
					/>
					<Button
						icon={<IconTagSelectorMenu />}
						title="zotero.toolbar.actions.label"
						className="tag-selector-actions"
						isMenu
						onClick={ev => this.props.onSettings(ev)}
					/>
				</div>
			</div>
		);
	}
}

TagSelector.propTypes = {
	// TagList
	tagListRef: PropTypes.object,
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
	
	// Search
	searchBoxRef: PropTypes.object,
	searchString: PropTypes.string,
	onSearch: PropTypes.func,
	
	// Button
	onSettings: PropTypes.func,
};

TagSelector.defaultProps = {
	tags: [],
	searchString: '',
	onSelect: () => Promise.resolve(),
	onTagContext: () => Promise.resolve(),
	onSearch: () => Promise.resolve(),
	onSettings: () => Promise.resolve()
};

module.exports = TagSelector;
