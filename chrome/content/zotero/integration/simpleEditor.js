/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2022 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
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
	
	*****************************

	Based on https://github.com/jaredreich/pell/blob/master/src/pell.js,
	which is covered by the following copyright and permission notice:
	The MIT License (MIT)

	Copyright (c) Jared Reich

	Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
	associated documentation files (the "Software"), to deal in the Software without restriction,
	including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
	and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
	subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
	LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
	IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
	WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	 
	***** END LICENSE BLOCK *****
*/

// Simple WYSIWYG editor using contenteditable

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
	
const defaultParagraphSeparatorString = 'defaultParagraphSeparator'
const formatBlock = 'formatBlock'
const queryCommandState = command => document.queryCommandState(command)
const queryCommandValue = command => document.queryCommandValue(command)

const exec = (command, value = null) => document.execCommand(command, false, value)

const availableActions = {
	bold: {
		icon: '<b>B</b>',
		title: 'Bold',
		state: () => queryCommandState('bold'),
		result: () => exec('bold'),
		shortcut: "b"
	},
	italic: {
		icon: '<i>I</i>',
		title: 'Italic',
		state: () => queryCommandState('italic'),
		result: () => exec('italic'),
		shortcut: "i"
	},
	underline: {
		icon: '<u>U</u>',
		title: 'Underline',
		state: () => queryCommandState('underline'),
		result: () => exec('underline'),
		shortcut: "u"
	},
	strikethrough: {
		icon: '<strike>S</strike>',
		title: 'Strike-through',
		state: () => queryCommandState('strikeThrough'),
		result: () => exec('strikeThrough')
	},
	heading1: {
		icon: '<b>H<sub>1</sub></b>',
		title: 'Heading 1',
		result: () => exec(formatBlock, '<h1>')
	},
	heading2: {
		icon: '<b>H<sub>2</sub></b>',
		title: 'Heading 2',
		result: () => exec(formatBlock, '<h2>')
	},
	paragraph: {
		icon: '&#182;',
		title: 'Paragraph',
		result: () => exec(formatBlock, '<p>')
	},
	quote: {
		icon: '&#8220; &#8221;',
		title: 'Quote',
		result: () => exec(formatBlock, '<blockquote>')
	},
	olist: {
		icon: '&#35;',
		title: 'Ordered List',
		result: () => exec('insertOrderedList')
	},
	ulist: {
		icon: '&#8226;',
		title: 'Unordered List',
		result: () => exec('insertUnorderedList')
	},
	code: {
		icon: '&lt;/&gt;',
		title: 'Code',
		result: () => exec(formatBlock, '<pre>')
	},
	line: {
		icon: '&#8213;',
		title: 'Horizontal Line',
		result: () => exec('insertHorizontalRule')
	},
	link: {
		icon: '&#128279;',
		title: 'Link',
		result: () => {
			const url = window.prompt('Enter the link URL')
			if (url) exec('createLink', url)
		}
	},
	image: {
		icon: '&#128247;',
		title: 'Image',
		result: () => {
			const url = window.prompt('Enter the image URL')
			if (url) exec('insertImage', url)
		}
	}
}

let config = {
	actions: ["bold", "italic", "underline"],
	hideActionBar: false,
};

/**
 * Initialize the editor based on configuration passed via iframe attributes
 */
