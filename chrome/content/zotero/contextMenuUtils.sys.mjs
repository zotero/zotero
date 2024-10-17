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
	// In theory, we could find the caret position using some privileged-code
	// magic:
	//
	//   let x = {}, y = {}, w = {}, h = {};
	//   Cc["@mozilla.org/accessibilityService;1"].getService(Ci.nsIAccessibilityService)
	//   	.getAccessibleFor(targetElement)
	//   	.QueryInterface(Ci.nsIAccessibleText)
	//   	.getCaretRect(x, y, w, h);
	//
	// But this returns hardware screen units, doesn't work for selections, and
	// doesn't *precisely* correspond to the position of the caret on screen
	// without adjustments.
	// Consider revisiting if the manual method gets too weighed down by edge cases.
	
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
		
		// Easy case: We have a range with rects, so use its bounding rect
		if (range.getClientRects().length) {
			rect = range.getBoundingClientRect();
			
			// ...Except an empty <input>'s text node will be anchored
			// to the bottom with height 0, so move the rect to the top
			if (rect.height === 0
					&& range.collapsed
					&& range.startContainer.isNativeAnonymous
					&& range.startContainer.parentElement?.getClientRects().length) {
				// We know we have a mutable DOMRect here, so we can
				// mutate without cloning
				rect.y = range.startContainer.parentElement.getBoundingClientRect().y;
				
				anchorToBottom = false;
				anchorToEnd = true;
			}
		}
		// If the caret is between lines in an editor, it'll be inside the
		// editor's native anonymous text node and won't have any rects for
		// some reason.
		// If that's the case, use the text node's bounds.
		else if (range.collapsed && range.startContainer.isNativeAnonymous
				&& range.startContainer.firstChild?.nodeType === Node.TEXT_NODE) {
			let quads = range.startContainer.firstChild.getBoxQuads();
			rect = quads[quads.length - 1].getBounds();
		}
		// In a contenteditable (ProseMirror), when the selection is in an
		// empty block or at the end of a block, it won't be within a text node
		// and won't have any rects. Place at the end of the previous node.
		else if (range.startContainer === range.endContainer
				&& range.startOffset === range.endOffset
				&& range.startOffset < range.startContainer.childNodes.length) {
			range = range.cloneRange();
			range.selectNode(range.startContainer.childNodes[range.startOffset]);
			rect = range.getBoundingClientRect();
			
			anchorToBottom = false;
			anchorToEnd = true;
		}
		else {
			rect = range.commonAncestorContainer.getBoundingClientRect();
		}
		
		anchorToBottom ??= !range.collapsed;
		anchorToEnd ??= range.collapsed;
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
