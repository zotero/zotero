/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2022 Corporation for Digital Scholarship
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

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { IntlProvider, FormattedMessage } from 'react-intl';
import cx from 'classnames';
import VirtualizedTable, { renderCell } from 'components/virtualized-table';

const OP_STRINGS = {
	split: 'zotero.sync.longTagFixer.split',
	edit: 'zotero.general.edit',
	delete: 'zotero.general.delete'
};


class Splitter extends React.Component {
	constructor(props) {
		super(props);
		let splitChars = Zotero.Prefs.get('lastLongTagDelimiter');
		this.state = {
			splitChars,
			rows: this._getRows(splitChars)
		};
	}

	componentDidMount() {
		let tags = this.state.rows
			.filter(row => row.checked)
			.map(row => row.value);
		let valid = !!tags.length;
		this.props.onTagsChange(tags, valid);
	}

	componentDidUpdate() {
		let tags = this.state.rows
			.filter(row => row.checked)
			.map(row => row.value);
		let valid = !!tags.length;
		this.props.onTagsChange(tags, valid);
		this._list.invalidate();
	}

	_getRows(splitChars) {
		if (!splitChars) {
			return [];
		}

		let re = new RegExp('\\s*' + splitChars.replace(/([.\-[\]()?*+])/g, '\\$1') + '\\s*');
		let splits = [...new Set(this.props.tag.split(re))]
			.filter(Boolean)
			.sort();
		return splits.map(split => ({
			value: split,
			checked: true
		}));
	}

	_toggleRow(index) {
		let rows = this.state.rows;
		rows[index].checked = !rows[index].checked;
		this.setState({ rows });
	}

	_toggleAllRows(value) {
		let rows = this.state.rows;
		rows.forEach(row => row.checked = value);
		this.setState({ rows });
	}

	_handleSplitCharsChange = (event) => {
		let splitChars = event.target.value;
		this.setState({
			splitChars,
			rows: this._getRows(splitChars)
		});
		Zotero.Prefs.set('lastLongTagDelimiter', splitChars);
	};

	_renderItem = (index, selection, oldDiv = null, columns) => {
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = '';
		}
		else {
			div = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			div.className = 'row';
			div.addEventListener('click', () => this._toggleRow(index));
		}
		let row = this.state.rows[index];
		let checkbox = document.createElementNS('http://www.w3.org/1999/xhtml', 'input');
		checkbox.type = 'checkbox';
		checkbox.checked = row.checked;
		div.appendChild(checkbox);
		div.appendChild(renderCell(index, row.value, columns[0]));
		return div;
	};

	render() {
		return (
			<div className="op-editor">
				<div>
					<FormattedMessage id="zotero.sync.longTagFixer.splitOn" />
					<input
						type="text"
						value={this.state.splitChars}
						onChange={this._handleSplitCharsChange}
						size="3"
						className="split-on"
					/>
				</div>

				<VirtualizedTable
					getRowCount={() => this.state.rows.length}
					id="splitter-table"
					ref={ref => this._list = ref}
					renderItem={this._renderItem}
					showHeader={false}
					columns={[{ dataKey: 'tag' }]}
					alternatingRowColors={null}
					isSelectable={() => false}
				/>

				<input
					type="button"
					value={Zotero.Intl.strings['zotero.general.selectAll']}
					onClick={() => this._toggleAllRows(true)}
				/>
				<input
					type="button"
					value={Zotero.Intl.strings['zotero.general.deselectAll']}
					onClick={() => this._toggleAllRows(false)}
				/>
			</div>
		);
	}

	static propTypes = {
		tag: PropTypes.string.isRequired,
		onTagsChange: PropTypes.func.isRequired
	};
}


class Editor extends React.Component {
	constructor(props) {
		super(props);
		this.state = { tag: props.tag };
	}

	componentDidMount() {
		this.props.onTagsChange([this.state.tag], this.isValid);
	}

	componentDidUpdate() {
		this.props.onTagsChange([this.state.tag], this.isValid);
	}

	get isValid() {
		return this.state.tag.length > 0 && this.state.tag.length < Zotero.Tags.MAX_SYNC_LENGTH;
	}

	_handleChange = (event) => {
		this.setState({ tag: event.target.value });
	};

