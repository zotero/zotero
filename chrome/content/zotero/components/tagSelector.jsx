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
const AnnotationFiltersSelector = require('./tagSelector/annotationFiltersSelector');
const { Button } = require('./button');
const { CSSIcon } = require('./icons');
const Search = require('./search');

const annotationColorsHeight = 20;
const minTagsListHeight = 150;
const annotationsVerticalPadding = 14;
const annotationsFirstRow = 22 + 6; // 22px for first row, 6px for margin between colors and authors
const minAnnotationSectionHeight = annotationColorsHeight + annotationsFirstRow;
const splitterHeight = 9;

class TagSelector extends React.PureComponent {
	constructor(props) {
		super(props);
		this.state = {
			annotationSectionHeight: minAnnotationSectionHeight,
			isDragging: false,
			dragStartY: 0,
			dragStartHeight: 0
		};
	}

	handleSplitterMouseDown = (e) => {
		if (!this.props.annotationAuthors.length) return;
		e.preventDefault();
		this.setState({
			isDragging: true,
			dragStartY: e.clientY,
			dragStartHeight: this.state.annotationSectionHeight
		});
		
		document.addEventListener('mousemove', this.handleSplitterMouseMove);
		document.addEventListener('mouseup', this.handleSplitterMouseUp);
	};

	handleSplitterMouseMove = (e) => {
		if (!this.state.isDragging) return;
		
		let deltaY = e.clientY - this.state.dragStartY;
		
		// Ensure min-heights for annotation section and tags list are respected
		let newAnnotationSectionHeight = this.state.dragStartHeight + deltaY;
		newAnnotationSectionHeight = Math.min(this.props.height - minTagsListHeight, newAnnotationSectionHeight);
		newAnnotationSectionHeight = Math.max(minAnnotationSectionHeight, newAnnotationSectionHeight);
		
		this.setState({ annotationSectionHeight: newAnnotationSectionHeight });
	};

	handleSplitterMouseUp = () => {
		this.setState({ isDragging: false });
		document.removeEventListener('mousemove', this.handleSplitterMouseMove);
		document.removeEventListener('mouseup', this.handleSplitterMouseUp);
	};

	componentDidUpdate() {
		if (this.state.isDragging) return;
		let newHeight = 0;
		
		if (this.props.annotationAuthors.length > 0) {
			newHeight = Math.max(this.state.annotationSectionHeight, minAnnotationSectionHeight);
		}
		else if (this.props.annotationColors.length > 0) {
			newHeight = annotationColorsHeight + annotationsVerticalPadding;
		}
		if (newHeight !== this.state.annotationSectionHeight) {
			this.setState({ annotationSectionHeight: newHeight });
		}
	}

	render() {
		let annotationSelectorHeight = 0;
		
		if (this.props.annotationAuthors.length > 0 || this.props.annotationColors.length > 0) {
			annotationSelectorHeight = this.state.annotationSectionHeight + splitterHeight + annotationsVerticalPadding;
		}
		
		let availableTagsHeight = this.props.height - annotationSelectorHeight;

		return (
			<div className={`tag-selector ${this.state.isDragging ? 'splitter-drag' : ''}`}>
				{annotationSelectorHeight > 0 && (
					<>
						<AnnotationFiltersSelector
							ref={this.props.annotationFiltersSelectorRef}
							annotationColors={this.props.annotationColors}
							annotationAuthors={this.props.annotationAuthors}
							onSelect={this.props.onSelect}
							height={this.state.annotationSectionHeight}
						/>
						<div onMouseDown={this.handleSplitterMouseDown}
							className={`horizontal-splitter ${this.state.isDragging ? 'dragging' : ''} ${this.props.annotationAuthors?.length > 0 ? '' : 'disabled'}`}>
							<div className="grippy"></div>
						</div>
					</>
				)}

				<TagList
					ref={this.props.tagListRef}
					tags={this.props.tags}
					dragObserver={this.props.dragObserver}
					onSelect={this.props.onSelect}
					onKeyDown={this.props.onKeyDown}
					onTagContext={this.props.onTagContext}
					loaded={this.props.loaded}
					width={this.props.width}
					height={availableTagsHeight}
					fontSize={this.props.fontSize}
					lineHeight={this.props.lineHeight}
					uiDensity={this.props.uiDensity}
				/>
				<div className="tag-selector-filter-pane">
					<div className="tag-selector-filter-container">
						<Search
							ref={this.props.searchBoxRef}
							value={this.props.searchString}
							onSearch={this.props.onSearch}
							className="tag-selector-filter"
							data-l10n-id="tagselector-search"
							data-l10n-args={`{"annotationsFilter": "${this.props.annotationAuthors?.length > 0 ? 'yes' : 'no'}"}`}
						/>
						<Button
							icon={<CSSIcon name="filter" className="icon-16" />}
							title="zotero.toolbar.actions.label"
							className="tag-selector-actions"
							isMenu
							onClick={ev => this.props.onSettings(ev)}
						/>
					</div>
				</div>
			</div>
		);
	}
}

TagSelector.propTypes = {
	// TagList
	tagListRef: PropTypes.object,
	annotationFiltersSelectorRef: PropTypes.object,
	tags: PropTypes.arrayOf(PropTypes.shape({
		name: PropTypes.string,
		selected: PropTypes.bool,
		color: PropTypes.string,
		disabled: PropTypes.bool,
		width: PropTypes.number
	})),
	annotationColors: PropTypes.arrayOf(PropTypes.shape({
		color: PropTypes.string,
		name: PropTypes.string,
	})),
	annotationAuthors: PropTypes.arrayOf(PropTypes.shape({
		label: PropTypes.string,
		userID: PropTypes.string
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
	uiDensity: PropTypes.string.isRequired,
	
	// Search
	searchBoxRef: PropTypes.object,
	searchString: PropTypes.string,
	onSearch: PropTypes.func,
	
	// Button
	onSettings: PropTypes.func,

	// Annotation Filters
	onAnnotationColorSelected: PropTypes.func,
	onAnnotationAuthorSelected: PropTypes.func,
};

TagSelector.defaultProps = {
	tags: [],
	annotationColors: [],
	annotationAuthors: [],
	searchString: '',
	onSelect: () => Promise.resolve(),
	onTagContext: () => Promise.resolve(),
	onSearch: () => Promise.resolve(),
	onSettings: () => Promise.resolve(),
	onAnnotationColorSelected: () => Promise.resolve(),
	onAnnotationAuthorSelected: () => Promise.resolve(),
};

module.exports = TagSelector;
