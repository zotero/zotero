/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-env browser */
"use strict";

// Modified by Zotero -- skip dependencies that are included externally
//import React from "react";
const { Component, createFactory, createElement } = require('react');
//import dom from "react-dom-factories";
const dom = require('react-dom-factories');
//import PropTypes from "prop-types";
const PropTypes = require('prop-types');

const { IconTwisty } = require('components/icons');

const AUTO_EXPAND_DEPTH = 0;
const NUMBER_OF_OFFSCREEN_ITEMS = 10;

/**
 * A fast, generic, expandable and collapsible tree component.
 *
 * This tree component is fast: it can handle trees with *many* items. It only
 * renders the subset of those items which are visible in the viewport. It's
 * been battle tested on huge trees in the memory panel. We've optimized tree
 * traversal and rendering, even in the presence of cross-compartment wrappers.
 *
 * This tree component doesn't make any assumptions about the structure of your
 * tree data. Whether children are computed on demand, or stored in an array in
 * the parent's `_children` property, it doesn't matter. We only require the
 * implementation of `getChildren`, `getRoots`, `getParent`, and `isExpanded`
 * functions.
 *
 * This tree component is well tested and reliable. See
 * devtools/client/shared/components/test/mochitest/test_tree_* and its usage in
 * the performance and memory panels.
 *
 * This tree component doesn't make any assumptions about how to render items in
 * the tree. You provide a `renderItem` function, and this component will ensure
 * that only those items whose parents are expanded and which are visible in the
 * viewport are rendered. The `renderItem` function could render the items as a
 * "traditional" tree or as rows in a table or anything else. It doesn't
 * restrict you to only one certain kind of tree.
 *
 * The only requirement is that every item in the tree render as the same
 * height. This is required in order to compute which items are visible in the
 * viewport in constant time.
 *
 * ### Example Usage
 *
 * Suppose we have some tree data where each item has this form:
 *
 *     {
 *       id: Number,
 *       label: String,
 *       parent: Item or null,
 *       children: Array of child items,
 *       expanded: bool,
 *     }
 *
 * Here is how we could render that data with this component:
 *
 *     class MyTree extends Component {
 *       static get propTypes() {
 *         // The root item of the tree, with the form described above.
 *         return {
 *           root: PropTypes.object.isRequired
 *         };
 *       }
 *
 *       render() {
 *         return Tree({
 *           itemHeight: 20, // px
 *
 *           getRoots: () => [this.props.root],
 *
 *           getParent: item => item.parent,
 *           getChildren: item => item.children,
 *           getKey: item => item.id,
 *           isExpanded: item => item.expanded,
 *
 *           renderItem: (item, depth, isFocused, arrow, isExpanded) => {
 *             let className = "my-tree-item";
 *             if (isFocused) {
 *               className += " focused";
 *             }
 *             return dom.div(
 *               {
 *                 className,
 *                 // Apply 10px nesting per expansion depth.
 *                 style: { marginLeft: depth * 10 + "px" }
 *               },
 *               // Here is the expando arrow so users can toggle expansion and
 *               // collapse state.
 *               arrow,
 *               // And here is the label for this item.
 *               dom.span({ className: "my-tree-item-label" }, item.label)
 *             );
 *           },
 *
 *           onExpand: item => dispatchExpandActionToRedux(item),
 *           onCollapse: item => dispatchCollapseActionToRedux(item),
 *         });
 *       }
 *     }
 */
