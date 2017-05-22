'use strict';

const React = require('react');
const PropTypes = require('prop-types');
const TagList = require('./tag-selector/tag-list');
const Input = require('./form/input');

class TagSelector extends React.Component {
	render() {
		return (
			<div className="tag-selector">
				<TagList { ...this.props } />
				<div className="tag-selector-filter-container">
					<Input
						type="search"
						value={ this.props.searchString }
						onChange={ this.props.onSearch }
						className="tag-selector-filter"
						size="1"
					/>
					<button className="tag-selector-actions" onClick={ ev => this.props.onSettings(ev) } />
				</div>
			</div>
		);
	}
}

TagSelector.propTypes = {
	tags: PropTypes.arrayOf(PropTypes.shape({
		name: PropTypes.string,
		selected: PropTypes.bool,
		color: PropTypes.string,
		disabled: PropTypes.bool
	})),
	searchString: PropTypes.string,
	shouldFocus: PropTypes.bool,
	onSelect: PropTypes.func,
	onTagContext: PropTypes.func,
	onSearch: PropTypes.func,
	onSettings: PropTypes.func,
};

TagSelector.defaultProps = {
	tags: [],
	searchString: '',
	shouldFocus: false,
	onSelect: () => Promise.resolve(),
	onTagContext: () => Promise.resolve(),
	onSearch: () => Promise.resolve(),
	onSettings: () => Promise.resolve()
};

module.exports = TagSelector;
