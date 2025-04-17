/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org
    
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

import React, { useState, useImperativeHandle, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';

import Field from './field';

const Table = React.forwardRef((props, ref) => {
	const [rows, setRows] = useState([]);

	useImperativeHandle(ref, () => ({
		setRows
	}));

	return (
		<div className="diff-table">
			<div className="body">
				{rows.map(row => (
					<TableRow
						key={row.itemID}
						row={row}
						onSetOpen={props.onSetOpen}
						onSetDisabled={props.onSetDisabled}
						onExpand={props.onExpand}
					/>
				))}
			</div>
		</div>
	);
});

Table.propTypes = {
	onSetOpen: PropTypes.func,
	onSetDisabled: PropTypes.func,
	onExpand: PropTypes.func,
};

const TableRow = (props) => {
	let { row, onSetOpen, onSetDisabled, onExpand } = props;

	const isEmpty = !row.fields.length;
	const isOpen = !isEmpty && row.isOpen;
	const numEnabledFields = row.fields.filter(field => !field.isDisabled).length;

	let checkboxRef = useRef();

	function handleToggleOpen() {
		onSetOpen(row.itemID, !row.isOpen);
	}
	
	function handleToggleKeyDown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleToggleOpen();
		}
	}
	
	function handleCheckboxChange() {
		onSetDisabled(row.itemID, null, !checkboxRef.current.checked);
	}

	function handleFieldSetDisabled(itemID, fieldName, disabled) {
		onSetDisabled(itemID, fieldName, disabled);
	}

	function handleFieldExpand(itemID, fieldName) {
		onExpand(itemID, fieldName);
	}
	
	useEffect(() => {
		let checkbox = checkboxRef.current;
		if (!checkbox) {
			return;
		}
		if (numEnabledFields === 0) {
			checkbox.indeterminate = false;
			checkbox.checked = false;
		}
		else if (numEnabledFields === row.fields.length) {
			checkbox.indeterminate = false;
			checkbox.checked = true;
		}
		else {
			checkbox.indeterminate = true;
			checkbox.checked = false;
		}
	});
	
	return (<div key={row.itemID} className="row">
		{row.status === Zotero.UpdateMetadata.ROW_PROCESSING && (
			<div className="controls processing">
				<div className="icon zotero-spinner-16" status="animate"/>
			</div>
		)}
		{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && !isEmpty && (
			<div className="controls succeeded">
				<div
					className={cx('twisty', { open: isOpen })}
					onClick={handleToggleOpen}
				/>
				<input
					type="checkbox"
					onChange={handleCheckboxChange}
					ref={checkboxRef}
				/>
			</div>
		)}
		<div
			className="title"
			role={isEmpty ? '' : 'button'}
			aria-expanded={isOpen}
			tabIndex={0}
			onClick={handleToggleOpen}
			onKeyDown={handleToggleKeyDown}
		>
			{row.title}
		</div>
		{!isOpen && <div className="message">
			{row.status === Zotero.UpdateMetadata.ROW_SUCCEEDED && !isEmpty
				? <Summary fields={row.fields}/>
				: row.message}
		</div>}
		{isOpen && <div className="fields">
			{row.fields.map(field => (
				<Field
					key={field.fieldName}
					itemID={row.itemID}
					readonly={row.isDone}
					field={field}
					onSetDisabled={handleFieldSetDisabled}
					onExpand={handleFieldExpand}
				/>
			))}
		</div>}
	</div>);
};

TableRow.propTypes = {
	row: PropTypes.object.isRequired,
	onSetOpen: PropTypes.func,
	onSetDisabled: PropTypes.func.isRequired,
	onExpand: PropTypes.func.isRequired,
};

const Summary = (props) => {
	let { fields } = props;
	
	return <div className="summary">
		{fields.flatMap((field, i) => {
			let label = field.isDisabled
				? <s key={i}>{field.fieldLabel}</s>
				: field.fieldLabel;
			if (i < fields.length - 1) {
				return [label, ', '];
			}
			else {
				return [label];
			}
		})}
	</div>;
};

Summary.propTypes = {
	fields: PropTypes.array.isRequired,
};

export default Table;