class Tree extends Component {
	static get propTypes() {
		return {
			// Required props

			// A function to get an item's parent, or null if it is a root.
			//
			// Type: getParent(item: Item) -> Maybe<Item>
			//
			// Example:
			//
			//     // The parent of this item is stored in its `parent` property.
			//     getParent: item => item.parent
			getParent: PropTypes.func.isRequired,

			// A function to get an item's children.
			//
			// Type: getChildren(item: Item) -> [Item]
			//
			// Example:
			//
			//     // This item's children are stored in its `children` property.
			//     getChildren: item => item.children
			getChildren: PropTypes.func.isRequired,

			// A function which takes an item and ArrowExpander component instance and
			// returns a component, or text, or anything else that React considers
			// renderable.
			//
			// Type: renderItem(item: Item,
			//                  depth: Number,
			//                  isFocused: Boolean,
			//                  arrow: ReactComponent,
			//                  isExpanded: Boolean) -> ReactRenderable
			//
			// Example:
			//
			//     renderItem: (item, depth, isFocused, arrow, isExpanded) => {
			//       let className = "my-tree-item";
			//       if (isFocused) {
			//         className += " focused";
			//       }
			//       return dom.div(
			//         {
			//           className,
			//           style: { marginLeft: depth * 10 + "px" }
			//         },
			//         arrow,
			//         dom.span({ className: "my-tree-item-label" }, item.label)
			//       );
			//     },
			renderItem: PropTypes.func.isRequired,

			// A function which returns the roots of the tree (forest).
			//
			// Type: getRoots() -> [Item]
			//
			// Example:
			//
			//     // In this case, we only have one top level, root item. You could
			//     // return multiple items if you have many top level items in your
			//     // tree.
			//     getRoots: () => [this.props.rootOfMyTree]
			getRoots: PropTypes.func.isRequired,

			// A function to get a unique key for the given item. This helps speed up
			// React's rendering a *TON*.
			//
			// Type: getKey(item: Item) -> String
			//
			// Example:
			//
			//     getKey: item => `my-tree-item-${item.uniqueId}`
			getKey: PropTypes.func.isRequired,

			// A function to get whether an item is expanded or not. If an item is not
			// expanded, then it must be collapsed.
			//
			// Type: isExpanded(item: Item) -> Boolean
			//
			// Example:
			//
			//     isExpanded: item => item.expanded,
			isExpanded: PropTypes.func.isRequired,

			// The height of an item in the tree including margin and padding, in
			// pixels.
			itemHeight: PropTypes.number.isRequired,

			// Optional props
			
			
			// Added by Zotero

			// Provide a readable label of the item for screen-readers
			getAriaLabel: PropTypes.func,

			isSeparator: PropTypes.func,

			isEditable: PropTypes.func,
			
			onDragLeave: PropTypes.func,
			
			onKeyDown: PropTypes.func,
			
			drop: PropTypes.object,
			
			editing: PropTypes.object,
			
			highlighted: PropTypes.instanceOf(Set),
			

			multipleSelect: PropTypes.bool,

			// End Added by Zotero
			

			// The currently focused item, if any such item exists.
			focused: PropTypes.any,

			// Handle when a new item is focused.
			onFocus: PropTypes.func,

			// Handle when item is activated with a keyboard (using Enter)
			onActivate: PropTypes.func,

			// Indicates if pressing ArrowRight key should only expand expandable node
			// or if the selection should also move to the next node.
			preventNavigationOnArrowRight: PropTypes.bool,

			// The depth to which we should automatically expand new items.
			autoExpandDepth: PropTypes.number,

			// Note: the two properties below are mutually exclusive. Only one of the
			// label properties is necessary.
			// ID of an element whose textual content serves as an accessible label for
			// a tree.
			labelledby: PropTypes.string,
			// Accessibility label for a tree widget.
			label: PropTypes.string,

			// Optional event handlers for when items are expanded or collapsed. Useful
			// for dispatching redux events and updating application state, maybe lazily
			// loading subtrees from a worker, etc.
			//
			// Type:
			//     onExpand(item: Item)
			//     onCollapse(item: Item)
			//
			// Example:
			//
			//     onExpand: item => dispatchExpandActionToRedux(item)
			onExpand: PropTypes.func,
			onCollapse: PropTypes.func,
		};
	}

	static get defaultProps() {
		return {
			autoExpandDepth: AUTO_EXPAND_DEPTH,
			preventNavigationOnArrowRight: true,
		};
	}

	constructor(props) {
		super(props);

		this.state = {
			scroll: 0,
			height: window.innerHeight,
			seen: new Set(),
			mouseDown: false,
			selected: [],
		};

		this._lastFocused = null;
		this.selection = {
			pivot: null,
			selected: new Set()
		}

		this._onExpand = oncePerAnimationFrame(this._onExpand).bind(this);
		this._onCollapse = oncePerAnimationFrame(this._onCollapse).bind(this);
		this._onScroll = oncePerAnimationFrame(this._onScroll).bind(this);
		this._focusPrevNode = oncePerAnimationFrame(this._focusPrevNode).bind(this);
		this._focusNextNode = oncePerAnimationFrame(this._focusNextNode).bind(this);
		this._focusParentNode = oncePerAnimationFrame(this._focusParentNode).bind(this);
		this._focusFirstNode = oncePerAnimationFrame(this._focusFirstNode).bind(this);
		this._focusLastNode = oncePerAnimationFrame(this._focusLastNode).bind(this);
		this._activateNode = oncePerAnimationFrame(this._activateNode).bind(this);

		this._autoExpand = this._autoExpand.bind(this);
		this._preventArrowKeyScrolling = this._preventArrowKeyScrolling.bind(this);
		this._updateHeight = this._updateHeight.bind(this);
		this._onResize = this._onResize.bind(this);
		this._dfs = this._dfs.bind(this);
		this._dfsFromRoots = this._dfsFromRoots.bind(this);
		this._handleMouseDown = this._handleMouseDown.bind(this);
		this._scrollIntoView = this._scrollIntoView.bind(this);
		this._onDragOver = this._onDragOver.bind(this);
		this._onBlur = this._onBlur.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
	}

