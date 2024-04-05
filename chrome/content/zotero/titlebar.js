/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2024 Center for History and New Media
						  George Mason University, Fairfax, Virginia, USA
						  http://zotero.org
	
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


(() => {
let platforms = document.querySelector("window")?.getAttribute("drawintitlebar-platforms");
if (platforms) {
	if (Zotero.isMac && !platforms.includes("mac")) return;
	else if (Zotero.isWin && !platforms.includes("win")) return;
	else if (Zotero.isLinux && !platforms.includes("linux")) return;
}

// Set attributes that affect window chrome sizing immediately, to avoid shrinking when
// AppWindow::LoadPersistentWindowState() restores width/height
// https://searchfox.org/mozilla-central/rev/10f46c9c638e0e5935ed9fa12aadc9d0d4e71ade/xpfe/appshell/AppWindow.cpp#2582-2584

// Create tab bar by default
document.documentElement.setAttribute('drawintitlebar', true);
document.documentElement.setAttribute('tabsintitlebar', true);
if (Zotero.isMac) {
	document.documentElement.setAttribute('chromemargin', '0,-1,-1,-1');
}
else {
	document.documentElement.setAttribute('chromemargin', '0,2,2,2');
}

window.addEventListener("load", function () {
	// Fix window without menubar/titlebar when Zotero is closed in full-screen mode in OS X 10.11+
	if (Zotero.isMac && window.document.documentElement.getAttribute('sizemode') == 'fullscreen') {
		window.document.documentElement.setAttribute('sizemode', 'normal');
	}

	if (Zotero.isWin && !document.querySelector("window")?.hasAttribute("no-titlebar-icon")) {
		let windowIcon = document.querySelector(".titlebar-icon");
		// Simulate Windows window control
		windowIcon.addEventListener("dblclick", (ev) => {
			if (ev.button !== 0) {
				return;
			}
			window.close();
		});
		const DBLCLICK_INTERVAL = 300;
		let leftClicked = false;
		let simulatingClick = false;
		windowIcon.addEventListener("click", (ev) => {
			// If already/about to open, do nothing.
			if (simulatingClick || leftClicked) {
				return;
			}
			// Left-click: open at icon
			if (ev.button === 0) {
				leftClicked = true;
				// Reset leftClicked flag to allow open again
				const onWindowClick = () => {
					leftClicked = false;
					window.removeEventListener("click", onWindowClick);
				};
				// Delay to allow dblclick happen
				setTimeout(() => {
					// Clicking inside image (36*36)
					openWindowMenu(2, 35, () => {
						setTimeout(() => window.addEventListener("click", onWindowClick), 0);
					});
				}, DBLCLICK_INTERVAL);
				return;
			}

			// Right-click: open at cursor
			if (ev.button === 2) {
				openWindowMenu();
			}

			/**
			 * What we do here:
			 * We want to open the window menu when clicking the window icon.
			 * Why we do this way:
			 * The window menu is a native menu, which is not accessible from JS.
			 * Firefox didn't expose this to the JS level (they do at a C++ level),
			 * which forces us to simulate a native right-click on a `-moz-window-drag: drag` element.
			 * How we do this:
			 * 1. temporarily change the -moz-window-drag of the icon after clicking,
			 * 2. simulate a native right-click (which triggers the window menu),
			 * 3. change the -moz-window-drag back to no-drag.
			 * The function is to open window menu. If X or Y not given, use click position.
			 */
			function openWindowMenu(clientX = undefined, clientY = undefined, callback = undefined) {
				simulatingClick = true;
				windowIcon.style["-moz-window-dragging"] = "drag";

				const resolution = windowUtils.getResolution();
				const scaleValue = window.devicePixelRatio;
				const getX = (inputX) => {
					let winInnerOffsetX
						= window.top.mozInnerScreenX
							+ (window.mozInnerScreenX - window.top.mozInnerScreenX) * resolution;
					return (
						(inputX * resolution + winInnerOffsetX) * scaleValue
					);
				};
				const getY = (inputY) => {
					let winInnerOffsetY
						= window.top.mozInnerScreenY
							+ (window.mozInnerScreenY - window.top.mozInnerScreenY) * resolution;
					return (
						(inputY * resolution + winInnerOffsetY) * scaleValue
					);
				};

				const x = getX(clientX ?? ev.x);
				const y = getY(clientY ?? ev.y);

				// Following implementation from https://searchfox.org/mozilla-central/rev/ffdc4971dc18e1141cb2a90c2b0b776365650270/testing/mochitest/tests/SimpleTest/EventUtils.js#1323
				windowUtils.sendNativeMouseEvent(
					x,
					y,
					windowUtils.NATIVE_MOUSE_MESSAGE_BUTTON_DOWN,
					2, // button
					0, // modifierFlags
					windowIcon,
					function () {
						windowUtils.sendNativeMouseEvent(
							x,
							y,
							windowUtils.NATIVE_MOUSE_MESSAGE_BUTTON_UP,
							2, // button
							0, // modifierFlags
							windowIcon,
							{
								observe: (_subject, topic, _data) => {
									if (topic == "mouseevent") {
										if (typeof clientX !== "undefined" || typeof clientY !== "undefined") {
											// Move mouse back if the click position is given
											windowUtils.sendNativeMouseEvent(
												getX(ev.x),
												getY(ev.y),
												windowUtils.NATIVE_MOUSE_MESSAGE_MOVE,
												0, // button
												0, // modifierFlags
												windowIcon
											);
										}
										windowIcon.style["-moz-window-dragging"] = "no-drag";
										callback && callback();
										simulatingClick = false;
									}
								},
							},
						);
					}
				);
			}
		});
	}
}, { once: true });
})();
