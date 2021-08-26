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

'use strict';

import React, { forwardRef, useState, useRef, useImperativeHandle, useLayoutEffect } from 'react';
import cx from 'classnames';
const { IconXmark } = require('./icons');

const TabBar = forwardRef(function (props, ref) {
	const [tabs, setTabs] = useState([]);
	const [dragging, setDragging] = useState(false);
	const [draggingX, setDraggingX] = useState(0);
	const draggingIDRef = useRef(null);
	const draggingDeltaXRef = useRef();
	const tabsRef = useRef();
	const mouseMoveWaitUntil = useRef(0);
	
	useImperativeHandle(ref, () => ({ setTabs }));
	
	useLayoutEffect(() => {
		if (!draggingIDRef.current) return;
		let tab = Array.from(tabsRef.current.children).find(x => x.dataset.id === draggingIDRef.current);
		if (tab) {
			let x = draggingX - tab.offsetLeft - draggingDeltaXRef.current;

			let firstTab = tabsRef.current.firstChild;
			let lastTab = tabsRef.current.lastChild;

			if (Zotero.rtl) {
				if (tab.offsetLeft + x < lastTab.offsetLeft
					|| tab.offsetLeft + tab.offsetWidth + x > firstTab.offsetLeft) {
					x = 0;
				}
			}
			else if (tab.offsetLeft + x > lastTab.offsetLeft
				|| tab.offsetLeft + x < firstTab.offsetLeft + firstTab.offsetWidth) {
				x = 0;
			}
			
			tab.style.transform = dragging ? `translateX(${x}px)` : 'unset';
		}
	});
	
	function handleTabMouseDown(event, id) {
		if (event.button === 2) {
			let { screenX, screenY } = event;
			// Popup gets immediately closed without this
			setTimeout(() => {
				props.onContextMenu(screenX, screenY, id);
			}, 0);
			return;
		}
		
		if (event.target.closest('.tab-close')) {
			return;
		}
		props.onTabSelect(id);
		event.stopPropagation();
	}

	function handleTabClick(event, id) {
		if (event.button === 1) {
			props.onTabClose(id);
		}
	}

	function handleDragStart(event, id, index) {
		if (index === 0) {
			return;
		}
		event.dataTransfer.effectAllowed = 'move';
		// Empty drag image
		let img = document.createElement('img');
		img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
		event.dataTransfer.setDragImage(img, 0, 0);
		event.dataTransfer.setData('zotero/tab', id);
		draggingDeltaXRef.current = event.clientX - event.target.offsetLeft;
		setDragging(true);
		draggingIDRef.current = id;
	}
	
	function handleDragEnd() {
		setDragging(false);
	}

	function handleTabBarDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		if (!draggingIDRef.current || mouseMoveWaitUntil.current > Date.now()) {
			return;
		}

		setDraggingX(event.clientX);
		
		let tabIndex = Array.from(tabsRef.current.children).findIndex(x => x.dataset.id === draggingIDRef.current);
		let tab = tabsRef.current.children[tabIndex];

		let points = Array.from(tabsRef.current.children).map((child) => {
			return child.offsetLeft + child.offsetWidth / 2;
		});
		
		let x1 = event.clientX - draggingDeltaXRef.current;
		let x2 = event.clientX - draggingDeltaXRef.current + tab.offsetWidth;
		
		let index = null;
		for (let i = 0; i < points.length - 1; i++) {
			if (i === tabIndex || i + 1 === tabIndex) {
				continue;
			}
			let p1 = points[i];
			let p2 = points[i + 1];
			if (
				Zotero.rtl && (x2 < p1 && x2 > p2 || x1 < p1 && x1 > p2)
				|| !Zotero.rtl && (x2 > p1 && x2 < p2 || x1 > p1 && x1 < p2)
			) {
				index = i + 1;
				break;
			}
		}

		if (index === null) {
			let p = points[points.length - 1];
			if (Zotero.rtl && x1 < p || !Zotero.rtl && x2 > p) {
				index = points.length;
			}
		}
		
		if (index !== null) {
			props.onTabMove(draggingIDRef.current, index);
		}
		mouseMoveWaitUntil.current = Date.now() + 20;
	}

	function handleTabClose(event, id) {
		props.onTabClose(id);
		event.stopPropagation();
	}
	
	function handleTabMouseMove(title) {
		// Fix `title` not working for HTML-in-XUL. Using `mousemove` ensures we restart the tooltip
		// after just a small movement even when the active tab has changed under the cursor, which
		// matches behavior in Firefox.
		window.Zotero_Tooltip.start(title);
	}
	
	function handleTabBarMouseOut() {
		// Hide any possibly open `title` tooltips when mousing out of any tab or the tab bar as a
		// whole. `mouseout` bubbles up from element you moved out of, so it covers both cases.
		window.Zotero_Tooltip.stop();
	}

	function renderTab({ id, title, selected }, index) {
		return (
			<div
				key={id}
				data-id={id}
				className={cx('tab', { selected, dragging: dragging && id === draggingIDRef.current })}
				draggable={true}
				onMouseMove={() => handleTabMouseMove(title)}
				onMouseDown={(event) => handleTabMouseDown(event, id)}
				onClick={(event) => handleTabClick(event, id)}
				onDragStart={(event) => handleDragStart(event, id, index)}
				onDragEnd={handleDragEnd}
			>
				<div className="tab-name">{title}</div>
				<div
					className="tab-close"
					onClick={(event) => handleTabClose(event, id)}
				>
					<IconXmark/>
				</div>
			</div>
		);
	}

	return (
		<div
			ref={tabsRef}
			className="tabs"
			onDragOver={handleTabBarDragOver}
			onMouseOut={handleTabBarMouseOut}
		>
			{tabs.map((tab, index) => renderTab(tab, index))}
		</div>
	);
});

export default TabBar;