	componentDidMount() {
		window.addEventListener("resize", this._onResize);
		this._autoExpand();
		this._updateHeight();
	}

	componentWillReceiveProps(nextProps) {
		this._autoExpand();
		this._updateHeight();
	}

	shouldComponentUpdate(nextProps, nextState) {
		const { scroll, height, seen, mouseDown } = this.state;
		const { focused, drop } = this.props;

		return scroll !== nextState.scroll ||
			height !== nextState.height ||
			seen !== nextState.seen ||
			focused !== nextProps.focused ||
			(!mouseDown || drop !== nextProps.drop);
	}

	componentWillUnmount() {
		window.removeEventListener("resize", this._onResize);
	}

	_autoExpand() {
		if (!this.props.autoExpandDepth) {
			return;
		}

		// Automatically expand the first autoExpandDepth levels for new items. Do
		// not use the usual DFS infrastructure because we don't want to ignore
		// collapsed nodes.
		const autoExpand = (item, currentDepth) => {
			if (currentDepth >= this.props.autoExpandDepth ||
				this.state.seen.has(item)) {
				return;
			}

			this.props.onExpand(item);
			this.state.seen.add(item);

			const children = this.props.getChildren(item);
			const length = children.length;
			for (let i = 0; i < length; i++) {
				autoExpand(children[i], currentDepth + 1);
			}
		};

		const roots = this.props.getRoots();
		const length = roots.length;
		for (let i = 0; i < length; i++) {
			autoExpand(roots[i], 0);
		}
	}

	_preventArrowKeyScrolling(e) {
		switch (e.key) {
			case "ArrowUp":
			case "ArrowDown":
			case "ArrowLeft":
			case "ArrowRight":
				e.preventDefault();
				e.stopPropagation();
				if (e.nativeEvent) {
					if (e.nativeEvent.preventDefault) {
						e.nativeEvent.preventDefault();
					}
					if (e.nativeEvent.stopPropagation) {
						e.nativeEvent.stopPropagation();
					}
				}
		}
	}

	/**
	 * Updates the state's height based on clientHeight.
	 */
	_updateHeight() {
		this.setState({ height: this.refs.tree.clientHeight });
	}

	/**
	 * Perform a pre-order depth-first search from item.
	 */
	_dfs(item, maxDepth = Infinity, traversal = [], _depth = 0) {
		traversal.push({ item, depth: _depth });

		if (!this.props.isExpanded(item)) {
			return traversal;
		}

		const nextDepth = _depth + 1;

		if (nextDepth > maxDepth) {
			return traversal;
		}

		const children = this.props.getChildren(item);
		const length = children.length;
		for (let i = 0; i < length; i++) {
			this._dfs(children[i], maxDepth, traversal, nextDepth);
		}

		return traversal;
	}

	/**
	 * Perform a pre-order depth-first search over the whole forest.
	 */
	_dfsFromRoots(maxDepth = Infinity) {
		const traversal = [];

		const roots = this.props.getRoots();
		const length = roots.length;
		for (let i = 0; i < length; i++) {
			this._dfs(roots[i], maxDepth, traversal);
		}

		return traversal;
	}

	/**
	 * Expands current row.
	 *
	 * @param {Object} item
	 * @param {Boolean} expandAllChildren
	 */
	_onExpand(item, expandAllChildren) {
		if (this.props.onExpand) {
			this.props.onExpand(item);

			if (expandAllChildren) {
				const children = this._dfs(item);
				const length = children.length;
				for (let i = 0; i < length; i++) {
					this.props.onExpand(children[i].item);
				}
			}
		}
	}

