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

import React, { forwardRef, useState, useRef, useImperativeHandle, useEffect, useLayoutEffect } from 'react';
import cx from 'classnames';
const { IconXmark, IconArrowLeft, IconArrowRight } = require('./icons');

const SCROLL_ARROW_SCROLL_BY = 222;

const TabBar = forwardRef(function (props, ref) {
	const [tabs, setTabs] = useState([]);
	const [dragging, setDragging] = useState(false);
	const [dragMouseX, setDragMouseX] = useState(0);
	const dragIDRef = useRef(null);
	const dragGrabbedDeltaXRef = useRef();
	const tabsInnerContainerRef = useRef();
	const tabsRef = useRef();
	const startArrowRef = useRef();
	const endArrowRef = useRef();
	// Used to throttle mouse movement
	const mouseMoveWaitUntil = useRef(0);
	
	useImperativeHandle(ref, () => ({ setTabs }));

	useEffect(() => {
		let handleResize = () => updateScrollArrows();
		window.addEventListener('resize', handleResize);
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	useLayoutEffect(() => updateScrollArrows());

	// Use offsetLeft and offsetWidth to calculate and translate tab X position
	useLayoutEffect(() => {
		if (!dragIDRef.current) return;
		let tab = Array.from(tabsRef.current.children).find(x => x.dataset.id === dragIDRef.current);
		if (tab) {
			// While the actual tab node retains its space between other tabs,
			// we use CSS translation to move it to the left/right side to
			// position it under the mouse
			let x = dragMouseX - tab.offsetLeft - dragGrabbedDeltaXRef.current;

			let firstTab = tabsRef.current.firstChild;
			let lastTab = tabsRef.current.lastChild;

			// Don't allow to move tab beyond the second and the last tab
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

	function updateScrollArrows() {
		let scrollable = tabsRef.current.scrollWidth !== tabsRef.current.clientWidth;
		if (scrollable) {
			tabsInnerContainerRef.current.classList.add('scrollable');

			if (tabsRef.current.scrollLeft !== 0) {
				startArrowRef.current.classList.add('active');
			}
			else {
				startArrowRef.current.classList.remove('active');
			}

			if (tabsRef.current.scrollWidth - tabsRef.current.clientWidth !== Math.abs(tabsRef.current.scrollLeft)) {
				endArrowRef.current.classList.add('active');
			}
			else {
				endArrowRef.current.classList.remove('active');
			}
		}
		else {
			tabsInnerContainerRef.current.classList.remove('scrollable');
		}
	}
	
	function handleTabMouseDown(event, id) {
		// Don't select tab if it'll be closed with middle button click on mouse up
		if (event.button === 1) {
			return;
		}
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
		// Library tab is not draggable
		if (index === 0) {
			return;
		}
		event.dataTransfer.effectAllowed = 'move';
		// We don't want the generated image from the target element,
		// therefore setting an empty image
		let img = document.createElement('img');
		img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
		event.dataTransfer.setDragImage(img, 0, 0);
		// Some data needs to be set, although this is not used anywhere
		event.dataTransfer.setData('zotero/tab', id);
		// Store the relative mouse to tab X position where the tab was grabbed
		dragGrabbedDeltaXRef.current = event.clientX - event.target.offsetLeft;
		// Enable dragging
		setDragging(true);
		// Store the current tab id
		dragIDRef.current = id;
	}
	
	function handleDragEnd() {
		setDragging(false);
	}

	function handleTabBarDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		// Throttle
		if (!dragIDRef.current || mouseMoveWaitUntil.current > Date.now()) {
			return;
		}

		setDragMouseX(event.clientX);
		
		// Get the current tab DOM node
		let tabIndex = Array.from(tabsRef.current.children).findIndex(x => x.dataset.id === dragIDRef.current);
		let tab = tabsRef.current.children[tabIndex];

		// Calculate the center points of each tab
		let points = Array.from(tabsRef.current.children).map((child) => {
			return child.offsetLeft + child.offsetWidth / 2;
		});
		
		// Calculate where the new tab left and right (x1, x2) side points should
		// be relative to the current mouse position, and take into account
		// the initial relative mouse to tab position where the tab was grabbed
		let x1 = event.clientX - dragGrabbedDeltaXRef.current;
		let x2 = event.clientX - dragGrabbedDeltaXRef.current + tab.offsetWidth;
		
		let index = null;
		// Try to determine if the new tab left or right side is crossing
		// the middle point of the previous or the next tab, and use its index if so
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

		// If the new tab position doesn't fit between the central points
		// of other tabs, check if it's moved beyond the last tab
		if (index === null) {
			let p = points[points.length - 1];
			if (Zotero.rtl && x1 < p || !Zotero.rtl && x2 > p) {
				index = points.length;
			}
		}
		
		if (index !== null) {
			props.onTabMove(dragIDRef.current, index);
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

	function handleWheel(event) {
		// Normalize wheel speed
		let x = event.deltaX || event.deltaY;
		if (x && event.deltaMode) {
			if (event.deltaMode === 1) {
				x *= 20;
			}
			else {
				x *= 400;
			}
		}
		window.requestAnimationFrame(() => {
			tabsRef.current.scrollLeft += x;
		});
	}

	function handleClickScrollStart() {
		tabsRef.current.scrollTo({
			left: tabsRef.current.scrollLeft - (SCROLL_ARROW_SCROLL_BY * (Zotero.rtl ? -1 : 1)),
			behavior: 'smooth'
		});
	}

	function handleClickScrollEnd() {
		tabsRef.current.scrollTo({
			left: tabsRef.current.scrollLeft + (SCROLL_ARROW_SCROLL_BY * (Zotero.rtl ? -1 : 1)),
			behavior: 'smooth'
		});
	}

	// Prevent maximizing/minimizing window
	function handleScrollArrowDoubleClick(event) {
		event.preventDefault();
	}

	function renderTab({ id, title, selected, iconBackgroundImage }, index) {
		return (
			<div
				key={id}
				data-id={id}
				className={cx('tab', { selected, dragging: dragging && id === dragIDRef.current })}
				draggable={true}
				onMouseMove={() => handleTabMouseMove(title)}
				onMouseDown={(event) => handleTabMouseDown(event, id)}
				onClick={(event) => handleTabClick(event, id)}
				onAuxClick={(event) => handleTabClick(event, id)}
				onDragStart={(event) => handleDragStart(event, id, index)}
				onDragEnd={handleDragEnd}
			>
				<div className="tab-name" dir="auto">{iconBackgroundImage &&
					<span className="icon-bg" style={{ backgroundImage: iconBackgroundImage }}/>}{title}</div>
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
		<div>
			<div
				ref={tabsInnerContainerRef}
				className="tab-bar-inner-container"
				onWheel={handleWheel}
			>
				<div className="pinned-tabs">
					<div
						className="tabs"
						onMouseOut={handleTabBarMouseOut}
					>
						{tabs.length ? renderTab(tabs[0], 0) : null}
					</div>
				</div>
				<div
					ref={startArrowRef}
					className="scroll-start-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
					onClick={handleClickScrollStart}
					onDoubleClick={handleScrollArrowDoubleClick}
				><IconArrowLeft/></div>
				<div className="tabs-wrapper">
					<div
						ref={tabsRef}
						className="tabs"
						onDragOver={handleTabBarDragOver}
						onMouseOut={handleTabBarMouseOut}
						onScroll={updateScrollArrows}
						dir={Zotero.dir}
					>
						{tabs.map((tab, index) => renderTab(tab, index))}
					</div>
				</div>
				<div
					ref={endArrowRef}
					className="scroll-end-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
					onClick={handleClickScrollEnd}
					onDoubleClick={handleScrollArrowDoubleClick}
				><IconArrowRight/></div>
			</div>
		</div>
	);
});

export default TabBar;
