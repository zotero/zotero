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

import React, { forwardRef, useImperativeHandle, useState } from 'react';

const NoteRow = ({ title, body, date, onClick }) => {
	return (
		<div className="note-row" onClick={onClick}>
			<div className="inner">
				<div className="first-line">
					<div className="title">{title}</div>
				</div>
				<div className="second-line">
					<div className="date">{date}</div>
					<div className="body">{body}</div>
				</div>
			</div>
		</div>
	);
};

const NotesList = forwardRef(({ onClick }, ref) => {
	const [notes, setNotes] = useState([]);
	useImperativeHandle(ref, () => ({ setNotes }));
	return (
		<div className="notes-list">
			{notes.map(note => <NoteRow key={note.id} {...note} onClick={() => onClick(note.id)}/>)}
		</div>
	);
});

export default NotesList;
