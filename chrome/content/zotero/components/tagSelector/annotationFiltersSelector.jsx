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

// Component with annotation colors and authors above the tags list
class AnnotationFiltersSelector extends React.PureComponent {
	constructor(props) {
		super(props);
		this.authorCollectionRef = React.createRef();
		this.state = {
			lastFocusedAuthor: null,
			lastFocusedColor: null
		};
	}

	_handleColorsClick = (colorObj) => {
		if (!colorObj.enabled && !colorObj.selected) return;
		this.props.onSelect(colorObj);
	};

	_getAnnotationsHeight() {
		if (this.props.annotationAuthors?.length > 0) {
			return this.props.height;
		}
		return 'auto';
	}

	_handleArrowKey = (event) => {
		let nextTarget;
		if (event.key == "ArrowLeft") {
			nextTarget = event.target.previousElementSibling;
		}
		else if (event.key == "ArrowRight") {
			nextTarget = event.target.nextElementSibling;
		}
		if (!nextTarget) return;
		nextTarget.focus();
		if (nextTarget.classList.contains('annotation-color')) {
			this.setState({ lastFocusedColor: nextTarget.dataset.color });
		}
		else if (nextTarget.classList.contains('annotation-author')) {
			this.setState({ lastFocusedAuthor: nextTarget.dataset.userId });
		}
	};

	focusAuthor = () => {
		if (this.state.lastFocusedAuthor) {
			let lastAuthor = document.querySelector(`.tag-selector .annotation-author[data-user-id="${this.state.lastFocusedAuthor}"]`);
			if (lastAuthor) {
				lastAuthor.focus();
				return;
			}
		}
		document.querySelector('.tag-selector .annotation-author')?.focus();
	};

	focusColor = () => {
		if (this.state.lastFocusedColor) {
			let lastColor = document.querySelector(`.tag-selector .annotation-color[data-color="${this.state.lastFocusedColor}"]`);
			if (lastColor) {
				lastColor.focus();
				return;
			}
		}
		document.querySelector('.tag-selector .annotation-color')?.focus();
	};

	renderAnnotationColors() {
		if (!this.props.annotationColors.length) {
			return null;
		}
		return (
			<div className="annotation-colors-section">
				{this.props.annotationColors.map((colorObj, index) => (
					<div key={`color_${index}_${colorObj.color}`}
						className={`annotation-color keyboard-clickable ${colorObj.selected ? 'selected' : ''} ${(colorObj.enabled || colorObj.selected) ? '' : ' disabled'}`}
						title={Zotero.getString(`general.${colorObj.name}`)}
						onClick={() => this._handleColorsClick(colorObj)}
						tabIndex={0}
						data-color={colorObj.color}>
						<span className="color-box" style={{ backgroundColor: colorObj.color }}/>
					</div>
				))}
			</div>
		);
	}

	renderAnnotationAuthors() {
		if (!this.props.annotationAuthors.length) {
			return null;
		}
		return (
			<div className="annotation-authors-section">
				{this.props.annotationAuthors.map((author, index) => {
					var className = 'annotation-author keyboard-clickable';
					if (author.selected) {
						className += ' selected';
					}
					
					return (
						<div key={`author_${index}_${author.userID}`}
							className={className}
							onClick={() => this.props.onSelect(author)}
							tabIndex={0}
							data-user-id={author.userID}>
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
				<div className="annotation-data" onKeyDown={this._handleArrowKey} style={{ height: this._getAnnotationsHeight() }}>
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
	onSelect: PropTypes.func,
	height: PropTypes.number,
	width: PropTypes.number,
};

AnnotationFiltersSelector.defaultProps = {
	annotationColors: [],
	annotationAuthors: [],
	onSelect: () => {},
	height: 120
};

module.exports = AnnotationFiltersSelector;
