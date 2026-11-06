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
	const { icon, id, isBeingDragged, isItemType, onContextMenu, onDragEnd, onDragStart, onTabClick, onTabClose, onTabMouseDown, onAudioStatusClick, pinned, closable, movable, selected, title, renderTitle, width, audioStatus } = props;
	
	const handleTabMouseDown = useCallback(event => onTabMouseDown(event, id), [onTabMouseDown, id]);
	const handleContextMenu = useCallback(event => onContextMenu(event, id), [onContextMenu, id]);
	const handleTabClick = useCallback(event => onTabClick(event, id), [onTabClick, id]);
	const handleDragStart = useCallback(event => onDragStart(event, id, movable), [onDragStart, id, movable]);
	const handleTabClose = useCallback(event => onTabClose(event, id), [onTabClose, id]);
	const handleAudioStatusClick = useCallback(event => onAudioStatusClick(event, id), [onAudioStatusClick, id]);
	
	let titleText;
	let titleHTML;
	if (renderTitle) {
		let parentElement = document.createElement('div');
		titleText = Zotero.Utilities.Internal.renderItemTitle(title, parentElement);
		titleHTML = parentElement.innerHTML;
	}
	else {
		titleText = title;
		titleHTML = null;
	}

	return (
		<div
			key={id}
			data-id={id}
			className={cx('tab', { selected, pinned, closable, dragging: isBeingDragged })}
			draggable={true}
			onMouseDown={handleTabMouseDown}
			onContextMenu={handleContextMenu}
			onClick={handleTabClick}
			onAuxClick={handleTabClick}
			onDragStart={handleDragStart}
			onDragEnd={onDragEnd}
			tabIndex="-1"
			style={ width ? { maxWidth: `${width}px` } : {}}
		>
			{ isItemType
				? <CSSItemTypeIcon itemType={icon} className="tab-icon" />
				: <CSSIcon name={icon} className="tab-icon" />
			}
			{audioStatus?.active && (
				<div
					className="tab-audio-status"
					role="button"
					data-l10n-id={`reader-tab-audio-${audioStatus.paused ? 'play' : 'pause'}`}
					onClick={handleAudioStatusClick}
					onMouseDown={e => e.stopPropagation()}
				>
					<CSSIcon name={audioStatus.paused ? 'play' : 'pause'} className="icon-16"/>
				</div>
			)}
			{titleHTML
				? <div className="tab-name" title={titleText} dangerouslySetInnerHTML={{ __html: titleHTML }}/>
				: <div className="tab-name" title={titleText}>{titleText}</div>}
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
	isBeingDragged: PropTypes.bool.isRequired,
	isItemType: PropTypes.bool,
	onContextMenu: PropTypes.func.isRequired,
	onDragEnd: PropTypes.func.isRequired,
	onDragStart: PropTypes.func.isRequired,
	onTabClick: PropTypes.func.isRequired,
	onTabClose: PropTypes.func.isRequired,
	onTabMouseDown: PropTypes.func.isRequired,
	onAudioStatusClick: PropTypes.func.isRequired,
	pinned: PropTypes.bool,
	closable: PropTypes.bool,
	movable: PropTypes.bool,
	selected: PropTypes.bool.isRequired,
	title: PropTypes.string.isRequired,
	renderTitle: PropTypes.bool,
	width: PropTypes.number,
	audioStatus: PropTypes.shape({
		active: PropTypes.bool.isRequired,
		paused: PropTypes.bool.isRequired,
	}),
};


const DRAG_THUMBNAIL_WIDTH = 160;
const DRAG_THUMBNAIL_HEIGHT = 90;
// Below and to the right of the pointer
const DRAG_THUMBNAIL_OFFSET = -16;
// How far outside the first or last tab the line for a dropped tab is
const DROP_INDICATOR_INSET = 4;
// How far a dragged tab's pointer moves before the tab follows it
const DRAG_MOVE_THRESHOLD = 8;
// How long a drag rests on a tab before the tab is selected
const SPRING_LOAD_DELAY = 750;

