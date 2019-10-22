/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
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


Zotero.ProgressWindowSet = new function() {
	this.add = add;
	this.tile = tile;
	this.remove = remove;
	
	var _progressWindows = [];
	
	const X_OFFSET = 25;
	const Y_OFFSET = 35;
	const Y_SEPARATOR = 12;
	const X_WINDOWLESS_OFFSET = 50;
	const Y_WINDOWLESS_OFFSET = 100;
	
	function add(progressWindow, instance) {
		_progressWindows.push({
			progressWindow: progressWindow,
			instance: instance
		});
	}
	
	
	function tile(progressWin) {
		var parent = progressWin.opener;
		var y_sub = null;
		
		for (var i=0; i<_progressWindows.length; i++) {
			var p = _progressWindows[i].progressWindow;
			
			// Skip progress windows from other windows
			if (p.opener != parent) {
				continue;
			}
			
			if (!y_sub) {
				y_sub = Y_OFFSET + p.outerHeight;
			}
			
			if (parent) {
				var right = parent.screenX + parent.outerWidth;
				var bottom = parent.screenY + parent.outerHeight;
			}
			else {
				var right = progressWin.screen.width + X_OFFSET - X_WINDOWLESS_OFFSET;
				var bottom = progressWin.screen.height + Y_OFFSET - Y_WINDOWLESS_OFFSET;
			}
			
			p.moveTo(right - p.outerWidth - X_OFFSET, bottom - y_sub);
			
			y_sub += p.outerHeight + Y_SEPARATOR;
		}
	}
	
	
	function remove(progressWin) {
		for (var i=0; i<_progressWindows.length; i++) {
			if (_progressWindows[i].progressWindow == progressWin) {
				_progressWindows.splice(i, 1);
			}
		}
	}
	
	
	this.closeAll = function () {
		_progressWindows.forEach(pw => pw.instance.close());
	}
}


/*
 * Handles the display of a div showing progress in scraping, indexing, etc.
 *
 * Pass the active window into the constructor
 */