	/**
	 * Collapses current row.
	 *
	 * @param {Object} item
	 */
	_onCollapse(item) {
		if (this.props.onCollapse) {
			this.props.onCollapse(item);
		}
	}

	/**
	 * Sets the passed in item to be the focused item or add it to selection
	 * and update selection pivot
	 *
	 * @param {Number} index
	 *        The index of the item in a full DFS traversal (ignoring collapsed
	 *        nodes). Ignored if `item` is undefined.
	 *
	 * @param {Object|undefined} item
	 *        The item to be focused, or undefined to focus no item.
	 *
	 * @param {Boolean} selectTo
	 * 		  If true will select from pivot up to index (does not update pivot)
	 *
	 * @param {Boolean} addToSelection
	 * 		  If true will add to selection
	 */
	_handleMouseDown(index, item, selectTo, addToSelection) {
		if (item !== undefined) {
			// Modified by Zotero
			if (this.props.isSeparator && this.props.isSeparator(item)) {
				return;
			}
			this._scrollIntoView(index);
		}

		if (this.props.onFocus) {
			this.props.onFocus(item);
		}

		if (!selectTo || !addToSelection || !this.selection.pivot) {
			this.selection.selected = new Set([item]);
			this.selection.pivot = item;
			return;
		} else if (addToSelection) {
			this.selection.selected.add(item);
			this.selection.pivot = item;
		} else {
			let traversal = this._dfsFromRoots();
			let pivotIdx = traversal.findIndex(({ depth, item }) => item == this.selection.pivot);
			let startIdx = Math.min(index, pivotIdx);
			let endIdx = Math.max(index, pivotIdx);
			this.selection.selected = new Set(traversal.slice(startIdx, endIdx)
				.map(({ depth, item }) => item));
		}
	}

	/**
	 * Added by Zotero
	 *
	 * @param index {Number} index
	 *        The index of the item in a full DFS traversal (ignoring collapsed
	 *        nodes).
	 * @private
	 */
	_scrollIntoView(index) {
		const itemStartPosition = index * this.props.itemHeight;
		const itemEndPosition = (index + 1) * this.props.itemHeight;

		// Note that if the height of the viewport (this.state.height) is less
		// than `this.props.itemHeight`, we could accidentally try and scroll both
		// up and down in a futile attempt to make both the item's start and end
		// positions visible. Instead, give priority to the start of the item by
		// checking its position first, and then using an "else if", rather than
		// a separate "if", for the end position.
		if (this.state.scroll > itemStartPosition) {
			this.refs.tree.scrollTo(0, itemStartPosition);
		} else if ((this.state.scroll + this.state.height) < itemEndPosition) {
			this.refs.tree.scrollTo(0, itemEndPosition - this.state.height);
		}
	}

	/**
	 * Update state height and tree's scrollTop if necessary.
	 */
	_onResize() {
		// When tree size changes without direct user action, scroll top cat get re-set to 0
		// (for example, when tree height changes via CSS rule change). We need to ensure that
		// the tree's scrollTop is in sync with the scroll state.
		if (this.state.scroll !== this.refs.tree.scrollTop) {
			this.refs.tree.scrollTo({ left: 0, top: this.state.scroll });
		}

		this._updateHeight();
	}

	/**
	 * Sets the state to have no focused item.
	 */
	_onBlur() {
		this._handleMouseDown(0, undefined);
	}

	/**
	 * Fired on a scroll within the tree's container, updates
	 * the stored position of the view port to handle virtual view rendering.
	 *
	 * @param {Event} e
	 */
	_onScroll(e) {
		this.setState({
			scroll: Math.max(this.refs.tree.scrollTop, 0),
			height: this.refs.tree.clientHeight,
		});
	}

	/**
	 * Added by Zotero
	 * 
	 * Ensure the tree scrolls when dragging over top and bottom parts of it
	 * 
	 * @param e
	 * @private
	 */
	_onDragOver(e) {
		let tree = this.refs.tree;
		let {y, height} = tree.getBoundingClientRect();
		let yBott = y+height;
		let threshold = 10; //px
		let scrollHeight = this.props.itemHeight * 3;
		if (e.clientY - y <= threshold) {
			// Already at top
			if (tree.scrollTop === 0) return;
			tree.scrollTop = Math.max(tree.scrollTop - scrollHeight, 0);
			this.setState({
				scroll: this.refs.tree.scrollTop,
				height: this.refs.tree.clientHeight,
			});
		}
		else if (yBott - e.clientY <= threshold) {
			// Already at bottom
			if (tree.scrollTop === tree.scrollHeight - tree.clientHeight) return;
			tree.scrollTop = Math.min(
				tree.scrollTop + scrollHeight,
				tree.scrollHeight - tree.clientHeight
			);
			this.setState({
				scroll: this.refs.tree.scrollTop,
				height: this.refs.tree.clientHeight,
			});
		}
	}