const init = () => {
	let editorElement = document.querySelector('#simple-editor');

	if (window.frameElement?.getAttribute('actions')) {
		config.actions = window.frameElement.getAttribute('actions').split(',');
	}
	if (window.frameElement?.getAttribute('hide-actionbar')) {
		config.hideActionBar = true;
	}

	const actions = config.actions.map(action => availableActions[action]);

	const defaultParagraphSeparator = config[defaultParagraphSeparatorString] || 'div'

	const actionbar = document.createElement('div');
	actionbar.className = "actionbar";
	if (config.hideActionBar) {
		actionbar.classList.add("hidden");
	}
	editorElement.appendChild(actionbar);

	const content = editorElement.content = document.createElement('div');
	content.contentEditable = true
	content.className = "content";
	content.oninput = ({ target: { firstChild } }) => {
		if (firstChild && firstChild.nodeType === 3) exec(formatBlock, `<${defaultParagraphSeparator}>`)
		else if (content.innerHTML === '<br>') content.innerHTML = ''
	}
	content.onkeydown = event => {
		if (event.key === 'Enter' && queryCommandValue(formatBlock) === 'blockquote') {
			setTimeout(() => exec(formatBlock, `<${defaultParagraphSeparator}>`), 0)
		}
		else if (event.metaKey || event.ctrlKey) {
			let shortcutFor = Object.values(availableActions).find(action => action.shortcut === event.key);
			if (shortcutFor) {
				event.preventDefault();
				shortcutFor.result();
			}
		}
	}

	editorElement.appendChild(content);

	actions.forEach(action => {
		const button = document.createElement('button');
		button.className = "button";
		button.innerHTML = action.icon
		button.title = action.title
		button.setAttribute('type', 'button')
		button.onclick = () => action.result() && content.focus()

		if (action.state) {
			const handler = () => {
				let isButtonStateActive = action.state();
				button.classList.toggle("selected", isButtonStateActive);
			};
			content.addEventListener('keyup', handler);
			content.addEventListener('mouseup', handler);
			button.addEventListener('click', handler);
		}

		actionbar.appendChild(button);
	});

	if (config.styleWithCSS) exec('styleWithCSS')
	exec(defaultParagraphSeparatorString, defaultParagraphSeparator)

	return editorElement;
}

