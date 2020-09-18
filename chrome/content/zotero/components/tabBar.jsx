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

"use strict";

import React, { forwardRef, useState, useImperativeHandle, useEffect } from 'react';
import cx from 'classnames';

const TabBar = forwardRef(function (props, ref) {
	const [tabs, setTabs] = useState(props.initialTabs);
	const [selectedIndex, setSelectedIndex] = useState(0);
	
	useImperativeHandle(ref, () => ({
		addTab({ title, type }) {
			var newTabs = [...tabs];
			newTabs.push({ title, type });
			setTabs(newTabs);
			setSelectedIndex(newTabs.length - 1);
		},
		
		renameTab(title, index) {
			var newTabs = tabs.map((tab, currentIndex) => {
				let newTab = Object.assign({}, tab);
				if (index == currentIndex) {
					newTab.title = title;
				}
				return newTab;
			});
			setTabs(newTabs);
		}
	}));
	
	useEffect(() => {
		if (props.onTabSelected) {
			props.onTabSelected(selectedIndex);
		}
	}, [selectedIndex]);
	
	
	function removeTab(index) {
		var newTabs = [...tabs];
		newTabs.splice(index, 1);
		setTabs(newTabs);
		setSelectedIndex(Math.min(selectedIndex, newTabs.length - 1));
		if (props.onTabClosed) {
			props.onTabClosed(index);
		}
	}
	
	function handleTabClick(event, index) {
		setSelectedIndex(index);
		event.stopPropagation();
	}
	
	function handleTabClose(event, index) {
		removeTab(index);
		if (props.onTabClose) {
			props.onTabClose(index);
		}
		event.stopPropagation();
	}
	
	function renderTab(tab, index) {
		return (
			<div
				key={index}
				className={cx("tab", { selected: index == selectedIndex })}
				onClick={(event) => handleTabClick(event, index)}
			>
				<div className="tab-name">{tab.title}</div>
				<div
					className="tab-close"
					onClick={(event) => handleTabClose(event, index)}
				>
					X
				</div>
			</div>
		);
	}
	
	return (
		<div className="tabs">
			{ tabs.map((tab, index) => renderTab(tab, index)) }
        </div>
	);
});

export default TabBar;