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

import React, { forwardRef, useState, useRef, useImperativeHandle, useEffect } from 'react';
import cx from 'classnames';
const { IconXmark } = require('./icons');

const TabBar = forwardRef(function (props, ref) {
	const [tabs, setTabs] = useState([]);
	const draggingID = useRef(null);
	const tabsRef = useRef();
	const mouseMoveWaitUntil = useRef(0);

	useEffect(() => {
		window.addEventListener('mouseup', handleWindowMouseUp);
		return () => {
			window.removeEventListener('mouseup', handleWindowMouseUp);
		};
	}, []);

	useImperativeHandle(ref, () => ({ setTabs }));

	function handleTabMouseDown(event, id, index) {
		if (event.target.closest('.tab-close')) {
			return;
		}
		if (index != 0) {
			draggingID.current = id;
		}
		props.onTabSelect(id);
		event.stopPropagation();
	}

	function handleTabBarMouseMove(event) {
		if (!draggingID.current || mouseMoveWaitUntil.current > Date.now()) {
			return;
		}
		let points = Array.from(tabsRef.current.children).map((child) => {
			let rect = child.getBoundingClientRect();
			return rect.left + rect.width / 2;
		});
		let index = null;
		for (let i = 0; i < points.length - 1; i++) {
			let point1 = points[i];
			let point2 = points[i + 1];
			if (event.clientX > Math.min(point1, point2)
				&& event.clientX < Math.max(point1, point2)) {
				index = i + 1;
				break;
			}
		}
		if (index === null) {
			let point1 = points[0];
			let point2 = points[points.length - 1];
			if ((point1 < point2 && event.clientX < point1
				|| point1 > point2 && event.clientX > point1)) {
				index = 0;
			}
			else {
				index = points.length;
			}
		}
		if (index == 0) {
			index = 1;
		}
		props.onTabMove(draggingID.current, index);
		mouseMoveWaitUntil.current = Date.now() + 100;
	}

	function handleWindowMouseUp(event) {
		draggingID.current = null;
		event.stopPropagation();
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
				className={cx('tab', { selected })}
				onMouseMove={() => handleTabMouseMove(title)}
				onMouseDown={(event) => handleTabMouseDown(event, id, index)}
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
			onMouseMove={handleTabBarMouseMove}
			onMouseOut={handleTabBarMouseOut}
		>
			{tabs.map((tab, index) => renderTab(tab, index))}
		</div>
	);
});

export default TabBar;
