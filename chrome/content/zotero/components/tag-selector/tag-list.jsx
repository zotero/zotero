const React = require('react');
const { FormattedMessage } = require('react-intl');
const PropTypes = require('prop-types');
const cx = require('classnames');

class TagList extends React.PureComponent {
	renderTag(index) {
		const { tags } = this.props;
		const tag = index < tags.length ?
			tags[index] : {
				tag: "",
			};
		const { onDragOver, onDragExit, onDrop } = this.props.dragObserver;

		const className = cx('tag-selector-item', 'zotero-clicky', {
			selected: tag.selected,
			colored: tag.color,
			disabled: tag.disabled
		});

		let props = {
			className,
			onClick: ev => !tag.disabled && this.props.onSelect(tag.name, ev),
			onContextMenu: ev => this.props.onTagContext(tag, ev),
			onDragOver,
			onDragExit,
			onDrop
		};

		if (tag.color) {
			props['style'] = {
				color: tag.color,
			};
		}


		return (
			<li key={index} {...props}>
				{tag.name}
			</li>
		);
	}

	render() {
		const totalTagCount = this.props.tags.length;
		var tagList = (
			<ul className="tag-selector-list">
				{
					[...Array(totalTagCount).keys()].map(index => this.renderTag(index))
				}
			</ul>
		);
		if (!this.props.loaded) {
			tagList = (
				<div className="tag-selector-message">
					<FormattedMessage id="zotero.tagSelector.loadingTags" />
				</div>
			);
		} else if (totalTagCount == 0) {
			tagList = (
				<div className="tag-selector-message">
					<FormattedMessage id="zotero.tagSelector.noTagsToDisplay" />
				</div>
			);
		}
		return (
			<div
				className="tag-selector-container"
				ref={ref => { this.container = ref }}>
				{tagList}
			</div>
		)

	}
}

module.exports = TagList;
