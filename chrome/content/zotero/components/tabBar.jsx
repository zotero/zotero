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

import React, { forwardRef, useState, useRef, useImperativeHandle, useEffect, useLayoutEffect, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
const { CSSIcon, CSSItemTypeIcon } = require('./icons');

const SCROLL_ARROW_SCROLL_BY = 222;

const Tab = memo((props) => {
	const { icon, id, index, isBeingDragged, isItemType, onContextMenu, onDragEnd, onDragStart, onTabClick, onTabClose, onTabMouseDown, selected, title } = props;
	
	const handleTabMouseDown = useCallback(event => onTabMouseDown(event, id), [onTabMouseDown, id]);
	const handleContextMenu = useCallback(event => onContextMenu(event, id), [onContextMenu, id]);
	const handleTabClick = useCallback(event => onTabClick(event, id), [onTabClick, id]);
	const handleDragStart = useCallback(event => onDragStart(event, id, index), [onDragStart, id, index]);
	const handleTabClose = useCallback(event => onTabClose(event, id), [onTabClose, id]);
	
	return (
		<div
			key={id}
			data-id={id}
			className={cx('tab', { selected, dragging: isBeingDragged })}
			draggable={true}
			onMouseDown={handleTabMouseDown}
			onContextMenu={handleContextMenu}
			onClick={handleTabClick}
			onAuxClick={handleTabClick}
			onDragStart={handleDragStart}
			onDragEnd={onDragEnd}
			tabIndex="-1"
		>
			{ isItemType
				? <CSSItemTypeIcon itemType={icon} className="tab-icon" />
				: <CSSIcon name={icon} className="tab-icon" />
			}
			<div className="tab-name" title={title}>{title}</div>
			<div
				className="tab-close"
				onClick={handleTabClose}
			>
				<CSSIcon name="x-8" className="icon-16" />
			</div>
		</div>
	);
});

Tab.displayName = 'Tab';
Tab.propTypes = {
	icon: PropTypes.string,
	id: PropTypes.string.isRequired,
	index: PropTypes.number.isRequired,
	isBeingDragged: PropTypes.bool.isRequired,
	isItemType: PropTypes.bool,
	onContextMenu: PropTypes.func.isRequired,
	onDragEnd: PropTypes.func.isRequired,
	onDragStart: PropTypes.func.isRequired,
	onTabClick: PropTypes.func.isRequired,
	onTabClose: PropTypes.func.isRequired,
	onTabMouseDown: PropTypes.func.isRequired,
	selected: PropTypes.bool.isRequired,
	title: PropTypes.string.isRequired
};


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
		let handleResize = Zotero.Utilities.throttle(() => {
			updateScrollArrows();
			updateOverflowing();
		}, 300, { leading: false });
		window.addEventListener('resize', handleResize);
		props.onLoad();
		return () => {
			window.removeEventListener('resize', handleResize);
		};
	}, []);

	useEffect(() => {
		// Scroll selected tab into view
		let selectedTabNode = tabsInnerContainerRef.current.querySelector(".tab.selected");
		if (!selectedTabNode || dragging) return;
		selectedTabNode.scrollIntoView({ behavior: 'smooth' });
	}, [tabs]);

	useLayoutEffect(updateScrollArrows);
	useLayoutEffect(updateOverflowing, [tabs]);

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

	function updateOverflowing() {
		tabsInnerContainerRef.current.querySelectorAll('.tab-name').forEach((tabNameDOM) => {
			tabNameDOM.classList.toggle('overflowing', tabNameDOM.scrollWidth > tabNameDOM.clientWidth);
		});
	}
	
	const handleTabMouseDown = useCallback((event, id) => {
		// Don't select tab if it'll be closed with middle button click on mouse up
		// or on right-click
		if ([1, 2].includes(event.button)) {
			return;
		}
		
		if (event.target.closest('.tab-close')) {
			return;
		}
		props.onTabSelect(id);
		event.stopPropagation();
	}, [props.onTabSelect]);

	const handleContextMenu = useCallback((event, id) => {
		let { screenX, screenY } = event;
		// Popup gets immediately closed without this
		setTimeout(() => {
			props.onContextMenu(screenX, screenY, id);
		});
	}, [props.onContextMenu]);

	const handleTabClick = useCallback((event, id) => {
		if (event.button === 1) {
			props.onTabClose(id);
		}
	}, [props.onTabClose]);

	const handleDragStart = useCallback((event, id, index) => {
		// Library tab is not draggable
		if (index === 0) {
			event.preventDefault();
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
	}, []);
	
	const handleDragEnd = useCallback(() => {
		setDragging(false);
		props.refocusReader();
	}, [props.refocusReader]);

	const handleTabBarDragOver = useCallback((event) => {
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
	}, [props.onTabMove]);

	const handleTabClose = useCallback((event, id) => {
		props.onTabClose(id);
		event.stopPropagation();
	}, [props.onTabClose]);
	

	const handleWheel = useCallback((event) => {
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
	}, []);

	const handleClickScrollStart = useCallback(() => {
		tabsRef.current.scrollTo({
			left: tabsRef.current.scrollLeft - (SCROLL_ARROW_SCROLL_BY * (Zotero.rtl ? -1 : 1)),
			behavior: 'smooth'
		});
	}, []);

	const handleClickScrollEnd = useCallback(() => {
		tabsRef.current.scrollTo({
			left: tabsRef.current.scrollLeft + (SCROLL_ARROW_SCROLL_BY * (Zotero.rtl ? -1 : 1)),
			behavior: 'smooth'
		});
	}, []);

	// Prevent maximizing/minimizing window
	const handleScrollArrowDoubleClick = useCallback((event) => {
		event.preventDefault();
	}, []);

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
					>
						{tabs.length
							? <Tab
								{ ...tabs[0] }
								key={tabs[0].id}
								index={0}
								isBeingDragged={ false }
								onContextMenu={ handleContextMenu}
								onDragEnd={ handleDragEnd }
								onDragStart={ handleDragStart}
								onTabClick={ handleTabClick}
								onTabClose={ handleTabClose}
								onTabMouseDown = { handleTabMouseDown }
							/>
							: null}
					</div>
				</div>
				<div
					ref={startArrowRef}
					className="scroll-start-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
				>
					<button
						onClick={handleClickScrollStart}
						onDoubleClick={handleScrollArrowDoubleClick}
					>
						<CSSIcon name="chevron-tabs" className="icon-20" />
					</button>
				</div>
				<div className="tabs-wrapper">
					<div
						ref={tabsRef}
						className="tabs"
						onDragOver={handleTabBarDragOver}
						onScroll={updateScrollArrows}
						dir={Zotero.dir}
					>
						{tabs.map((tab, index) => <Tab
							{...tab}
							key={tab.id}
							index={index}
							isBeingDragged={dragging && dragIDRef.current === tab.id}
							onContextMenu={handleContextMenu}
							onDragEnd={handleDragEnd}
							onDragStart={handleDragStart}
							onTabClick={handleTabClick}
							onTabClose={handleTabClose}
							onTabMouseDown={handleTabMouseDown}
						/>)}
					</div>
				</div>
				<div
					ref={endArrowRef}
					className="scroll-end-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
				>
					<button
						onClick={handleClickScrollEnd}
						onDoubleClick={handleScrollArrowDoubleClick}
					>
						<CSSIcon name="chevron-tabs" className="icon-20" />
					</button>
				</div>
			</div>
		</div>
	);
});

TabBar.displayName = 'TabBar';

TabBar.propTypes = {
	onTabSelect: PropTypes.func.isRequired,
	onTabClose: PropTypes.func.isRequired,
	onLoad: PropTypes.func.isRequired,
	onTabMove: PropTypes.func.isRequired,
	refocusReader: PropTypes.func.isRequired,
	onContextMenu: PropTypes.func.isRequired,
	tabs: PropTypes.arrayOf(
		PropTypes.shape({
			icon: PropTypes.element.isRequired,
			id: PropTypes.string.isRequired,
			index: PropTypes.number.isRequired,
			isBeingDragged: PropTypes.bool.isRequired,
			onContextMenu: PropTypes.func.isRequired,
			onDragEnd: PropTypes.func.isRequired,
			onDragStart: PropTypes.func.isRequired,
			onTabClick: PropTypes.func.isRequired,
			onTabMouseDown: PropTypes.func.isRequired,
			selected: PropTypes.bool.isRequired,
			title: PropTypes.string.isRequired
		})
	).isRequired
};

export default TabBar;
