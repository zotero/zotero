/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2020 Corporation for Digital Scholarship
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

const noop = () => {};


function getDragTargetOrient(event, target) {
	const elem = target || event.target;
	const {y, height} = elem.getBoundingClientRect();
	const ratio = (event.clientY - y) / height;
	// first 1/6 of the elem	([x-----])
	if (ratio <= 0.166) return -1;
	// 2/6 to 5/6 of the elem	([-xxxx-])
	else if (ratio <= 0.833) return 0;
	// last 5/6 of the elem		([-----x])
	else return 1;
}

function createDragHandler({ handleDrag, handleDragStop }) {
	function onKeyDown(event) {
		if (event.key == 'Escape') {
			event.stopPropagation();
			onDragStop(event);
		}
	}

	function onDragStart() {
		document.addEventListener('mousemove', handleDrag);
		document.addEventListener('mouseup', onDragStop, { capture: true });
		document.addEventListener('mouseleave', onDragStop);
		window.addEventListener('blur', onDragStop);

		// Register on first child because global bindings are bound
		// on document and we need to stop the propagation in
		// case we handle it here!
		document.children[0].addEventListener('keydown', onKeyDown);
	}

	function onDragStop(event) {
		document.removeEventListener('mousemove', handleDrag);
		document.removeEventListener('mouseup', onDragStop, { capture: true });
		document.removeEventListener('mouseleave', onDragStop);
		window.removeEventListener('blur', onDragStop);
		document.children[0].removeEventListener('keydown', onKeyDown);

		handleDragStop(event, !event || event.type !== 'mouseup');
	}

	return {
		start: onDragStart,
		stop: onDragStop
	};
}

var _htmlID = 1;

const nextHTMLID = (prefix = 'id-') => prefix + _htmlID++;

const scrollIntoViewIfNeeded = (element, container, opts = {}) => {
	const containerTop = container.scrollTop;
	const containerBottom = containerTop + container.clientHeight;
	const elementTop = element.offsetTop;
	const elementBottom = elementTop + element.clientHeight;

	if (elementTop < containerTop || elementBottom > containerBottom) {
		const before = container.scrollTop;
		element.scrollIntoView(opts);
		const after = container.scrollTop;
		return after - before;
	}
	return 0;
};

const stopPropagation = ev => ev.stopPropagation();

export {
	nextHTMLID, noop, getDragTargetOrient, createDragHandler, scrollIntoViewIfNeeded, stopPropagation
};