	/**
	 * Handles key down events in the tree's container.
	 *
	 * @param {Event} e
	 */
	_onKeyDown(e) {
		if (this.props.focused == null) {
			return;
		}
		
		// Modified by Zotero
		if (this.props.onKeyDown && this.props.onKeyDown(e) === false) return;

		// Allow parent nodes to use navigation arrows with modifiers.
		if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
			return;
		}

		this._preventArrowKeyScrolling(e);

		switch (e.key) {
			case "ArrowUp":
				this._focusPrevNode();
				break;

			case "ArrowDown":
				this._focusNextNode();
				break;

			case "ArrowLeft":
				if (this.props.isExpanded(this.props.focused)
					&& this.props.getChildren(this.props.focused).length) {
					this._onCollapse(this.props.focused);
				} else {
					this._focusParentNode();
				}
				break;

			case "ArrowRight":
				if (this.props.getChildren(this.props.focused).length &&
					!this.props.isExpanded(this.props.focused)) {
					this._onExpand(this.props.focused);
				} else if (!this.props.preventNavigationOnArrowRight) {
					this._focusNextNode();
				}
				break;

			case "Home":
				this._focusFirstNode();
				break;

			case "End":
				this._focusLastNode();
				break;

			case "Enter":
				this._activateNode();
				break;
		}
	}

	_activateNode() {
		if (this.props.onActivate) {
			this.props.onActivate(this.props.focused);
		}
	}

	_focusFirstNode() {
		const traversal = this._dfsFromRoots();
		// Modified by Zotero
		let idx = 0;
		if (this.props.isSeparator) {
			while (this.props.isSeparator(traversal[idx].item)) {
				idx++;
				if (idx >= traversal.length) return;
			}
		}
		this._handleMouseDown(idx, traversal[idx].item);
		// this._focus(0, traversal[0].item);
	}

	_focusLastNode() {
		const traversal = this._dfsFromRoots();
		let lastIndex = traversal.length - 1;
		// Modified by Zotero
		if (this.props.isSeparator) {
			while (this.props.isSeparator(traversal[lastIndex].item)) {
				lastIndex--;
				if (lastIndex < 0) return;
			}
		}
		this._handleMouseDown(lastIndex, traversal[lastIndex].item);
	}

	/**
	 * Sets the previous node relative to the currently focused item, to focused.
	 */
	_focusPrevNode() {
		// Start a depth first search and keep going until we reach the currently
		// focused node. Focus the previous node in the DFS, if it exists. If it
		// doesn't exist, we're at the first node already.

		let prev;
		let prevIndex;

		const traversal = this._dfsFromRoots();
		const length = traversal.length;
		for (let i = 0; i < length; i++) {
			const item = traversal[i].item;
			if (item === this.props.focused) {
				break;
			}
			prev = item;
			prevIndex = i;
		}

		if (prev === undefined) {
			return;
		}
		
		// Modified by Zotero
		if (this.props.isSeparator) {
			while (this.props.isSeparator(prev)) {
				prevIndex--;
				if (prevIndex < 0) return;
				prev = traversal[prevIndex].item;
			}
		}

		this._handleMouseDown(prevIndex, prev);
	}

	/**
	 * Handles the down arrow key which will focus either the next child
	 * or sibling row.
	 */
	_focusNextNode() {
		// Start a depth first search and keep going until we reach the currently
		// focused node. Focus the next node in the DFS, if it exists. If it
		// doesn't exist, we're at the last node already.

		const traversal = this._dfsFromRoots();
		const length = traversal.length;
		let i = 0;

		while (i < length) {
			if (traversal[i].item === this.props.focused) {
				break;
			}
			i++;
		}

		// Modified by Zotero
		if (this.props.isSeparator) {
			while (i+1 < traversal.length && this.props.isSeparator(traversal[i+1].item)) {
				i++;
			}
		}

		if (i + 1 < traversal.length) {
			this._handleMouseDown(i + 1, traversal[i + 1].item);
		}
	}

	/**
	 * Handles the left arrow key, going back up to the current rows'
	 * parent row.
	 */
	_focusParentNode() {
		const parent = this.props.getParent(this.props.focused);
		if (!parent) {
			return;
		}

		const traversal = this._dfsFromRoots();
		const length = traversal.length;
		let parentIndex = 0;
		for (; parentIndex < length; parentIndex++) {
			if (traversal[parentIndex].item === parent) {
				break;
			}
		}

		this._handleMouseDown(parentIndex, parent);
	}

	render() {
		const traversal = this._dfsFromRoots();

		// 'begin' and 'end' are the index of the first (at least partially) visible item
		// and the index after the last (at least partially) visible item, respectively.
		// `NUMBER_OF_OFFSCREEN_ITEMS` is removed from `begin` and added to `end` so that
		// the top and bottom of the page are filled with the `NUMBER_OF_OFFSCREEN_ITEMS`
		// previous and next items respectively, which helps the user to see fewer empty
		// gaps when scrolling quickly.
		let { itemHeight, focused } = this.props;
		if (focused == undefined) {
			focused = this._lastFocused;
		} else {
			this.selection.pivot = focused;
			this.selection.selected = new Set([focused]);
		}
		if (focused) {
			this._lastFocused = focused;
		}
		const { scroll, height } = this.state;
		const begin = Math.max(((scroll / itemHeight) | 0) - NUMBER_OF_OFFSCREEN_ITEMS, 0);
		const end = Math.ceil((scroll + height) / itemHeight) + NUMBER_OF_OFFSCREEN_ITEMS;
		const toRender = traversal.slice(begin, end);
		const topSpacerHeight = begin * itemHeight;
		const bottomSpacerHeight = Math.max(traversal.length - end, 0) * itemHeight;

		const nodes = [
			dom.div({
				key: "top-spacer",
				role: "presentation",
				style: {
					padding: 0,
					margin: 0,
					height: topSpacerHeight + "px",
				},
			}),
		];

		for (let i = 0; i < toRender.length; i++) {
			const index = begin + i;
			const first = index == 0;
			const last = index == traversal.length - 1;
			const { item, depth } = toRender[i];
			const key = this.props.getKey(item);
			nodes.push(TreeNode({
				key,
				index,
				first,
				last,
				item,
				depth,
				id: key,
				renderItem: this.props.renderItem,
				focused: focused === item,
				selected: this.selection.selected.has(item),
				expanded: this.props.isExpanded(item),
				hasChildren: !!this.props.getChildren(item).length,
				onExpand: this._onExpand,
				onCollapse: this._onCollapse,
				onMouseDown: (e) => this._handleMouseDown(begin + i, item, e.shiftKey, e.ctrlKey || e.metaKey),
			}));
		}

		nodes.push(dom.div({
			key: "bottom-spacer",
			role: "presentation",
			style: {
				padding: 0,
				margin: 0,
				height: bottomSpacerHeight + "px",
			},
		}));

		return dom.div(
			{
				className: "tree",
				ref: "tree",
				role: "tree",
				tabIndex: "0",
				onDragOver: this._onDragOver,
				onDragLeave: this.props.onDragLeave,
				onKeyDown: this._onKeyDown,
				onKeyPress: this._preventArrowKeyScrolling,
				onKeyUp: this._preventArrowKeyScrolling,
				onScroll: this._onScroll,
				onMouseDown: () => this.setState({ mouseDown: true }),
				onMouseUp: () => this.setState({ mouseDown: false }),
				onFocus: () => {
					if (focused || this.state.mouseDown) {
						return;
					}

					// Only set default focus to the first tree node if focused node is
					// not yet set and the focus event is not the result of a mouse
					// interarction.
					this._handleMouseDown(begin, toRender[0].item);
				},
				onClick: () => {
					if (!this.props.editing) {
						// Focus should always remain on the tree container itself.
						this.refs.tree.focus();
					}
				},
				"aria-label": this.props.label,
				"aria-labelledby": this.props.labelledby,
				"aria-activedescendant": focused
					&& (this.props.getAriaLabel
					? this.props.getAriaLabel(focused)
					: this.props.getKey(focused)),
				style: {
					padding: 0,
					margin: 0,
				},
			},
			nodes
		);
	}
}