var RTFConverter = new function() {
	// Atomic units, HTML -> RTF (cleanup)
	//[/<\/p>(?!\s*$)/g, "\\par{}"],
	//[/ /g, "&nbsp;"],
	//[/\u00A0/g, " "],
	this._htmlRTFmap = [
		[/<br \/>/g, "\x0B"],
		[/<span class=\"tab\">&nbsp;<\/span>/g, "\\tab{}"],
		[/&lsquo;/g, "‘"],
		[/&rsquo;/g, "’"],
		[/&ldquo;/g, "“"],
		[/&rdquo;/g, "”"],
		[/&nbsp;/g, "\u00A0"],
		[/"(\w)/g, "“$1"],
		[/([\w,.?!])"/g, "$1”"],
		[/<p>/g, ""],
		[/<\/?div[^>]*>/g, ""]
	];

	// Atomic units, RTF -> HTML (cleanup)
	this._rtfHTMLmap = [
		[/\\uc0\{?\\u([0-9]+)\}?(?:{}| )?/g, function(wholeStr, aCode) { return String.fromCharCode(aCode) }],
		[/\\tab(?:\{\}| )/g, '<span class="tab">&nbsp;</span>'],
		[/(?:\\par{}|\\\r?\n)/g, "</p><p>"]
	];

	this.prepare = function() {
		// DEBUG: Does this actually happen?
		if (this.prepared) return;

		// Tag data
		var _rexData = [
			[
				[
					["<span +style=\"font-variant: *small-caps;\">"],
					["{\\scaps ", "{\\scaps{}"]
				],
				[
					["<\/span>"],
					["}"]
				]
			],
			[
				[
					["<span +style=\"text-decoration: *underline;\">"],
					["{\\ul{}", "{\\ul "]
				],
				[
					["<\/span>"],
					["}"]
				]
			],
			[
				[
					["<sup>"],
					["\\super ", "\\super{}"]
				],
				[
					["</sup>"],
					["\\nosupersub{}", "\\nosupersub "]
				]
			],
			[
				[
					["<sub>"],
					["\\sub ", "\\sub{}"]
				],
				[
					["</sub>"],
					["\\nosupersub{}", "\\nosupersub "]
				]
			],
			[
				[
					["<em>"],
					["{\\i{}", "{\\i "]
				],
				[
					["</em>"],
					["}"]
				]
			],
			[
				[
					["<i>"],
					["{\\i{}", "{\\i "]
				],
				[
					["</i>"],
					["}"]
				]
			],
			[
				[
					["<b>"],
					["{\\b{}", "{\\b "]
				],
				[
					["</b>"],
					["}"]
				]
			],
			[
				[
					["<strong>"],
					["{\\b{}", "{\\b "]
				],
				[
					["</strong>"],
					["}"]
				]
			],
			[
				[
					["<span +style=\"font-variant: *normal;\">"],
					["{\\scaps0{}", "{\\scaps0 "]
				],
				[
					["</span>"],
					["}"]
				]
			],
			[
				[
					["<span +style=\"font-style: *normal;\">"],
					["{\\i0{}", "{\\i0 "]
				],
				[
					["</span>"],
					["}"]
				]
			],
			[
				[
					["<span +style=\"font-weight: *normal;\">"],
					["{\\b0{}", "{\\b0 "]
				],
				[
					["</span>"],
					["}"]
				]
			]
		];

		function longestFirst(a, b) {
			if (a.length < b.length) {
				return 1;
			} else if (a.length > b.length) {
				return -1;
			} else {
				return 0;
			}
		}

		function normalizeRegExpString(str) {
			if (!str) return str;
			return str.replace(/\s+/g, " ")
				.replace(/(?:[\+]|\s[\*])/g, "")
				.replace(/[\']/g, '\"')
				.replace(/:\s/g, ":");
		}

		this.normalizeRegExpString = normalizeRegExpString;

		function composeRex(rexes, noGlobal) {
			var lst = [];
			for (var rex in rexes) {
				lst.push(rex);
			}
			lst.sort(longestFirst);
			var rexStr = "(?:" + lst.join("|") + ")";
			return new RegExp(rexStr, "g");
		}

		// Create splitting regexps
		function splitRexMaker(segment) {
			var rexes = {};
			for (var i=0,ilen=_rexData.length; i < ilen; i++) {
				for (var j=0,jlen=_rexData[i].length; j < jlen; j++) {
					for (var k=0,klen=_rexData[i][j][segment].length; k < klen; k++) {
						rexes[_rexData[i][j][segment][k].replace("\\", "\\\\")] = true;
					}
				}
			}
			var ret = composeRex(rexes, true);
			return ret;
		}
		this.rtfHTMLsplitRex = splitRexMaker(1);
		this.htmlRTFsplitRex = splitRexMaker(0);

		// Create open-tag sniffing regexp
		function openSniffRexMaker(segment) {
			var rexes = {};
			for (var i=0,ilen=_rexData.length; i < ilen; i++) {
				for (var j=0,jlen=_rexData[i][0][segment].length; j < jlen; j++) {
					rexes[_rexData[i][0][segment][j].replace("\\", "\\\\")] = true;
				}
			}
			return composeRex(rexes);
		}
		this.rtfHTMLopenSniffRex = openSniffRexMaker(1);
		this.htmlRTFopenSniffRex = openSniffRexMaker(0);

		// Create open-tag remapper
		function openTagRemapMaker(segment) {
			var ret = {};
			for (var i=0,ilen=_rexData.length; i < ilen; i++) {
				var primaryVal = normalizeRegExpString(_rexData[i][0][segment][0]);
				for (var j=0,jlen=_rexData[i][0][segment].length; j < jlen; j++) {
					var key = normalizeRegExpString(_rexData[i][0][segment][j]);
					ret[key] = primaryVal;
				}
			}
			return ret;
		}

		this.rtfHTMLopenTagRemap = openTagRemapMaker(1);
		this.htmlRTFopenTagRemap = openTagRemapMaker(0);

		// Create open-tag-keyed close-tag sniffing regexps
		function closeTagRexMaker(segment) {
			var ret = {};
			var rexes = {};
			for (var i=0,ilen=_rexData.length; i < ilen; i++) {
				var primaryVal = _rexData[i][0][segment][0];
				for (var j=0,jlen=_rexData[i][1][segment].length; j < jlen; j++) {
					rexes[_rexData[i][1][segment][j]] = true;
				}
				ret[primaryVal] = composeRex(rexes);
			}
			return ret;
		}
		this.rtfHTMLcloseTagRex = closeTagRexMaker(1);
		this.htmlRTFcloseTagRex = closeTagRexMaker(0);

		// Create open-tag-keyed open/close tag registry
		function tagRegistryMaker(segment) {
			var antisegment = 1;
			if (segment == 1) {
				antisegment = 0;
			}
			var ret = {};
			for (var i=0,ilen=_rexData.length; i < ilen; i++) {
				var primaryVal = normalizeRegExpString(_rexData[i][0][segment][0]);
				ret[primaryVal] = {
					open: normalizeRegExpString(_rexData[i][0][antisegment][0]),
					close: _rexData[i][1][antisegment][0]
				}
			}
			return ret;
		}

		this.rtfHTMLtagRegistry = tagRegistryMaker(1);
		this.htmlRTFtagRegistry = tagRegistryMaker(0);

		this.prepared = true;
	}
	this.prepare();

	this.getSplit = function(mode, txt) {
		if (!txt) return [];
		var splt = txt.split(this[mode + "splitRex"]);
		var mtch = txt.match(this[mode + "splitRex"]);
		var lst = [splt[0]];
		for (var i=1,ilen=splt.length; i < ilen; i++) {
			lst.push(mtch[i-1]);
			lst.push(splt[i]);
		}
		return lst;
	}

	this.getOpenTag = function(mode, str) {
		var m = str.match(this[mode + "openSniffRex"]);
		if (m) {
			m = this[mode + "openTagRemap"][this.normalizeRegExpString(m[0])];
		}
		return m;
	}

	this.convert = function(mode, txt) {
		var lst = this.getSplit(mode, txt);
		var sdepth = 0;
		var depth = 0;
		for (var i=1,ilen=lst.length; i < ilen; i += 2) {
			var openTag = this.getOpenTag(mode, lst[i]);
			if (openTag) {
				sdepth++;
				depth = sdepth;
				for (var j=(i+2),jlen=lst.length; j < jlen; j += 2) {
					var closeTag = !this.getOpenTag(mode, lst[j]);
					if (closeTag) {
						if (depth === sdepth && lst[j].match(this[mode + "closeTagRex"][openTag])) {
							lst[i] = this[mode + "tagRegistry"][openTag].open;
							lst[j] = this[mode + "tagRegistry"][openTag].close;
							break;
						}
						depth--;
					} else {
						depth++;
					}
				}
			} else {
				sdepth--;
			}
		}
		return lst.join("");
	}

	this.htmlToRTF = function(txt) {
		txt = this.convert("htmlRTF", txt);
		for (var i=0,ilen=this._htmlRTFmap.length; i < ilen; i++) {
			var entry = this._htmlRTFmap[i];
			txt = txt.replace(entry[0], entry[1]);
		}
		txt = Zotero.Utilities.unescapeHTML(txt);
		txt = txt.replace(/[\x7F-\uFFFF]/g, function(aChar) { return "\\uc0\\u"+aChar.charCodeAt(0).toString()+"{}"});
		return txt.trim();
	}

	this.rtfToHTML = function(txt) {
		for (var i=0,ilen=this._rtfHTMLmap.length; i < ilen; i++) {
			var entry = this._rtfHTMLmap[i];
			txt = txt.replace(entry[0], entry[1]);
		}
		txt = this.convert("rtfHTML", txt);
		return txt.trim();
	}
}

init();

window.editor = {
	get content() {
		return document.querySelector('.content');
	},
	
	setContent(content, isRTF) {
		if (isRTF) {
			content = RTFConverter.rtfToHTML(content);
		}
		this.content.innerHTML = content;
	},
	
	getContent(asRTF) {
		let content = this.content.innerHTML;
		if (asRTF) {
			return RTFConverter.htmlToRTF(content);
		}
		return content;
	},
	
	setEnabled(enabled) {
		this.content.setAttribute('contenteditable', !!enabled);
	},

	getTotalHeight() {
		return this.content.scrollHeight + document.querySelector(".actionbar").offsetHeight;
	},

	getActionStates() {
		return config.actions.map((actionKey) => {
			let action = availableActions[actionKey];
			return {
				action: actionKey,
				active: action?.state() || false
			};
		});
	},

	setActionStates(actions) {
		for (let { action, active } of actions) {
			let actionObj = availableActions[action];
			if (active !== actionObj.state()) {
				actionObj.result();
			}
		}
	},

	focusContent() {
		this.content.focus();
		// Move cursor to the end of the content
		let range = document.createRange();
		range.selectNodeContents(this.content);
		range.collapse(false);
		let sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}
}
