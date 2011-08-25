/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2011 Center for History and New Media
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
    
    The Original Code is the Extension Manager UI.
    
    The Initial Developer of the Original Code is the Mozilla Foundation.
    Portions created by the Initial Developer are Copyright (C) 2010
    the Initial Developer. All Rights Reserved.
    
    Contributor(s):
      Blair McBride <bmcbride@mozilla.com>
      Simon Kornblith <simon@zotero.org</a>
    
    ***** END LICENSE BLOCK *****
*/

gDiscoverView.onLocationChange = function(aWebProgress, aRequest, aLocation) {
	// Ignore the about:blank load
	if (aLocation.spec == "about:blank")
		return;

	// When using the real session history the inner-frame will update the
	// session history automatically, if using the fake history though it must
	// be manually updated
	if (gHistory == FakeHistory) {
		var docshell = aWebProgress.QueryInterface(Ci.nsIDocShell);

		var state = {
			view: "addons://discover/",
			url: aLocation.spec
		};

		var replaceHistory = Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY << 16;
		if (docshell.loadType & replaceHistory)
			gHistory.replaceState(state);
		else
			gHistory.pushState(state);
		gViewController.lastHistoryIndex = gHistory.index;
	}

	gViewController.updateCommands();
	
	// In Zotero, we override the behavior below to allow pages on other sites
	
	/*// If the hostname is the same as the new location's host and either the
	// default scheme is insecure or the new location is secure then continue
	// with the load
	if (aLocation.host == this.homepageURL.host &&
			(!this.homepageURL.schemeIs("https") || aLocation.schemeIs("https")))
		return;

	// Canceling the request will send an error to onStateChange which will show
	// the error page
	aRequest.cancel(Components.results.NS_BINDING_ABORTED);*/
};

gDiscoverView.onStateChange = function(aWebProgress, aRequest, aStateFlags, aStatus) {
	// Only care about the network events
	if (!(aStateFlags & (Ci.nsIWebProgressListener.STATE_IS_NETWORK)))
		return;

	// If this is the start of network activity then show the loading page
	if (aStateFlags & (Ci.nsIWebProgressListener.STATE_START))
		this.node.selectedPanel = this._loading;

	// Ignore anything except stop events
	if (!(aStateFlags & (Ci.nsIWebProgressListener.STATE_STOP)))
		return;

	// Consider the successful load of about:blank as still loading
	if (aRequest instanceof Ci.nsIChannel && aRequest.URI.spec == "about:blank")
		return;

	// If there was an error loading the page or the new hostname is not the
	// same as the default hostname or the default scheme is secure and the new
	// scheme is insecure then show the error page
	if (aRequest && aRequest instanceof Ci.nsIHttpChannel && !aRequest.requestSucceeded) {
		this.showError();
	} else {
		// Got a successful load, make sure the browser is visible
		this.node.selectedPanel = this._browser;
		gViewController.updateCommands();
	}

	var listeners = this._loadListeners;
	this._loadListeners = [];

	listeners.forEach(function(aListener) {
		aListener();
	});
};

// Don't care about http/https
gDiscoverView.onSecurityChange = function() {};