/**
 * An arrow that displays whether its node is expanded (â–¼) or collapsed
 * (â–¶). When its node has no children, it is hidden.
 */
class ArrowExpanderClass extends Component {
	static get propTypes() {
		return {
			item: PropTypes.any.isRequired,
			visible: PropTypes.bool.isRequired,
			expanded: PropTypes.bool.isRequired,
			onCollapse: PropTypes.func.isRequired,
			onExpand: PropTypes.func.isRequired,
		};
	}

	shouldComponentUpdate(nextProps, nextState) {
		return this.props.item !== nextProps.item
			|| this.props.visible !== nextProps.visible
			|| this.props.expanded !== nextProps.expanded;
	}

	render() {
		const attrs = {
			className: "arrow theme-twisty",
			onMouseDown: (e) => {
				// Modified by Zotero
				// Do not focus item on collapse/expand
				this.props.expanded
					? this.props.onCollapse(this.props.item)
					: this.props.onExpand(this.props.item, e.altKey);
				e.stopPropagation();
				e.preventDefault();
			}
		};

		if (this.props.expanded) {
			attrs.className += " open";
		}

		if (!this.props.visible) {
			attrs.style = {
				visibility: "hidden",
			};
		}

		// Modified by Zotero
		//
		// Load the arrow graphic from 'components/icons'
		return dom.span(attrs, createElement(IconTwisty));
	}
}

