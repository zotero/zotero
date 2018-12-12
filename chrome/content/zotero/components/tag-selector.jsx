'use strict';

const React = require('react');
const PropTypes = require('prop-types');
const TagList = require('./tag-selector/tag-list');
const Input = require('./form/input');
const { Button } = require('./button');
const { IconTagSelectorMenu } = require('./icons');

class TagSelector extends React.Component {
	render() {
		return (
			<div className="tag-selector">
				<TagList {...this.props} />
				<div className="tag-selector-filter-container">
					<Input
						type="search"
						ref={ref => this.focusTextbox = ref && ref.focus}
						value={this.props.searchString}
						onChange={this.props.onSearch}
						className="tag-selector-filter"
						size="1"
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
	tags: PropTypes.arrayOf(PropTypes.shape({
		name: PropTypes.string,
		selected: PropTypes.bool,
		color: PropTypes.string,
		disabled: PropTypes.bool
	})),
	dragObserver: PropTypes.shape({
		onDragOver: PropTypes.func,
		onDragExit: PropTypes.func,
		onDrop: PropTypes.func
	}),
	searchString: PropTypes.string,
	shouldFocus: PropTypes.bool,
	onSelect: PropTypes.func,
	onTagContext: PropTypes.func,
	onSearch: PropTypes.func,
	onSettings: PropTypes.func,
	loaded: PropTypes.bool,
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