Zotero.ProgressWindow = function(options = {}) {
	var _window = options.window || null;
	var _closeOnClick = typeof options.closeOnClick == 'undefined' ? true : options.closeOnClick;
	var self = this,
		_progressWindow = null,
		_windowLoaded = false,
		_windowLoading = false,
		_timeoutID = false,
		_closing = false,
		_mouseWasOver = false,
		_deferredUntilWindowLoad = [],
		_deferredUntilWindowLoadThis = [],
		_deferredUntilWindowLoadArgs = [];
	
	/**
	 * Shows the progress window
	 */
	this.show = function show() {
		if(_windowLoading || _windowLoaded) {	// already loading or loaded
			return false;
		}
		
		var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].
					getService(Components.interfaces.nsIWindowWatcher);
		
		if (!_window){
			_window = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				.getService(Components.interfaces.nsIWindowMediator)
				.getMostRecentWindow("navigator:browser");
		}
		
		if (_window) {
			_progressWindow = _window.openDialog("chrome://zotero/content/progressWindow.xul",
				"", "chrome,dialog=no,titlebar=no,popup=yes");
		}
		else {
			_progressWindow = ww.openWindow(null, "chrome://zotero/content/progressWindow.xul",
				"", "chrome,dialog=no,titlebar=no,popup=yes", null);
		}
		_progressWindow.addEventListener("load", _onWindowLoaded, false);
		_progressWindow.addEventListener("mouseover", _onMouseOver, false);
		_progressWindow.addEventListener("mouseout", _onMouseOut, false);
		_progressWindow.addEventListener("mouseup", _onMouseUp, false);
		_window.addEventListener('close', () => {
			this.close();
		});
		
		_windowLoading = true;
		
		Zotero.ProgressWindowSet.add(_progressWindow, this);
		
		return true;
	}
	
	/**
	 * Changes the "headline" shown at the top of the progress window
	 */
	this.changeHeadline = _deferUntilWindowLoad(function changeHeadline(text, icon, postText) {
		var doc = _progressWindow.document,
			headline = doc.getElementById("zotero-progress-text-headline");
		while(headline.hasChildNodes()) headline.removeChild(headline.firstChild);
		
		var preNode = doc.createElement("label");
		preNode.setAttribute("value", text);
		preNode.setAttribute("crop", "end");
		headline.appendChild(preNode);
		
		if(icon) {
			var img = doc.createElement("image");
			img.width = 16;
			img.height = 16;
			img.setAttribute("src", icon);
			headline.appendChild(img);
		}
		
		if(postText) {
			var postNode = doc.createElement("label");
			postNode.style.marginLeft = 0;
			postNode.setAttribute("value", " "+postText);
			postNode.setAttribute("crop", "end");
			postNode.setAttribute("flex", "1");
			headline.appendChild(postNode);
		}
	});
	
	/**
	 * Adds a line to the progress window with the specified icon
	 */
	this.addLines = _deferUntilWindowLoad(function addLines(labels, icons) {
		if(typeof labels === "object" && typeof icons === "object") {
			for (var i in labels) {
				let progress = new this.ItemProgress(icons[i], labels[i]);
				progress.setProgress(100);
			}
		} else {
			let progress = new this.ItemProgress(icons, labels);
			progress.setProgress(100);
		}
		
		_move();
	});
	
	/**
	 * Add a description to the progress window
	 *
	 * <a> elements are turned into XUL links
	 */
	this.addDescription = _deferUntilWindowLoad(function addDescription(text) {
		var newHB = _progressWindow.document.createElement("hbox");
		newHB.setAttribute("class", "zotero-progress-item-hbox");
		var newDescription = _progressWindow.document.createElement("description");
		
		var parts = Zotero.Utilities.parseMarkup(text);
		for (let part of parts) {
			if (part.type == 'text') {
				var elem = _progressWindow.document.createTextNode(part.text);
			}
			else if (part.type == 'link') {
				var elem = _progressWindow.document.createElement('label');
				elem.setAttribute('value', part.text);
				elem.setAttribute('class', 'zotero-text-link');
				for (var i in part.attributes) {
					elem.setAttribute(i, part.attributes[i]);
				}
			}
			
			newDescription.appendChild(elem);
		}
		
		newHB.appendChild(newDescription);
		_progressWindow.document.getElementById("zotero-progress-text-box").appendChild(newHB);
		
		_move();
	});
	
	/**
	 * Sets a timer to close the progress window. If a previous close timer was set,
	 * clears it.
	 * @param {Integer} ms The number of milliseconds to wait before closing the progress
	 *     window.
	 * @param {Boolean} [requireMouseOver] If true, wait until the mouse has touched the
	 *     window before closing.
	 */
	this.startCloseTimer = function startCloseTimer(ms, requireMouseOver) {
		if (_windowLoaded || _windowLoading) {
			if (requireMouseOver && !_mouseWasOver) {
				return;
			}
			
			if (_timeoutID) {
				_disableTimeout();
			}
			
			if (typeof ms != 'number') {
				ms = 2500;
			}
			
			_timeoutID = _progressWindow.setTimeout(_timeout, ms);
			_closing = true;
		}
	}
	
	/**
	 * Immediately closes the progress window if it is open.
	 */
	this.close = function close() {
		_disableTimeout();
		_windowLoaded = false;
		_windowLoading = false;
		Zotero.ProgressWindowSet.remove(_progressWindow);
		
		try {
			_progressWindow.close();
		}
		catch (e) {
			Zotero.logError(e);
		}
	}
	
	/**
	 * Creates a new object representing a line in the progressWindow. This is the OO
	 * version of addLines() above.
	 */
	this.ItemProgress = _deferUntilWindowLoad(function(iconSrc, text, parentItemProgress) {
		this.setText(text);
		
		this._image = _progressWindow.document.createElement("hbox");
		this._image.setAttribute("class", "zotero-progress-item-icon");
		this._image.setAttribute("flex", 0);
		this._image.style.width = "16px";
		this._image.style.backgroundRepeat = "no-repeat";
		this._image.style.backgroundSize = "auto 16px";
		this.setIcon(iconSrc);
		
		this._hbox = _progressWindow.document.createElement("hbox");
		this._hbox.setAttribute("class", "zotero-progress-item-hbox");
		if(parentItemProgress) {
			this._hbox.style.marginLeft = "16px";
			this._hbox.zoteroIsChildItem;
		} else {
			this._hbox.setAttribute("parent", "true");
		}
		this._hbox.style.opacity = "0.5";
		
		this._hbox.appendChild(this._image);
		this._hbox.appendChild(this._itemText);
		
		var container = _progressWindow.document.getElementById("zotero-progress-text-box");
		if(parentItemProgress) {
			var nextItem = parentItemProgress._hbox.nextSibling;
			while(nextItem && nextItem.zoteroIsChildItem) {
				nextItem = nextItem.nextSibling;
			}
			container.insertBefore(this._hbox, nextItem);
		} else {
			container.appendChild(this._hbox);
		}
		
		_move();
	});
	
	/**
	 * Sets the current save progress for this item.
	 * @param {Integer} percent A percentage from 0 to 100.
	 */
	this.ItemProgress.prototype.setProgress = _deferUntilWindowLoad(function(percent) {
		if(percent != 0 && percent != 100) {
			// Indication of partial progress, so we will use the circular indicator
			var nArcs = 20;			
			this._image.style.backgroundImage = "url('chrome://zotero/skin/progress_arcs.png')";
			this._image.style.backgroundPosition = "-"+(Math.round(percent/100*nArcs)*16)+"px 0";
			this._hbox.style.opacity = percent/200+.5;
		} else if(percent == 100) {
			this._image.style.backgroundImage = "url('"+this._iconSrc+"')";
			this._image.style.backgroundPosition = "";
			this._hbox.style.opacity = "1";
			this._hbox.style.filter = "";
		}
	});
	
	/**
	 * Sets the icon for this item.
	 * @param {String} iconSrc
	 */
	this.ItemProgress.prototype.setIcon = _deferUntilWindowLoad(function(iconSrc) {
		this._image.style.backgroundImage = "url('"+iconSrc+"')";
		this._image.style.backgroundPosition = "";
		this._iconSrc = iconSrc;
	});
	
	this.ItemProgress.prototype.setText = _deferUntilWindowLoad(function (text) {
		if (!this._itemText) {
			this._itemText = _progressWindow.document.createElement("description");
		}
		else {
			this._itemText.textContent = '';
		}
		this._itemText.appendChild(_progressWindow.document.createTextNode(text));
		this._itemText.setAttribute("class", "zotero-progress-item-label");
		this._itemText.setAttribute("crop", "end");
	});
	
	/**
	 * Indicates that an error occurred saving this item.
	 */
	this.ItemProgress.prototype.setError = _deferUntilWindowLoad(function() {
		this._image.style.backgroundImage = "url('chrome://zotero/skin/cross.png')";
		this._image.style.backgroundPosition = "";
		this._itemText.style.color = "red";
		this._hbox.style.opacity = "1";
		this._hbox.style.filter = "";
	});
	
	this.Translation = {};
	
	this.Translation.operationInProgress = function() {
		var desc = [
			Zotero.getString('general.operationInProgress'),
			Zotero.getString('general.operationInProgress.waitUntilFinishedAndTryAgain')
		].join(' ');
		self.Translation._scrapeError(desc);
	};
	
	this.Translation.cannotEditCollection = function() {
		var desc = Zotero.getString('save.error.cannotMakeChangesToCollection');
		self.Translation._scrapeError(desc);
	};
	
	this.Translation.cannotAddToPublications = function () {
		var desc = Zotero.getString('save.error.cannotAddToMyPublications');
		self.Translation._scrapeError(desc);
	};
	
	this.Translation.cannotAddToFeed = function() {
		var desc = Zotero.getString('save.error.cannotAddToFeed');
		self.Translation._scrapeError(desc);
	};
	
	this.Translation.scrapingTo = function(libraryID, collection) {
		var name;
		if(collection) {
			name = collection.name;
		} else if(libraryID) {
			name = Zotero.Libraries.getName(libraryID);
		} else {
			name = Zotero.getString("pane.collections.library");
		}
		
		self.changeHeadline(Zotero.getString("ingester.scrapingTo"),
			"chrome://zotero/skin/treesource-"+(collection ? "collection" : "library")+".png",
			name+"\u2026");
	};
	
	this.Translation.doneHandler = function(obj, returnValue) {		
		if(!returnValue) {
			// Include link to translator troubleshooting page
			var url = "https://www.zotero.org/support/troubleshooting_translator_issues";
			var linkText = '<a href="' + url + '" tooltiptext="' + url + '">'
				+ Zotero.getString('ingester.scrapeErrorDescription.linkText') + '</a>';
			var desc = Zotero.getString("ingester.scrapeErrorDescription", linkText)
			self.Translation._scrapeError(desc);
		} else {
			self.startCloseTimer();
		}
	};
	
	this.Translation.itemDoneHandler = function(_attachmentsMap) {
		_attachmentsMap = _attachmentsMap || new WeakMap();
		return function(obj, dbItem, item) {
			self.show();
			var itemProgress = new self.ItemProgress(Zotero.ItemTypes.getImageSrc(item.itemType),
				item.title);
			itemProgress.setProgress(100);
			for(var i=0; i<item.attachments.length; i++) {
				var attachment = item.attachments[i];
				_attachmentsMap.set(attachment,
					new self.ItemProgress(
						Zotero.Utilities.determineAttachmentIcon(attachment),
						attachment.title, itemProgress));
			}
		}
	};
	
	this.Translation.attachmentProgressHandler = function(_attachmentsMap) {
		_attachmentsMap = _attachmentsMap || new WeakMap();
		return function(obj, attachment, progress, error) {
			var itemProgress = _attachmentsMap.get(attachment);
			if(progress === false) {
				itemProgress.setError();
			} else {
				itemProgress.setProgress(progress);
				if(progress === 100) {
					itemProgress.setIcon(Zotero.Utilities.determineAttachmentIcon(attachment));
				}
			}
		}
	};
	
	this.Translation._scrapeError = function(description) {
		self.changeHeadline(Zotero.getString("ingester.scrapeError"));
		self.addDescription(description);
		self.show();
		self.startCloseTimer(8000)	
	}
	
	function _onWindowLoaded() {
		_windowLoading = false;
		_windowLoaded = true;
		
		_move();
		
		// do things we delayed because the window was loading
		for(var i=0; i<_deferredUntilWindowLoad.length; i++) {
			_deferredUntilWindowLoad[i].apply(_deferredUntilWindowLoadThis[i],
				_deferredUntilWindowLoadArgs[i]);
		}
		_deferredUntilWindowLoad = [];
		_deferredUntilWindowLoadThis = [];
		_deferredUntilWindowLoadArgs = [];
	}
	
	function _move() {
		// sizeToContent() fails in FF3 with multiple lines
		// if we don't change the height
		_progressWindow.outerHeight = _progressWindow.outerHeight + 1;
		_progressWindow.sizeToContent();
		Zotero.ProgressWindowSet.tile(_progressWindow);
	}
	
	function _timeout() {
		self.close();	// could check to see if we're really supposed to close yet
						// (in case multiple scrapers are operating at once)
		_timeoutID = false;
	}
	
	function _disableTimeout() {
		// FIXME: to prevent errors from translator saving (Create New Item appears to still work)
		// This shouldn't be necessary, and mouseover isn't properly
		// causing the popup to remain
		try {
			_progressWindow.clearTimeout(_timeoutID);
		}
		catch (e) {}
		_timeoutID = false;
	}
	
	/*
	 * Disable the close timer when the mouse is over the window
	 */
	function _onMouseOver(e) {
		_mouseWasOver = true;
		_disableTimeout();
	}
	
	/**
	 * Start the close timer when the mouse leaves the window
	 *
	 * Note that this onmouseout doesn't work correctly on popups in Fx2,
	 * so 1) we have to calculate the window borders manually to avoid fading
	 * when the mouse is still over the box, and 2) this only does anything
	 * when the mouse is moved off of the browser window -- otherwise the close
	 * is triggered by onmousemove on appcontent in overlay.xul.
	 */
	function _onMouseOut(e) {
		// |this| refers to progressWindow's XUL window
		var top = this.screenY + (Zotero.isMac ? 22 : 0);
		if ((e.screenX >= this.screenX && e.screenX <= (this.screenX + this.outerWidth))
			&& (e.screenY >= top) && e.screenY <= (top + this.outerHeight)) {
				return;
		}
		if(_closing) self.startCloseTimer();
	}
	
	function _onMouseUp(e) {
		if (_closeOnClick) {
			self.close();
		}
	}
	
	/**
	 * Wraps a function to ensure it isn't called until the window is loaded
	 */
	function _deferUntilWindowLoad(fn) {
		return function() {
			if(_window && _window.closed) return;
			
			if(_windowLoaded) {
				fn.apply(this, Array.prototype.slice.call(arguments));
			} else {
				_deferredUntilWindowLoad.push(fn);
				_deferredUntilWindowLoadThis.push(this);
				_deferredUntilWindowLoadArgs.push(Array.prototype.slice.call(arguments));
			}
		}
	}
}