class TreeNodeClass extends Component {
	static get propTypes() {
		return {
			id: PropTypes.any.isRequired,
			focused: PropTypes.bool.isRequired,
			selected: PropTypes.bool.isRequired,
			item: PropTypes.any.isRequired,
			expanded: PropTypes.bool.isRequired,
			hasChildren: PropTypes.bool.isRequired,
			onExpand: PropTypes.func.isRequired,
			index: PropTypes.number.isRequired,
			first: PropTypes.bool,
			last: PropTypes.bool,
			onMouseDown: PropTypes.func,
			onCollapse: PropTypes.func.isRequired,
			depth: PropTypes.number.isRequired,
			renderItem: PropTypes.func.isRequired,
		};
	}

	render() {
		const arrow = ArrowExpander({
			item: this.props.item,
			expanded: this.props.expanded,
			visible: this.props.hasChildren,
			onExpand: this.props.onExpand,
			onCollapse: this.props.onCollapse,
		});

		const classList = [ "tree-node", "div" ];
		if (this.props.index % 2) {
			classList.push("tree-node-odd");
		}
		if (this.props.first) {
			classList.push("tree-node-first");
		}
		if (this.props.last) {
			classList.push("tree-node-last");
		}

		let ariaExpanded;
		if (this.props.hasChildren) {
			ariaExpanded = false;
		}
		if (this.props.expanded) {
			ariaExpanded = true;
		}
		
		return dom.div(
			{
				id: this.props.id,
				className: classList.join(" "),
				role: "treeitem",
				"aria-level": this.props.depth + 1,
				onMouseDown: this.props.onMouseDown,
				"aria-expanded": ariaExpanded,
				"data-expanded": this.props.expanded ? "" : undefined,
				"data-depth": this.props.depth,
				style: {
					padding: 0,
					margin: 0,
				},
			},

			this.props.renderItem(this.props.item,
				this.props.depth,
				this.props.selected,
				arrow,
				this.props.expanded,
				this.props.focused),
		);
	}
}

const ArrowExpander = createFactory(ArrowExpanderClass);
const TreeNode = createFactory(TreeNodeClass);

/**
 * Create a function that calls the given function `fn` only once per animation
 * frame.
 *
 * @param {Function} fn
 * @returns {Function}
 */
function oncePerAnimationFrame(fn) {
	let animationId = null;
	let argsToPass = null;
	return function(...args) {
		argsToPass = args;
		if (animationId !== null) {
			return;
		}

		// Modified by Zotero
		// We don't currently have requestAnimationFrame in XUL
		let nextAnimationFrame;
		if (typeof requestAnimationFrame == 'undefined') {
			nextAnimationFrame = setTimeout;
		} else {
			nextAnimationFrame = requestAnimationFrame
		}

		animationId = nextAnimationFrame(() => {
			fn.call(this, ...argsToPass);
			animationId = null;
			argsToPass = null;
		});
	};
}

module.exports = Tree;