	render() {
		return (
			<div className="op-editor">
				<textarea
					value={this.state.tag}
					onChange={this._handleChange}
					rows={12}
				/>
				<div className={cx('editor-length', !this.isValid && 'invalid')}>
					{Zotero.Tags.MAX_SYNC_LENGTH - this.state.tag.length}
				</div>
			</div>
		);
	}

	static propTypes = {
		tag: PropTypes.string.isRequired,
		onTagsChange: PropTypes.func.isRequired
	};
}


class Deleter extends React.Component {
	componentDidMount() {
		this.props.onTagsChange([], true);
	}

	render() {
		return (
			<div className="op-editor">
				<FormattedMessage id="zotero.sync.longTagFixer.tagWillBeDeleted" />
			</div>
		);
	}

	static propTypes = {
		onTagsChange: PropTypes.func.isRequired
	};
}


class TagEditor extends React.Component {
	tags = [];

	constructor(props) {
		super(props);
		this.state = {
			op: 'split'
		};
	}

	get _validOps() {
		if (this.props.isLongTag) {
			return ['split', 'edit', 'delete'];
		}
		else {
			return ['split'];
		}
	}

	_handleOpChange = (op) => {
		this.setState({ op });
	};

	_handleTagsChange = (tags, valid) => {
		this.props.onTagsChange(this.state.op, tags, valid);
	};

	_renderHeader() {
		if (this.props.isLongTag) {
			return (
				<div>
					<p><FormattedMessage id="zotero.sync.longTagFixer.followingTagTooLong" /></p>
					<textarea
						value={this.props.tag}
						rows={4}
						readOnly
						className="plain"
					/>
					<p><FormattedMessage id="zotero.sync.longTagFixer.syncedTagSizeLimit" /></p>
					<p><FormattedMessage id="zotero.sync.longTagFixer.splitEditDelete" /></p>
				</div>
			);
		}
		else {
			return null;
		}
	}

	_renderOpEditor(op) {
		switch (op) {
			case 'split':
				return (
					<Splitter
						tag={this.props.tag}
						onTagsChange={this._handleTagsChange}
					/>
				);
			case 'edit':
				return (
					<Editor
						tag={this.props.tag}
						onTagsChange={this._handleTagsChange}
					/>
				);
			case 'delete':
				return (
					<Deleter
						onTagsChange={this._handleTagsChange}
					/>
				);
			default:
				throw new Error('Invalid op: ' + op);
		}
	}

	_renderBody() {
		let validOps = this._validOps;
		let opElems = validOps.length == 1
			? this._renderOpEditor(validOps[0])
			: validOps.map(op => (
				<div key={op}>
					<input
						type="radio"
						name="op"
						id={`op-radio-${op}`}
						value={op}
						checked={this.state.op === op}
						onChange={e => this._handleOpChange(e.target.value)}
					/>
					<label htmlFor={`op-radio-${op}`}>
						<FormattedMessage id={OP_STRINGS[op]} />
					</label>
					{this.state.op === op && this._renderOpEditor(op)}
				</div>
			));

		return opElems;
	}

	render() {
		return (
			<IntlProvider
				locale={Zotero.locale}
				messages={Zotero.Intl.strings}
			>
				<div className="tag-editor">
					{this._renderHeader()}
					{this._renderBody()}
				</div>
			</IntlProvider>
		);
	}

	static propTypes = {
		tag: PropTypes.string.isRequired,
		onTagsChange: PropTypes.func.isRequired,
		isLongTag: PropTypes.bool
	};
}


var TagEditorDialog = {
	op: null,
	tags: null,

	init() {
		let dataIn = window.arguments[0];
		let { oldTag, isLongTag } = dataIn;

		this._dataOut = window.arguments[1];
		this._dialog = document.getElementById('zotero-tag-editor-dialog');

		this._dialog.setAttribute('title', Zotero.getString('tagEditor.title' + (isLongTag ? '.isLongTag' : '')));

		ReactDOM.render(
			<TagEditor
				tag={oldTag}
				isLongTag={isLongTag}
				onTagsChange={(op, tags, valid) => this._handleTagsChange(op, tags, valid)}
			/>,
			document.getElementById('tag-editor-container')
		);
	},

	cancel() {
		this._dataOut.result = false;
	},

	save() {
		this._dataOut.result = {
			op: this.op,
			tags: this.tags
		};
	},

	_handleTagsChange(op, tags, valid) {
		this.op = op;
		this.tags = tags;
		this._dialog.getButton('accept').disabled = !valid;
	}
};
