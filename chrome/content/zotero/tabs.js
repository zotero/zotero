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

"use strict";

// Using 'import' breaks hooks
var React = require('react');
var ReactDOM = require('react-dom');
import TabBar from 'components/tabBar';

var Zotero_Tabs = new function () {
	const HTML_NS = 'http://www.w3.org/1999/xhtml';
	
	Object.defineProperty(this, 'selectedIndex', {
		get: () => this._selectedIndex
	});
	
	Object.defineProperty(this, 'deck', {
		get: () => document.getElementById('tabs-deck')
	});
	
	this._tabBarRef = {};
	this._tabs = [
		{
			title: "",
			type: 'library'
		}
	];
	this._selectedIndex = 0;
	
	this.init = function () {
		ReactDOM.render(
			<TabBar
				ref={this._tabBarRef}
				initialTabs={this._tabs}
				onTabSelected={this._onTabSelected.bind(this)}
				onTabClosed={this._onTabClosed.bind(this)}
			/>,
			document.getElementById('tab-bar-container')
		);
		
	};
	
	
	this.selectLeft = function () {
		this._tabBarRef.current.selectLeft();
	};
	
	
	this.selectRight = function () {
		this._tabBarRef.current.selectRight();
	};
	
	
	this.select = function (index) {
		this._tabBarRef.current.select(index);
	},
	
	
	/**
	 * @return {Element} - The element created in the deck
	 */
	this.add = function ({ title, type, url, index }) {
		this._tabBarRef.current.add({ title, type });
		
		var elem;
		if (url) {
			elem = document.createElement('iframe');
			elem.setAttribute('type', 'content');
			elem.setAttribute('src', url);
		}
		else {
			elem = document.createElementNS(HTML_NS, 'div');
			elem.textContent = title;
		}
		
		var deck = this.deck;
		deck.insertBefore(elem, index === undefined ? null : deck.childNodes[index]);
		
		return elem;
	};
	
	
	this.rename = function (title, index) {
		if (index === undefined) {
			index = this._selectedIndex;
		}
		this._tabs[index].title = title;
		this._tabBarRef.current.rename(title, index);
	};
	
	
	this.close = function (index) {
		if (index === undefined) {
			index = this._selectedIndex;
		}
		this._tabBarRef.current.close(index);
	};
	
	
	this._onTabSelected = function (index) {
		this._selectedIndex = index;
		this.deck.selectedIndex = index;
	};
	
	
	this._onTabClosed = function (index) {
		this._tabs.splice(index, 1);
		var deck = this.deck;
		deck.removeChild(deck.childNodes[index]);
	};
};