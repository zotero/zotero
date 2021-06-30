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

const MAX_UNEXPANDED_ALL_NOTES = 7;

const NoteRow = memo(({ id, title, body, date, onClick, onContextMenu, parentItemType, parentTitle }) => {
	return (
		<div className={cx('note-row', { 'standalone-note-row': !parentItemType })} onClick={() => onClick(id)} onContextMenu={(event) => onContextMenu(id, event)}>
			<div className="inner">
				{ parentItemType
					? <div className="parent-line">
						<img className="parent-item-type" src={Zotero.ItemTypes.getImageSrc(parentItemType)} />
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
	
	let childNotes = notes.filter(x => x.isCurrentChild);
	let allNotes = notes.filter(x => !x.isCurrentChild);
	let visibleNotes = allNotes.slice(0, expanded ? numVisible : MAX_UNEXPANDED_ALL_NOTES);
	return (
		<div className="notes-list">
			{hasParent && <section>
				<div className="header-row">
					<h2>{Zotero.getString('pane.context.itemNotes')}</h2>
					<button onMouseDown={onAddChildButtonDown}>+</button>
				</div>
				{!childNotes.length && <div className="empty-row">{Zotero.getString('pane.context.noNotes')}</div>}
				{childNotes.map(note => <NoteRow key={note.id} {...note}
					onClick={onClick} onContextMenu={onContextMenu}/>)}
			</section>}
			<section>
				<div className="header-row">
					<h2>{Zotero.getString('pane.context.allNotes')}</h2>
					<button onMouseDown={onAddStandaloneButtonDown}>+</button>
				</div>
				{!allNotes.length && <div className="empty-row">{Zotero.getString('pane.context.noNotes')}</div>}
				{visibleNotes.map(note => <NoteRow key={note.id} {...note}
					onClick={onClick} onContextMenu={onContextMenu}/>)}
				{allNotes.length > visibleNotes.length
					&& <div className="more-row" onClick={handleClickMore}>{
						Zotero.getString('general.numMore', Zotero.Utilities.numberFormat(
							[allNotes.length - visibleNotes.length], 0))
					}</div>
				}
			</section>
		</div>
	);
});

export default NotesList;
