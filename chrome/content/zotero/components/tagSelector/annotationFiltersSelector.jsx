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

class AnnotationFiltersSelector extends React.PureComponent {
	constructor(props) {
		super(props);
		this.authorCollectionRef = React.createRef();
		this.state = {
			authorScrollToCell: null
		};
	}

	_handleColorsClick = (colorObj) => {
		if (!colorObj.enabled) return;
		this.props.onSelect(colorObj);
	};

	_hasAnnotationAuthors() {
		return this.props.annotationAuthors?.length > 0;
	}

	// Render annotation colors with click handlers
	renderAnnotationColors() {
		if (!this.props.annotationColors.length) {
			return null;
		}
		return (
			<div className="annotation-colors-section">
				{this.props.annotationColors.map((colorObj, index) => (
					<div key={index}
						className={`color ${colorObj.selected ? 'selected' : ''} ${colorObj.enabled ? '' : ' disabled'}`}
						title={Zotero.getString(`general.${colorObj.name}`)}
						onClick={() => this._handleColorsClick(colorObj)}>
						<span className="color-box" style={{ backgroundColor: colorObj.color }}/>
					</div>
				))}
			</div>
		);
	}

	// Render annotation authors with click handlers
	renderAnnotationAuthors() {
		if (!this.props.annotationAuthors.length) {
			return null;
		}
		return (
			<div className="annotation-authors-section">
				{this.props.annotationAuthors.map((author, index) => {
					var className = 'annotation-author-item keyboard-clickable';
					if (author.selected) {
						className += ' selected';
					}
					
					return (
						<div key={`author_${index}_${author.userID}`}
							className={className}
							onClick={() => this.props.onSelect(author)}>
							<span className="icon icon-css icon-user-8 icon-8"></span>
							<span>{author.name}</span>
						</div>
					);
				})}
			</div>
		);
	}

	render() {
		return (
			<div className="annotation-selector">
				<div className="annotation-data" style={{ height: this._hasAnnotationAuthors() ? this.props.height : 'auto' }}>
					{this.renderAnnotationColors()}
					{this.renderAnnotationAuthors()}
				</div>
			</div>
		);
	}
}

AnnotationFiltersSelector.propTypes = {
	annotationColors: PropTypes.arrayOf(PropTypes.shape({
		color: PropTypes.string,
		name: PropTypes.string,
		selected: PropTypes.bool,
		enabled: PropTypes.bool
	})),
	annotationAuthors: PropTypes.arrayOf(PropTypes.shape({
		name: PropTypes.string,
		userID: PropTypes.string,
		selected: PropTypes.bool
	})),
	// onAnnotationColorSelected: PropTypes.func,
	// onAnnotationAuthorSelected: PropTypes.func,
	onSelect: PropTypes.func,
	height: PropTypes.number,
	width: PropTypes.number,
};

AnnotationFiltersSelector.defaultProps = {
	annotationColors: [],
	annotationAuthors: [],
	onAnnotationColorSelected: () => {},
	onAnnotationAuthorSelected: () => {},
	onSelect: () => {},
	height: 120
};

module.exports = AnnotationFiltersSelector;
