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

import React, { forwardRef, useImperativeHandle, useState, memo } from 'react';
import cx from 'classnames';
import { CSSItemTypeIcon } from 'components/icons';

const MAX_UNEXPANDED_ALL_NOTES = 7;

const NoteRow = memo(({ id, title, body, date, onClick, onKeyDown, onContextMenu, parentItemType, parentTitle }) => {
	return (
		<div
			tabIndex={-1}
			className={cx('note-row', { 'standalone-note-row': !parentItemType })}
			onClick={() => onClick(id)}
			onContextMenu={(event) => onContextMenu(id, event)}
			onKeyDown={onKeyDown}
		>
			<div className="inner">
				{ parentItemType
					? <div className="parent-line">
						<CSSItemTypeIcon className="parent-item-type" itemType={parentItemType} />
						<span className="parent-title">{parentTitle}</span>
					</div>
					: null
				}
				<div className="title-line">
					<div className="title">{title}</div>
				</div>
				<div className="body-line">
					<div className="date">{date}</div>
					<div className="body">{body}</div>
				</div>
			</div>
		</div>
	);
});

const NotesList = forwardRef(({ onClick, onContextMenu, onAddChildButtonDown, onAddStandaloneButtonDown }, ref) => {
	const [notes, setNotes] = useState([]);
	const [expanded, setExpanded] = useState(false);
	const [numVisible, setNumVisible] = useState(0);
	const [hasParent, setHasParent] = useState(true);

	const _setExpanded = (value) => {
		setExpanded(value);
		if (value) {
			setNumVisible(numVisible + 1000);
		}
		else {
			setNumVisible(0);
		}
	};
	
	useImperativeHandle(ref, () => ({
		setNotes,
		setHasParent,
		setExpanded: _setExpanded
	}));
	
	function handleClickMore() {
		_setExpanded(true);
	}

	function handleButtonKeydown(event) {
		if (event.key === 'Tab' && !event.shiftKey) {
			let node = event.target.parentElement.parentElement.querySelector('[tabindex="-1"]');
			if (node) {
				node.focus();
				event.preventDefault();
			}
		}
		else if (event.key === 'Tab' && event.shiftKey) {
			let prevSection = event.target.parentElement.parentElement.previousElementSibling;
			if (prevSection) {
				let node = prevSection.querySelector('[tabindex="-1"]:last-child');
				if (node) {
					node.focus();
					event.preventDefault();
				}
			}
		}
	}

	function handleRowKeyDown(event) {
		if (['Enter', 'Space'].includes(event.key)) {
			// Focus the previous row, because "more-row" will disappear
			if (event.target.classList.contains('more-row')) {
				let node = event.target.previousElementSibling;
				if (node) {
					node.focus();
					event.preventDefault();
				}
			}
			event.target.click();
		}
		else if (event.key === 'ArrowUp') {
			let node = event.target.previousElementSibling;
			if (node) {
				node.focus();
				event.preventDefault();
			}
		}
		else if (event.key === 'ArrowDown') {
			let node = event.target.nextElementSibling;
			if (node) {
				node.focus();
				event.preventDefault();
			}
		}
	}
	
	let childNotes = notes.filter(x => x.isCurrentChild);
	let allNotes = notes.filter(x => !x.isCurrentChild);
	let visibleNotes = allNotes.slice(0, expanded ? numVisible : MAX_UNEXPANDED_ALL_NOTES);
	return (
		<div className="notes-list">
			{hasParent && <section>
				<div className="header-row">
					<h2>{Zotero.getString('pane.context.itemNotes')}</h2>
					<button onMouseDown={onAddChildButtonDown} onClick={onAddChildButtonDown} onKeyDown={handleButtonKeydown}>+</button>
				</div>
				{!childNotes.length && <div className="empty-row">{Zotero.getString('pane.context.noNotes')}</div>}
				{childNotes.map(note => <NoteRow key={note.id} {...note}
					onClick={onClick} onKeyDown={handleRowKeyDown} onContextMenu={onContextMenu}/>)}
			</section>}
			<section>
				<div className="header-row">
					<h2>{Zotero.getString('pane.context.allNotes')}</h2>
					<button onMouseDown={onAddStandaloneButtonDown} onClick={onAddStandaloneButtonDown} onKeyDown={handleButtonKeydown}>+</button>
				</div>
				{!allNotes.length && <div className="empty-row">{Zotero.getString('pane.context.noNotes')}</div>}
				{visibleNotes.map(note => <NoteRow key={note.id} {...note}
					onClick={onClick} onKeyDown={handleRowKeyDown} onContextMenu={onContextMenu}/>)}
				{allNotes.length > visibleNotes.length
					&& <div className="more-row" tabIndex={-1} onClick={handleClickMore} onKeyDown={handleRowKeyDown}>{
						Zotero.getString('general.numMore', Zotero.Utilities.numberFormat(
							[allNotes.length - visibleNotes.length], 0))
					}</div>
				}
			</section>
		</div>
	);
});

export default NotesList;