const TabBar = forwardRef(function (props, ref) {
	const [tabs, setTabs] = useState([]);
	const [dragging, setDragging] = useState(false);
	const [dragMouseX, setDragMouseX] = useState(0);
	const [lockedTabsState, setLockedTabsState] = useState(new Map());
	// Where a tab dragged from another window would be inserted, or null
	const [dropIndex, setDropIndex] = useState(null);
	const dropIndicatorRef = useRef();
	const dragIDRef = useRef(null);
	const dragGrabbedDeltaXRef = useRef();
	// Where the drag started, and whether the tab has moved from there yet
	const dragStartXRef = useRef();
	const dragMovedRef = useRef(false);
	// The empty image shown while a dragged tab is over its own tab bar, and the thumbnail of
	// its content shown under the pointer once it leaves
	const emptyDragImageRef = useRef();
	const dragThumbnailRef = useRef();
	const dragImageShownRef = useRef(false);
	// Where the pointer is relative to the window's corner with the dragged tab at the start of
	// the tab bar, for placing a window torn off from it
	const tearOffOffsetRef = useRef();
	// Whether the dragged tab was dropped on this window's own tab bar
	const droppedInOwnWindowRef = useRef(false);
	// The tab a drag is resting on, and the timer that selects it
	const springLoadRef = useRef({ id: null, timer: null });
	const tabsInnerContainerRef = useRef();
	const tabsRef = useRef();
	const spacerRef = useRef();
	const startArrowRef = useRef();
	const endArrowRef = useRef();
	// Used to throttle mouse movement
	const mouseMoveWaitUntil = useRef(0);
	
	// Finish a drag whose tab has been moved to another window
	const endDrag = useCallback(() => {
		setDragging(false);
	}, []);

	useImperativeHandle(ref, () => ({ setTabs, endDrag }));

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
		if (!selectedTabNode || dragging || lockedTabsState.size) return;
		selectedTabNode.scrollIntoView({ behavior: 'smooth' });
	}, [tabs]);

	useLayoutEffect(preserveScrollPosition, [tabs, lockedTabsState]);
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

			// Keep the tab between the pinned tabs, or the start of the tab bar, and the last tab
			let tabNodes = Array.from(tabsRef.current.querySelectorAll('.tab'))
				.filter(node => node.offsetWidth);
			let lastPinnedTab = tabNodes.filter(node => node.classList.contains('pinned')).pop();
			let firstTab = tabNodes[0];
			let lastTab = tabNodes[tabNodes.length - 1];
			let minLeft, maxLeft;
			if (Zotero.rtl) {
				minLeft = lastTab.offsetLeft;
				maxLeft = (lastPinnedTab
					? lastPinnedTab.offsetLeft
					: firstTab.offsetLeft + firstTab.offsetWidth) - tab.offsetWidth;
			}
			else {
				minLeft = lastPinnedTab
					? lastPinnedTab.offsetLeft + lastPinnedTab.offsetWidth
					: firstTab.offsetLeft;
				maxLeft = lastTab.offsetLeft + lastTab.offsetWidth - tab.offsetWidth;
			}
			x = Math.min(Math.max(x, minLeft - tab.offsetLeft), maxLeft - tab.offsetLeft);
			
			tab.style.transform = dragging ? `translateX(${x}px)` : 'unset';
		}
		// The drag is over once the tab is back in place
		if (!dragging) {
			dragIDRef.current = null;
		}
	});

	// Show a line where a tab dragged from another window would be inserted: between two tabs,
	// or just outside the first or last tab
	useLayoutEffect(() => {
		let indicator = dropIndicatorRef.current;
		let tabNodes = Array.from(tabsRef.current.querySelectorAll('.tab'));
		if (dropIndex === null || !tabNodes.length) {
			indicator.hidden = true;
			return;
		}
		let leading = rect => (Zotero.rtl ? rect.right : rect.left);
		let trailing = rect => (Zotero.rtl ? rect.left : rect.right);
		let outward = Zotero.rtl ? DROP_INDICATOR_INSET : -DROP_INDICATOR_INSET;
		let before = tabNodes[dropIndex - 1]?.getBoundingClientRect();
		let after = tabNodes[dropIndex]?.getBoundingClientRect();
		let x;
		if (before && after) {
			x = (trailing(before) + leading(after)) / 2;
		}
		else if (after) {
			x = leading(after) + outward;
		}
		else {
			x = trailing(before) - outward;
		}
		let rect = after || before;
		let parentRect = indicator.parentNode.getBoundingClientRect();
		indicator.style.left = `${x - parentRect.left}px`;
		indicator.style.top = `${rect.top - parentRect.top}px`;
		indicator.style.height = `${rect.height}px`;
		indicator.hidden = false;
	}, [dropIndex, tabs]);

	function updateScrollArrows() {
		if (lockedTabsState.size) return;
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

	// Preserve the relative scroll position when tabs are being closed.
	// (set in handleTabClose)
	function preserveScrollPosition() {
		let desiredScrollLeft = lockedTabsState.get("scroll-left");
		if (!desiredScrollLeft) return;
		tabsRef.current.scrollLeft = desiredScrollLeft;
		// If there are not many tabs left, there may be not enough scrollable
		// space to keep the original scrollLeft position. Add a spacer at the end and try again.
		if (tabsRef.current.scrollLeft !== desiredScrollLeft) {
			let spacerWidth = parseInt(spacerRef.current.style.minWidth) || 0;
			let columnGap = 4;
			let tabWidth = lockedTabsState.get("tab") || 0;
			spacerRef.current.style.minWidth = `${spacerWidth + tabWidth + columnGap}px`;
			tabsRef.current.scrollLeft = desiredScrollLeft;
		}
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
	
	const handleAudioStatusClick = useCallback((event, id) => {
		props.onToggleAudio(id);
		event.stopPropagation();
	}, [props.onToggleAudio]);

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

	const handleDragStart = useCallback((event, id, movable) => {
		if (!movable) {
			event.preventDefault();
			return;
		}
		event.dataTransfer.effectAllowed = 'move';
		// We don't want the generated image from the target element,
		// therefore setting an empty image
		let img = document.createElement('img');
		img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
		event.dataTransfer.setDragImage(img, 0, 0);
		emptyDragImageRef.current = img;
		dragImageShownRef.current = false;
		let tabRect = event.target.getBoundingClientRect();
		let barRect = tabsRef.current.getBoundingClientRect();
		tearOffOffsetRef.current = {
			x: event.clientX - tabRect.left + barRect.left + window.mozInnerScreenX - window.screenX,
			y: event.clientY + window.mozInnerScreenY - window.screenY
		};
		let dataTransfer = event.dataTransfer;
		let canvas = document.createElement('canvas');
		canvas.width = DRAG_THUMBNAIL_WIDTH * window.devicePixelRatio;
		canvas.height = DRAG_THUMBNAIL_HEIGHT * window.devicePixelRatio;
		dragThumbnailRef.current = null;
		props.onDrawDragThumbnail(id, canvas)
			.then((drawn) => {
				if (!drawn || dragIDRef.current !== id) return;
				dragThumbnailRef.current = canvas;
				// Show it if the tab has already left the tab bar
				if (dragImageShownRef.current) {
					dragImageShownRef.current = false;
					setDragImageShown(dataTransfer, true);
				}
			})
			.catch(e => Zotero.logError(e));
		// Identify the tab to the tab bar of another window
		event.dataTransfer.setData(
			'zotero/tab', JSON.stringify({ windowID: props.windowID, id })
		);
		// Store the relative mouse to tab X position where the tab was grabbed
		dragGrabbedDeltaXRef.current = event.clientX - event.target.offsetLeft;
		dragStartXRef.current = event.clientX;
		dragMovedRef.current = false;
		setDragMouseX(event.clientX);
		// Enable dragging
		setDragging(true);
		// Store the current tab id
		dragIDRef.current = id;
	}, [props.windowID, props.onDrawDragThumbnail]);
	
	/**
	 * Show a thumbnail of the dragged tab's content under the pointer while it's outside the tab
	 * bar, where the tab itself can't follow it, and hide it again once it's back
	 */
	function setDragImageShown(dataTransfer, shown) {
		if (dragImageShownRef.current === shown) return;
		dragImageShownRef.current = shown;
		// Shown once it's drawn
		if (shown && !dragThumbnailRef.current) return;
		try {
			if (shown) {
				dataTransfer.updateDragImage(
					dragThumbnailRef.current, DRAG_THUMBNAIL_OFFSET, DRAG_THUMBNAIL_OFFSET
				);
			}
			else {
				dataTransfer.updateDragImage(emptyDragImageRef.current, 0, 0);
			}
		}
		// If the drag image can't be updated, the drag continues without a thumbnail
		catch (e) {
			Zotero.debug(e, 2);
		}
	}
	
	const handleDragEnd = useCallback((event) => {
		let id = dragIDRef.current;
		setDragging(false);
		let { dataTransfer, screenX, screenY } = event;
		// Refocusing a window brings it to the front, so leave the window behind the one the tab
		// was dropped in
		let droppedInOtherWindow = dataTransfer.dropEffect != 'none'
			&& !droppedInOwnWindowRef.current;
		droppedInOwnWindowRef.current = false;
		if (!droppedInOtherWindow && document.hasFocus()) {
			props.onRefocus();
		}
		// A tab dropped where nothing took it is torn off into a new window
		if (!id || dataTransfer.mozUserCancelled || dataTransfer.dropEffect != 'none') {
			return;
		}
		// Unless it's dropped on or just below the window's own tab bar
		let barRect = tabsRef.current.getBoundingClientRect();
		if (screenX > window.screenX && screenX < window.screenX + window.outerWidth
				&& screenY > window.screenY
				&& screenY < window.mozInnerScreenY + barRect.bottom + barRect.height * 1.5) {
			return;
		}
		let { x, y } = tearOffOffsetRef.current;
		props.onTabTearOff(id, screenX - x, screenY - y);
	}, [props.onRefocus, props.onTabTearOff]);

	/**
	 * Return the insertion index for a drop at clientX -- before the first tab whose midpoint
	 * is past it
	 */
	function getDropIndex(clientX) {
		let tabNodes = Array.from(tabsRef.current.querySelectorAll('.tab'));
		let index = tabNodes.findIndex((tabNode) => {
			let { left, width } = tabNode.getBoundingClientRect();
			let midpoint = left + width / 2;
			return Zotero.rtl ? clientX > midpoint : clientX < midpoint;
		});
		return index === -1 ? tabNodes.length : index;
	}

	function cancelSpringLoad() {
		clearTimeout(springLoadRef.current.timer);
		springLoadRef.current = { id: null, timer: null };
	}

	// Select a tab that a drag of something other than a tab rests on, so that it can be dropped
	// in the tab's content
	const handleSpringLoadDragOver = useCallback((event) => {
		if (dragIDRef.current || event.dataTransfer.types.includes('zotero/tab')) {
			return;
		}
		let tabNode = event.target.closest('.tab');
		let id = tabNode?.dataset.id || null;
		if (id === springLoadRef.current.id) {
			return;
		}
		cancelSpringLoad();
		if (!id || tabNode.classList.contains('selected')) {
			return;
		}
		let timer = setTimeout(() => {
			springLoadRef.current.timer = null;
			props.onTabSelect(id);
		}, SPRING_LOAD_DELAY);
		springLoadRef.current = { id, timer };
	}, [props.onTabSelect]);

	const handleSpringLoadDragLeave = useCallback((event) => {
		if (tabsInnerContainerRef.current.contains(event.relatedTarget)) {
			return;
		}
		cancelSpringLoad();
	}, []);

	const handleTabBarDragOver = useCallback((event) => {
		let { dataTransfer } = event;
		// A tab from another window, or objects to open in new tabs, are only taken when
		// dropped, so show where they would go
		if (!dragIDRef.current) {
			let isTab = dataTransfer.types.includes('zotero/tab');
			if (!isTab && !props.canOpenDrop(dataTransfer)) {
				return;
			}
			event.preventDefault();
			let effect = isTab || dataTransfer.effectAllowed == 'move' ? 'move' : 'copy';
			// See LibraryTree#setDropEffect()
			if (!isTab && (Zotero.isWin || Zotero.isLinux)) {
				dataTransfer.effectAllowed = effect;
			}
			dataTransfer.dropEffect = effect;
			setDropIndex(getDropIndex(event.clientX));
			return;
		}
		event.preventDefault();
		dataTransfer.dropEffect = 'move';
		setDragImageShown(event.dataTransfer, false);
		// Start moving the tab once the pointer passes the drag threshold
		if (!dragMovedRef.current) {
			if (Math.abs(event.clientX - dragStartXRef.current) < DRAG_MOVE_THRESHOLD) {
				return;
			}
			dragMovedRef.current = true;
		}
		// Throttle
		if (mouseMoveWaitUntil.current > Date.now()) {
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
		// of other tabs, check if it's moved before the first tab or beyond the last tab
		if (index === null) {
			let first = points[0];
			let last = points[points.length - 1];
			if (Zotero.rtl && x2 > first || !Zotero.rtl && x1 < first) {
				index = 0;
			}
			else if (Zotero.rtl && x1 < last || !Zotero.rtl && x2 > last) {
				index = points.length;
			}
		}
		
		if (index !== null) {
			props.onTabMove(dragIDRef.current, index);
		}
		mouseMoveWaitUntil.current = Date.now() + 20;
	}, [props.onTabMove]);

	const handleTabBarDragLeave = useCallback((event) => {
		// Moving between the tab bar's own children fires dragleave too
		if (tabsRef.current.contains(event.relatedTarget)) {
			return;
		}
		setDropIndex(null);
		if (dragIDRef.current) {
			setDragImageShown(event.dataTransfer, true);
		}
	}, []);

	const handleTabBarDrop = useCallback((event) => {
		setDropIndex(null);
		cancelSpringLoad();
		if (!event.dataTransfer.types.includes('zotero/tab')) {
			if (props.canOpenDrop(event.dataTransfer)) {
				event.preventDefault();
				props.onOpenDrop(event.dataTransfer, getDropIndex(event.clientX));
			}
			return;
		}
		let payload;
		try {
			payload = JSON.parse(event.dataTransfer.getData('zotero/tab'));
		}
		catch {
			return;
		}
		if (!payload?.windowID || !payload.id) {
			return;
		}
		// A tab from this window is moved as it's dragged, so just take the drop
		if (payload.windowID === props.windowID) {
			droppedInOwnWindowRef.current = true;
			event.preventDefault();
			return;
		}
		event.preventDefault();
		props.onTabDropFromWindow(payload.windowID, payload.id, getDropIndex(event.clientX));
	}, [props.onTabDropFromWindow, props.canOpenDrop, props.onOpenDrop, props.windowID]);

	const handleTabClose = useCallback((event, id) => {
		// When a tab is being closed, lock the widths of tabs and scroll position,
		// so that the next tab's "X" button also ends up under the mouse
		if (!lockedTabsState.size) {
			let tabElements = [...tabsInnerContainerRef.current.querySelectorAll(".tab")].filter(tab => tab.offsetWidth);
			let pinnedTab = tabElements.find(tab => tab.classList.contains("pinned"));
			let tab = tabElements.find(tab => !tab.classList.contains("pinned"));
			setLockedTabsState(new Map([
				["pinned", pinnedTab?.offsetWidth],
				["tab", tab?.offsetWidth],
				["scroll-left", tabsRef.current.scrollLeft]
			]));
		}
		props.onTabClose(id);
		event.stopPropagation();
	}, [props.onTabClose, lockedTabsState]);

	// When the mouse leaves the tab bar, un-freeze the width and positioning
	// of tabs that are locked when tabs are being closed.
	const handleTabBarMouseLeave = useCallback(() => {
		if (!lockedTabsState.size) return;
		setLockedTabsState(new Map());
		spacerRef.current.style.removeProperty("min-width");
	}, [lockedTabsState]);

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
				onMouseLeave={handleTabBarMouseLeave}
				onDragOver={handleSpringLoadDragOver}
				onDragLeave={handleSpringLoadDragLeave}
			>
				<div className="pinned-tabs">
					<div
						className="tabs"
					>
						{tabs.filter(tab => tab.pinned).map(tab => <Tab
							{ ...tab }
							key={tab.id}
							isBeingDragged={ false }
							onContextMenu={ handleContextMenu}
							onDragEnd={ handleDragEnd }
							onDragStart={ handleDragStart}
							onTabClick={ handleTabClick}
							onTabClose={ handleTabClose}
							onTabMouseDown = { handleTabMouseDown }
							onAudioStatusClick={handleAudioStatusClick}
						/>)}
					</div>
				</div>
				<div
					ref={startArrowRef}
					className="scroll-start-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
				>
					<button
						data-l10n-id="zotero-toolbar-tabs-scroll-backwards"
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
						onDragLeave={handleTabBarDragLeave}
						onDrop={handleTabBarDrop}
						onScroll={updateScrollArrows}
						dir={Zotero.dir}
					>
						{tabs.map(tab => <Tab
							{...tab}
							key={tab.id}
							width={ tab.pinned ? lockedTabsState.get("pinned") : lockedTabsState.get("tab") }
							isBeingDragged={dragging && dragIDRef.current === tab.id}
							onContextMenu={handleContextMenu}
							onDragEnd={handleDragEnd}
							onDragStart={handleDragStart}
							onTabClick={handleTabClick}
							onTabClose={handleTabClose}
							onTabMouseDown={handleTabMouseDown}
							onAudioStatusClick={handleAudioStatusClick}
						/>)}
						<div ref={spacerRef} className="spacer"></div>
					</div>
					<div ref={dropIndicatorRef} className="tab-drop-indicator" hidden/>
				</div>
				<div
					ref={endArrowRef}
					className="scroll-end-arrow"
					style={{ transform: Zotero.rtl ? 'scaleX(-1)' : undefined }}
				>
					<button
						data-l10n-id="zotero-toolbar-tabs-scroll-forwards"
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
	windowID: PropTypes.string.isRequired,
	onTabSelect: PropTypes.func.isRequired,
	onTabClose: PropTypes.func.isRequired,
	onLoad: PropTypes.func.isRequired,
	onTabMove: PropTypes.func.isRequired,
	onTabDropFromWindow: PropTypes.func.isRequired,
	canOpenDrop: PropTypes.func.isRequired,
	onOpenDrop: PropTypes.func.isRequired,
	onDrawDragThumbnail: PropTypes.func.isRequired,
	onTabTearOff: PropTypes.func.isRequired,
	onRefocus: PropTypes.func.isRequired,
	onContextMenu: PropTypes.func.isRequired,
	onToggleAudio: PropTypes.func.isRequired,
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
			title: PropTypes.string.isRequired,
			renderTitle: PropTypes.bool.isRequired,
			audioStatus: PropTypes.shape({
				active: PropTypes.bool.isRequired,
				paused: PropTypes.bool.isRequired,
			}),
		})
	).isRequired
};

export default TabBar;
