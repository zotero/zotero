const React = require('react');
const PropTypes = require('prop-types');
const cx = require('classnames');

class TagList extends React.PureComponent {
	renderTag(index) {
		const { tags } = this.props;
		const tag = index < tags.length ?
			tags[index] : {
				tag: "",
			};

		const className = cx('tag-selector-item', {
			selected: tag.selected,
			colored: tag.color,
		});

		let props = {
			className,
			onClick: ev => this.props.onSelect(tag.name, ev),
			onContextMenu: ev => this.props.onTagContext(tag, ev),
		};

		if(tag.color) {
			props['style'] = {
				color: tag.color,
			};
		}


		return (
			<li key={ index } { ...props }>
				{ tag.name }
			</li>
		);
	}

	render() {
		const totalTagCount = this.props.tags.length;
		return (
			<div
				className="tag-selector-container"
				ref={ ref => { this.container = ref } }>
				<ul className="tag-selector-list">
					{
						[...Array(totalTagCount).keys()].map(index => this.renderTag(index))
					}
				</ul>
			</div>
		)

	}
}

module.exports = TagList;
