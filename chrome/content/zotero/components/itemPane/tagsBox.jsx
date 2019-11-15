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

import React, { useState, useEffect, useRef, useMemo, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import Editable from '../editable';
import Input from '../form/input';
import TextAreaInput from '../form/textArea';
//import Button from '../form/button';

const TagsBox = React.forwardRef((props, ref) => {
	const [prevInitialTags, setPrevInitialTags] = useState([]);
	const [tags, setTags] = useState([]);
	const tagNames = useMemo(() => new Set(tags.map(t => t.tag)), [tags]);
	const [selectedTag, setSelectedTag] = useState('');
	const [newRow, setNewRow] = useState(false);
	const [currentValue, setCurrentValue] = useState('');
	const [isMultiline, setIsMultiline] = useState(false);
	const [rows, setRows] = useState(1);
	const rootRef = useRef(null);
	const textboxRef = useRef(null);
	const requestID = useRef(1);
	const newRowID = useRef(1);
	const resetSelectionOnRender = useRef(false);
	const skipNextEdit = useRef(false);
	
	const removeStr = Zotero.getString('general.remove');
	
	useEffect(() => {
		// Move cursor to end of textarea after paste
		if (isMultiline) {
			//let textarea = window.getSelection().anchorNode.querySelector('textarea');
			let textarea = rootRef.current && rootRef.current.querySelector('textarea');
			if (textarea) {
				textarea.setSelectionRange(textarea.value.length, textarea.value.length);
			}
		}
		if (resetSelectionOnRender.current) {
			resetSelectionOnRender.current = false;
			if (props.onResetSelection) {
				props.onResetSelection();
			}
		}
	});
	
	useImperativeHandle(ref, () => ({
		blurOpenField
	}));
	
	function handleAddTag() {
		setSelectedTag('');
		showNewRow(true);
		requestID.current++;
	}
	
	function showNewRow(show) {
		setNewRow(show);
		if (show) {
			setSelectedTag('');
			newRowID.current++;
		}
	}
	
	function handleEdit(event) {
		if (!props.editable) {
			return;
		}
		if (skipNextEdit.current) {
			skipNextEdit.current = false;
			return;
		}
		var tag = event.currentTarget.closest('[data-tag]').dataset.tag;
		if (tag === '') {
			return;
		}
		// If switching from input to textarea, don't change anything
		if (isMultiline) {
			return;
		}
		setCurrentValue(tag);
		setSelectedTag(tag);
		showNewRow(false);
	}
	
	function handleKeyDown(event) {
		// With the delete button set to tabindex=-1, Tab doesn't work in the last tag for some
		// reason, so blur it manually
		if (!isMultiline && event.key == 'Tab' && !event.shiftKey) {
			let target = event.currentTarget || event.target;
			let oldTag = target.closest('[data-tag]').dataset.tag;
			if (oldTag === '' && target.value === '') {
				textboxRef.current.blur();
			}
		}
	}
	
	function handleMouseDown(event) {
		// Prevent right-click on a tag from switching to edit mode
		if (event.button != 0) {
			event.stopPropagation();
			event.preventDefault();
			// The above works on its own, but setting the XUL context popup allows the event to go
			// through if the confirmation prompt for "Remove All Tags" is cancelled, so we need
			// to skip the next edit event as well
			skipNextEdit.current = true;
		}
	}
	
	function handleCommit(newTag, hasChanged, event) {
		var oldTag = (event.currentTarget || event.target).closest('[data-tag]').dataset.tag;
		
		var oldTags = tags;
		var sortedTags = getSortedTags(oldTags);
		var lastTag = sortedTags.length ? sortedTags[oldTags.length - 1] : null;
		
		if (!isMultiline
				&& event.key == 'Enter'
				&& event.shiftKey) {
			let trimmed = newTag.trim();
			if (trimmed !== '') {
				trimmed += "\n";
			}
			setCurrentValue(trimmed);
			setIsMultiline(true);
			setRows(6);
			event.preventDefault();
			return;
		}
		
		setCurrentValue('');
		setSelectedTag('');
		setIsMultiline(false);
		
		// Tag hasn't changed
		if (oldTag === newTag) {
			// If Enter was pressed in an empty text box, hide it
			if (newTag === '') {
				showNewRow(false);
			}
			/*else if (oldTag == lastTag.tag) {
				showNewRow(true);
			}*/
			resetSelectionOnRender.current = event.key == 'Enter';
			return;
		}
		
		var newTags = [];
		
		if (newTag !== '') {
			// Split by newlines
			let splitTags = newTag.split(/\r\n?|\n/)
				.map(val => val.trim())
				.filter(x => x);
			let newTagsMap = new Map();
			
			// Get all tags
			for (let i = 0; i < oldTags.length; i++) {
				let tag = oldTags[i];
				
				// If this was the tag being edited, add the new value(s)
				if (tag.tag == oldTag) {
					for (let t of splitTags) {
						newTagsMap.set(t, { tag: t });
					}
					if (oldTag == lastTag) {
						showNewRow(true);
					}
				}
				// Otherwise add the old one
				else {
					newTagsMap.set(tag.tag, tag);
				}
			}
			
			// New tag at end
			if (oldTag === '') {
				for (let t of splitTags) {
					newTagsMap.set(t, { tag: t });
				}
				// Call this again to increment the ref and avoid reusing the entered value in the
				// next new row
				showNewRow(true);
			}
			else {
				resetSelectionOnRender.current = event.key == 'Enter';
			}
			
			newTags = [...newTagsMap.values()];
		}
		// Tag cleared
		else {
			newTags = oldTags.filter(tag => tag.tag != oldTag);
			showNewRow(false);
			resetSelectionOnRender.current = event.key == 'Enter';
		}
		
		setTags(getSortedTags(newTags));
		props.onTagsUpdate(newTags);
	}
	
	function handleCancel() {
		setCurrentValue('');
		setSelectedTag('');
		setIsMultiline(false);
		showNewRow(false);
		//setSuggestions([]);
		resetSelectionOnRender.current = true;
		requestID.current++;
	}
	
	function handleDelete(event) {
		var tag = event.currentTarget.closest('[data-tag]').dataset.tag;
		var oldTags = tags;
		
		setSelectedTag('');
		
		var newTags = oldTags.filter(t => t.tag !== tag);
		setTags(newTags);
		props.onTagsUpdate(newTags);
	}
	
	function handlePaste(event) {
		var text = event.clipboardData.getData('text');
		//paste = paste.toUpperCase();
		
		var multiline = !!text.trim().match(/\n/);
		if (multiline) {
			//setCurrentValue(str.trim());
			
			let field = event.target;
			let newValue;
			// TODO: Add newlines before and after if necessary
			if (field.selectionStart || field.selectionStart == '0') {
				let startPos = field.selectionStart;
				let endPos = field.selectionEnd;
				newValue = field.value.substring(0, startPos)
					+ text
					+ field.value.substring(endPos, field.value.length);
			}
			else {
				newValue = field.value + text;
			}
			
			setCurrentValue(newValue);
			setIsMultiline(true);
			setRows(newValue.split(/\n/).length);
			event.preventDefault();
		}
	}
	
	function blurOpenField(event) {
		if (textboxRef.current && (!event || event.target != textboxRef.current)) {
			textboxRef.current.blur();
		}
	}
	
	function getSortedTags(tags) {
		var sortedTags = [...tags];
		sortedTags.sort((a, b) => a.tag.localeCompare(b.tag));
		return sortedTags;
	}
	
	async function getFilteredSuggestions(value) {
		var suggestions = await props.getSuggestions(value);
		return suggestions.filter(s => !tagNames.has(s));
	}
	
	function tagsEqual(a, b) {
		if (a.length != b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i].tag !== b[i].tag || a[i].type !== b[i].type) {
				return false;
			}
		}
		return true;
	}
	
	function renderCount() {
		var count = tags.length;
		var str = 'pane.item.tags.count.';
		// TODO: Switch to plural rules
		switch (count) {
			case 0:
				str += 'zero';
				break;
			case 1:
				str += 'singular';
				break;
			default:
				str += 'plural';
				break;
		}
		return Zotero.getString(str, [count]);
	}
	
	function renderTagRow(tag) {
		// Icon
		var iconFile = 'tag';
		var title = '';
		if (!tag.type || tag.newRow) {
			title = Zotero.getString('pane.item.tags.icon.user');
		}
		else if (tag.type == 1) {
			title = Zotero.getString('pane.item.tags.icon.automatic');
			iconFile += '-automatic';
		}
		
		var selected = tag.tag === selectedTag;
		
		// Style colored tags
		var style = {};
		if (!selected) {
			let colorData = props.colors.get(tag.tag);
			if (colorData) {
				style.fontWeight = 'bold';
				style.color = colorData.color;
			}
		}
		
		return (
			<li
					className={cx({ tag: true, multiline: selected && isMultiline })}
					key={tag.newRow ? newRowID.current + '' : tag.tag}
					data-tag={tag.tag}
			>
				<img
						src={`chrome://zotero/skin/${iconFile}${Zotero.hiDPISuffix}.png`}
						alt={title}
						title={title}
						tooltiptext={title}
						style={{ width: "16px", height: "16px" }}
						onClick={props.editable ? (() => setSelectedTag(tag.tag)) : undefined}
				/>
				<div className="editable-container" style={style}>
					<Editable
						autoComplete={!isMultiline}
						autoFocus
						className={cx({ 'zotero-clicky': props.editable && !selected })}
						getSuggestions={getFilteredSuggestions}
						inputComponent={isMultiline ? TextAreaInput : Input}
						isActive={selected}
						isReadOnly={!props.editable}
						onCancel={handleCancel}
						onClick={handleEdit}
						onCommit={handleCommit}
						onFocus={handleEdit}
						onKeyDown={handleKeyDown}
						onMouseDown={handleMouseDown}
						onPaste={handlePaste}
						ref={textboxRef}
						selectOnFocus={!isMultiline}
						value={(selected && isMultiline) ? currentValue : tag.tag}
					/>
				</div>
				{props.editable
					&& (<button
							onClick={handleDelete}
							tabIndex="-1"
					>
						<img
							alt={removeStr}
							height="18"
							width="18"
							title={removeStr}
							tooltiptext={removeStr}
							src={`chrome://zotero/skin/minus${Zotero.hiDPISuffix}.png`}/>
					</button>)}
			</li>
		);
	}
	
	// When the initial tags change (because the item was updated), update state with those
	var initialTags = getSortedTags(props.initialTags);
	if (!tagsEqual(initialTags, prevInitialTags)) {
		setTags(initialTags);
		setPrevInitialTags(initialTags);
	}
	
	var displayTags = [...tags];
	if (newRow) {
		displayTags.push({
			tag: '',
			newRow: true
		});
	}
	
	return (
		<div className="tags-box" ref={rootRef} onClick={blurOpenField}>
			<div className="tags-box-header">
				<div className="tags-box-count">{renderCount()}</div>
				{ props.editable && <div><button onClick={handleAddTag}>Add</button></div> }
			</div>
			<div className="tags-box-list-container">
				<ul className="tags-box-list">
					{displayTags.map(tag => renderTagRow(tag))}
				</ul>
				{ props.editable && <span
					tabIndex="0"
					onFocus={handleAddTag}
				/> }
			</div>
		</div>
	);
});

TagsBox.propTypes = {
	colors: PropTypes.instanceOf(Map),
	editable: PropTypes.bool,
	getSuggestions: PropTypes.func,
	initialTags: PropTypes.array.isRequired,
	onResetSelection: PropTypes.func,
	onTagsUpdate: PropTypes.func
};

export default TagsBox;