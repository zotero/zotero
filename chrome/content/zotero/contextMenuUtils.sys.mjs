const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

/**
 * @param {Document} doc
 * @returns {Element | null}
 */
export function getTargetElement(doc) {
	let targetElement = doc.activeElement;
	if (targetElement && targetElement.hasAttribute('aria-activedescendant')) {
		let activeDescendant = targetElement.querySelector(
			'#' + CSS.escape(targetElement.getAttribute('aria-activedescendant'))
		);
		if (activeDescendant) {
			targetElement = activeDescendant;
		}
	}
	return targetElement;
}

/**
 * @param {Element} targetElement
 * @returns {{ clientX: number, clientY: number }}
 */
function getContextMenuPosition(targetElement) {
	let selection;
	if (targetElement.editor?.selection) {
		selection = targetElement.editor.selection;
		if (!selection.rangeCount) {
			selection = null;
		}
	}
	else {
		selection = targetElement.ownerDocument.getSelection();
		if (!selection.rangeCount || !targetElement.contains(selection.getRangeAt(0).startContainer)) {
			selection = null;
		}
	}

	let rect;
	let anchorToBottom;
	let anchorToEnd;
	if (selection) {
		let range = selection.getRangeAt(0);
		if (range.getClientRects().length) {
			rect = range.getBoundingClientRect();
		}
		// If the selection is between lines in an editor, it'll be
		// inside the editor's native anonymous text node and won't
		// have any rects for some reason.
		// If that's the case, use the text node's bounds.
		else if (range.startContainer === range.endContainer && range.startContainer.isNativeAnonymous
				&& range.startContainer.firstChild?.nodeType === Node.TEXT_NODE) {
			let quads = range.startContainer.firstChild.getBoxQuads();
			rect = quads[quads.length - 1].getBounds();
		}
		else {
			rect = range.commonAncestorContainer.getBoundingClientRect();
		}
		anchorToBottom = !range.collapsed;
		anchorToEnd = range.collapsed;
	}
	else {
		rect = targetElement.getBoundingClientRect();
		anchorToBottom = true;
		anchorToEnd = false;
	}

	let clientX;
	if (Services.locale.isAppLocaleRTL) {
		clientX = rect.x + (anchorToEnd ? 0 : rect.width - 3);
	}
	else {
		clientX = rect.x + (anchorToEnd ? rect.width + 3 : 0);
	}
	let clientY = rect.y + (anchorToBottom ? rect.height + 8 : 5);
	return { clientX, clientY };
}

/**
 * @param {Element} targetElement
 * @returns {MouseEvent}
 */
export function createContextMenuEvent(targetElement) {
	let { clientX, clientY } = getContextMenuPosition(targetElement);
	let win = targetElement.ownerGlobal;
	let screenX = win.mozInnerScreenX + clientX;
	let screenY = win.mozInnerScreenY + clientY;
	// Need to use initNSMouseEvent() to set inputSource, so just construct a
	// minimal instance first
	let event = new win.MouseEvent('contextmenu', {
		// ...Except that doesn't set buttons, only button
		buttons: 2,
	});
	event.initNSMouseEvent(
		'contextmenu',
		/* bubbles */ true,
		/* cancelable */ true,
		/* view */ win,
		/* detail */ undefined,
		screenX,
		screenY,
		clientX,
		clientY,
		/* ctrlKey */ false,
		/* altKey */ false,
		/* shiftKey */ false,
		/* metaKey */ false,
		/* button */ 2,
		/* relatedTarget */ null,
		/* pressure */ undefined,
		win.MouseEvent.MOZ_SOURCE_KEYBOARD,
	);
	return event;
}
