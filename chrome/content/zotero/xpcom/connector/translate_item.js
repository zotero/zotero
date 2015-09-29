/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2012 Center for History and New Media
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

Zotero.Translate.ItemSaver = function(libraryID, attachmentMode, forceTagType, document,
		cookieSandbox) {
	this.newItems = [];
	this._timeoutID = null;
	
	if(document) {
		this._uri = document.location.toString();
		this._cookie = document.cookie;
	}
	
	// Add listener for callbacks, but only for Safari or the bookmarklet. In Chrome, we
	// (have to) save attachments from the inject page.
	if(Zotero.Messaging && !Zotero.Translate.ItemSaver._attachmentCallbackListenerAdded
			&& (Zotero.isBookmarklet || Zotero.isSafari)) {
		Zotero.Messaging.addMessageListener("attachmentCallback", function(data) {
			var id = data[0],
				status = data[1];
			 var callback = Zotero.Translate.ItemSaver._attachmentCallbacks[id];
			 if(callback) {
				if(status === false || status === 100) {
					delete Zotero.Translate.ItemSaver._attachmentCallbacks[id];
				} else {
					data[1] = 50+data[1]/2;
				}
				callback(data[1], data[2]);
			 }
		});
		Zotero.Translate.ItemSaver._attachmentCallbackListenerAdded = true;
	}
}
Zotero.Translate.ItemSaver._attachmentCallbackListenerAdded = false;
Zotero.Translate.ItemSaver._attachmentCallbacks = {};

Zotero.Translate.ItemSaver.ATTACHMENT_MODE_IGNORE = 0;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_DOWNLOAD = 1;
Zotero.Translate.ItemSaver.ATTACHMENT_MODE_FILE = 2;

Zotero.Translate.ItemSaver.prototype = {
	/**
	 * Saves items to Standalone or the server
	 * @param items Items in Zotero.Item.toArray() format
	 * @param {Function} callback A callback to be executed when saving is complete. If saving
	 *    succeeded, this callback will be passed true as the first argument and a list of items
	 *    saved as the second. If saving failed, the callback will be passed false as the first
	 *    argument and an error object as the second
	 * @param {Function} [attachmentCallback] A callback that receives information about attachment
	 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
	 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
	 */
	"saveItems":function(items, callback, attachmentCallback) {
		var me = this;
		// first try to save items via connector
		var payload = {"items":items};
		if(this._uri && this._cookie) {
			payload.uri = this._uri;
			payload.cookie = this._cookie;
		}
		Zotero.Connector.setCookiesThenSaveItems(payload, function(data, status) {
			if(data !== false) {
				Zotero.debug("Translate: Save via Standalone succeeded");
				var haveAttachments = false;
				if(data && data.items) {
					for(var i=0; i<data.items.length; i++) {
						var attachments = items[i].attachments = data.items[i].attachments;
						for(var j=0; j<attachments.length; j++) {
							if(attachments[j].id) {
								attachmentCallback(attachments[j], 0);
								haveAttachments = true;
							}
						}
					}
				}
				callback(true, items);
				if(haveAttachments) me._pollForProgress(items, attachmentCallback);
			} else if(Zotero.isFx) {
				callback(false, new Error("Save via Standalone failed with "+status));
			} else {
				me._saveToServer(items, callback, attachmentCallback);
			}
		});
	},
	
	/**
	 * Polls for updates to attachment progress
	 * @param items Items in Zotero.Item.toArray() format
	 * @param {Function} attachmentCallback A callback that receives information about attachment
	 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
	 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
	 *     attachmentCallback() will be called with all attachments that will be saved 
	 */
	"_pollForProgress":function(items, attachmentCallback) {
		var attachments = [];
		var progressIDs = [];
		var previousStatus = [];
		for(var i=0; i<items.length; i++) {
			var itemAttachments = items[i].attachments;
			for(var j=0; j<itemAttachments.length; j++) {
				if(itemAttachments[j].id) {
					attachments.push(itemAttachments[j]);
					progressIDs.push(itemAttachments[j].id);
					previousStatus.push(0);
				}
			}
		}
		
		var nPolls = 0;
		var poll = function() {
			Zotero.Connector.callMethod("attachmentProgress", progressIDs, function(currentStatus, status) {
				if(currentStatus) {
					for(var i=0; i<attachments.length; i++) {
						if(currentStatus[i] === 100 || currentStatus[i] === false) {
							attachmentCallback(attachments[i], currentStatus[i]);
							attachments.splice(i, 1);
							progressIDs.splice(i, 1);
							previousStatus.splice(i, 1);
							currentStatus.splice(i, 1);
							i--;
						} else if(currentStatus[i] !== previousStatus[i]) {
							attachmentCallback(attachments[i], currentStatus[i]);
							previousStatus[i] = currentStatus[i];
						}
					}
					
					if(nPolls++ < 60 && attachments.length) {
						setTimeout(poll, 1000);
					}
				} else {
					for(var i=0; i<attachments.length; i++) {
						attachmentCallback(attachments[i], false, "Lost connection to Zotero Standalone");
					}
				}
			});
		};
		poll();
	},
	
	// ALL CODE BELOW THIS POINT IS EXECUTED ONLY IN NON-FIREFOX ENVIRONMENTS
	
	/**
	 * Saves items to server
	 * @param items Items in Zotero.Item.toArray() format
	 * @param {Function} callback A callback to be executed when saving is complete. If saving
	 *    succeeded, this callback will be passed true as the first argument and a list of items
	 *    saved as the second. If saving failed, the callback will be passed false as the first
	 *    argument and an error object as the second
	 * @param {Function} attachmentCallback A callback that receives information about attachment
	 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
	 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
	 *     attachmentCallback() will be called with all attachments that will be saved 
	 */
	"_saveToServer":function(items, callback, attachmentCallback) {
		var newItems = [], itemIndices = [], typedArraysSupported = false;
		try {
			typedArraysSupported = !!(new Uint8Array(1) && new Blob());
		} catch(e) {}
		
		for(var i=0, n=items.length; i<n; i++) {
			var item = items[i];
			itemIndices[i] = newItems.length;
			newItems = newItems.concat(Zotero.Utilities.itemToServerJSON(item));
			if(typedArraysSupported) {
				for(var j=0; j<item.attachments.length; j++) {
					item.attachments[j].id = Zotero.Utilities.randomString();
				}
			} else {
				item.attachments = [];
			}
		}
		
		var me = this;
		Zotero.API.createItem({"items":newItems}, function(statusCode, response) {
			if(statusCode !== 200) {
				callback(false, new Error("Save to server failed with "+statusCode+" "+response));
				return;
			}

			try {
				var resp = JSON.parse(response);
			} catch(e) {
				callback(false, new Error("Unexpected response received from server"));
				return;
			}
			for(var i in resp.failed) {
				callback(false, new Error("Save to server failed with "+statusCode+" "+response));
				return;
			}
			
			Zotero.debug("Translate: Save to server complete");
			Zotero.Prefs.getCallback(["downloadAssociatedFiles", "automaticSnapshots"],
			function(prefs) {

				if(typedArraysSupported) {
					for(var i=0; i<items.length; i++) {
						var item = items[i], key = resp.success[itemIndices[i]];
						if(item.attachments && item.attachments.length) {
							me._saveAttachmentsToServer(key, me._getFileBaseNameFromItem(item),
								item.attachments, prefs, attachmentCallback);
						}
					}
				}
				
				callback(true, items);
			});
		});
	},
	
	/**
	 * Saves an attachment to server
	 * @param {String} itemKey The key of the parent item
	 * @param {String} baseName A string to use as the base name for attachments
	 * @param {Object[]} attachments An array of attachment objects
	 * @param {Object} prefs An object with the values of the downloadAssociatedFiles and automaticSnapshots preferences
	 * @param {Function} attachmentCallback A callback that receives information about attachment
	 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
	 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
	 */
	"_saveAttachmentsToServer":function(itemKey, baseName, attachments, prefs, attachmentCallback) {
						Zotero.debug("saveattachmentstoserver");
		var me = this,
			uploadAttachments = [],
			retrieveHeadersForAttachments = attachments.length;
		
		/**
		 * Creates attachments on the z.org server. This is executed after we have received
		 * headers for all attachments to be downloaded, but before they are uploaded to
		 * z.org.
		 * @inner
		 */
		var createAttachments = function() {
			if(uploadAttachments.length === 0) return;
			var attachmentPayload = [];
			for(var i=0; i<uploadAttachments.length; i++) {
				var attachment = uploadAttachments[i];
				attachmentPayload.push({
					"itemType":"attachment",
					"parentItem":itemKey,
					"linkMode":attachment.linkMode,
					"title":(attachment.title ? attachment.title.toString() : "Untitled Attachment"),
					"accessDate":"CURRENT_TIMESTAMP",
					"url":attachment.url,
					"note":(attachment.note ? attachment.note.toString() : ""),
					"tags":(attachment.tags && attachment.tags instanceof Array ? attachment.tags : [])
				});
			}
			
			Zotero.API.createItem({"items":attachmentPayload}, function(statusCode, response) {
				var resp;
				if(statusCode === 200) {
					try {
						resp = JSON.parse(response);
						if(!resp.success) resp = undefined;
					} catch(e) {};
				}
				
				Zotero.debug("Finished creating items");
				for(var i=0; i<uploadAttachments.length; i++) {
					var attachment = uploadAttachments[i];
					if(!resp || !resp.success[i]) {
						attachmentCallback(attachment, false,
							new Error("Unexpected response received from server "+statusCode+" "+response));
					} else {
						attachment.key = resp.success[i];
						
						if(attachment.linkMode === "linked_url") {
							attachmentCallback(attachment, 100);
						} else if("data" in attachment) {
							me._uploadAttachmentToServer(attachment, attachmentCallback);
						}
					}
				}
			});
		};
		
		for(var i=0; i<attachments.length; i++) {
			// Also begin to download attachments
			(function(attachment) {
				var headersValidated = null;
				
				// Ensure these are undefined before continuing, since we'll use them to determine
				// whether an attachment has been created on the Zotero server and downloaded from 
				// the host
				delete attachment.key;
				delete attachment.data;
				
				var isSnapshot = false;
				if(attachment.mimeType) {
					switch(attachment.mimeType.toLowerCase()) {
						case "text/html":
						case "application/xhtml+xml":
							isSnapshot = true;
					}
				}
				
				if((isSnapshot && !prefs.automaticSnapshots) || (!isSnapshot && !prefs.downloadAssociatedFiles)) {
					// Check preferences to see if we should download this file
					if(--retrieveHeadersForAttachments === 0) createAttachments();
					return;
				} else if(attachment.snapshot === false && attachment.mimeType) {
					// If we aren't taking a snapshot and we have the MIME type, we don't need
					// to retrieve anything
					attachment.linkMode = "linked_url";
					uploadAttachments.push(attachment);
					if(attachmentCallback) attachmentCallback(attachment, 0);
					if(--retrieveHeadersForAttachments === 0) createAttachments();
					return;
				}
				
				/**
				 * Checks headers to ensure that they reflect our expectations. When headers have
				 * been checked for all attachments, creates new items on the z.org server and
				 * begins uploading them.
				 * @inner
				 */
				var checkHeaders = function() {
					if(headersValidated !== null) return headersValidated;
					
					retrieveHeadersForAttachments--;
					headersValidated = false;
					
					var err = null,
						status = xhr.status;
					
					// Validate status
					if(status === 0 || attachment.snapshot === false) {
						// Failed due to SOP, or we are supposed to be getting a snapshot
						attachment.linkMode = "linked_url";
					} else if(status !== 200) {
						err = new Error("Server returned unexpected status code "+status);
					} else {
						// Validate content type
						var contentType = "application/octet-stream",
							charset = null,
							contentTypeHeader = xhr.getResponseHeader("Content-Type");
						if(contentTypeHeader) {
							// See RFC 2616 sec 3.7
							var m = /^[^\x00-\x1F\x7F()<>@,;:\\"\/\[\]?={} ]+\/[^\x00-\x1F\x7F()<>@,;:\\"\/\[\]?={} ]+/.exec(contentTypeHeader);
							if(m) contentType = m[0].toLowerCase();
							m = /;\s*charset\s*=\s*("[^"]+"|[^\x00-\x1F\x7F()<>@,;:\\"\/\[\]?={} ]+)/.exec(contentTypeHeader);
							if(m) {
								charset = m[1];
								if(charset[0] === '"') charset = charset.substring(1, charset.length-1);
							}
							
							if(attachment.mimeType
									&& attachment.mimeType.toLowerCase() !== contentType.toLowerCase()) {
								err = new Error("Attachment MIME type "+contentType+
									" does not match specified type "+attachment.mimeType);
							}
						}
						
						if(!err) {
							attachment.mimeType = contentType;
							attachment.linkMode = "imported_url";
							switch(contentType.toLowerCase()) {
								case "application/pdf":
									attachment.filename = baseName+".pdf";
									break;
								case "text/html":
								case "application/xhtml+xml":
									attachment.filename = baseName+".html";
									break;
								default:
									attachment.filename = baseName;
							}
							if(charset) attachment.charset = charset;
							headersValidated = true;
						}
					}
					
					// If we didn't validate the headers, cancel the request
					if(headersValidated === false && "abort" in xhr) xhr.abort();
					
					// Add attachments to attachment payload if there was no error
					if(!err) {
						uploadAttachments.push(attachment);
					}
					
					// If we have retrieved the headers for all attachments, create items on z.org
					// server
					if(retrieveHeadersForAttachments === 0) createAttachments();
					
					// If there was an error, throw it now
					if(err) {
						attachmentCallback(attachment, false, err);
						Zotero.logError(err);
					}
					return headersValidated;
				};
				
				var xhr = new XMLHttpRequest();
				xhr.open((attachment.snapshot === false ? "HEAD" : "GET"), attachment.url, true);
				xhr.responseType = (isSnapshot ? "document" : "arraybuffer");
				xhr.onreadystatechange = function() {
					if(xhr.readyState !== 4 || !checkHeaders()) return;
				
					attachmentCallback(attachment, 50);
					attachment.data = xhr.response;
					// If item already created, head to upload
					if("key" in attachment) {
						me._uploadAttachmentToServer(attachment, attachmentCallback);
					}
				};
				xhr.onprogress = function(event) {
					if(xhr.readyState < 2 || !checkHeaders()) return;
					
					if(event.total && attachmentCallback) {
						attachmentCallback(attachment, event.loaded/event.total*50);
					}
				};
				xhr.send();
				
				if(attachmentCallback) attachmentCallback(attachment, 0);
			})(attachments[i]);
		}
	},
	
	/**
	 * Uploads an attachment to the Zotero server
	 * @param {Object} attachment Attachment object, including 
	 * @param {Function} attachmentCallback A callback that receives information about attachment
	 *     save progress. The callback will be called as attachmentCallback(attachment, false, error)
	 *     on failure or attachmentCallback(attachment, progressPercent) periodically during saving.
	 */
	"_uploadAttachmentToServer":function(attachment, attachmentCallback) {
		Zotero.debug("Uploading attachment to server");
		switch(attachment.mimeType.toLowerCase()) {
			case "text/html":
			case "application/xhtml+xml":
				// It's possible that we didn't know if this was a snapshot until after the
				// download began. If this is the case, we need to convert it to a document.
				if(attachment.data instanceof ArrayBuffer) {
					var me = this,
						blob = new Blob([attachment.data], {"type":attachment.mimeType}),
						reader = new FileReader();
					reader.onloadend = function() {
						if(reader.error) {
							attachmentCallback(attachment, false, reader.error);
						} else {
							// Convert to an HTML document
							var result = reader.result, doc;
							try {
								// First try using DOMParser
								doc = (new DOMParser()).parseFromString(result, "text/html");
							} catch(e) {}
							
							// If DOMParser fails, use document.implementation.createHTMLDocument,
							// as documented at https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
							if(!doc) {
								doc = document.implementation.createHTMLDocument("");
								var docEl = doc.documentElement;
								// AMO reviewer: This code is not run in Firefox, and the document
								// is never rendered anyway
								docEl.innerHTML = result;
								if(docEl.children.length === 1 && docEl.firstElementChild === "html") {
									doc.replaceChild(docEl.firstElementChild, docEl);
								}
							}
							
							attachment.data = doc;
							me._uploadAttachmentToServer(attachment, attachmentCallback);
						}
					}
					reader.readAsText(blob, attachment.charset || "iso-8859-1");
					return;
				}
				
				// We are now assured that attachment.data is an HTMLDocument, so we can 
				// add a base tag
				
				// Get the head tag
				var doc = attachment.data,
					head = doc.getElementsByTagName("head");
				if(!head.length) {
					head = doc.createElement("head");
					var docEl = attachment.data.documentElement;
					docEl.insertBefore(head, docEl.firstChildElement);
				} else {
					head = head[0];
				}
				
				// Add the base tag
				var base = doc.createElement("base");
				base.href = attachment.url;
				head.appendChild(base);
				
				// Remove content type tags
				var metaTags = doc.getElementsByTagName("meta"), metaTag;
				for(var i=0; i<metaTags.length; i++) {
					metaTag = metaTags[i];
					var attr = metaTag.getAttribute("http-equiv");
					if(attr && attr.toLowerCase() === "content-type") {
						metaTag.parentNode.removeChild(metaTag);
					}
				}
				
				// Add UTF-8 content type
				metaTag = doc.createElement("meta");
				metaTag.setAttribute("http-equiv", "Content-Type");
				metaTag.setAttribute("content", attachment.mimeType+"; charset=UTF-8");
				head.insertBefore(metaTag, head.firstChild);
				
				// Serialize document to UTF-8
				var src = new XMLSerializer().serializeToString(doc),
					srcLength = Zotero.Utilities.getStringByteLength(src),
					srcArray = new Uint8Array(srcLength);
				Zotero.Utilities.stringToUTF8Array(src, srcArray);
				
				// Rewrite data
				attachment.data = srcArray.buffer;
				attachment.charset = "UTF-8";
			break;
		}		
		
		var binaryHash = this._md5(new Uint8Array(attachment.data), 0, attachment.data.byteLength),
			hash = "";
		for(var i=0; i<binaryHash.length; i++) {
			if(binaryHash[i] < 16) hash += "0";
			hash += binaryHash[i].toString(16);
		}
		attachment.md5 = hash;
		
		if(Zotero.isChrome && !Zotero.isBookmarklet) {
			// In Chrome, we don't use messaging for Zotero.API.uploadAttachment, since
			// we can't pass ArrayBuffers to the background page
			Zotero.API.uploadAttachment(attachment, attachmentCallback.bind(this, attachment));
		} else {
			// In Safari and the connectors, we can pass ArrayBuffers
			Zotero.Translate.ItemSaver._attachmentCallbacks[attachment.id] = function(status, error) {
				attachmentCallback(attachment, status, error);
			};
			Zotero.API.uploadAttachment(attachment);
		}
	},
	
	/**
	 * Gets the base name for an attachment from an item object. This mimics the default behavior
	 * of Zotero.Attachments.getFileBaseNameFromItem
	 * @param {Object} item
	 */
	"_getFileBaseNameFromItem":function(item) {
		var parts = [];
		if(item.creators && item.creators.length) {
			if(item.creators.length === 1) {
				parts.push(item.creators[0].lastName);
			} else if(item.creators.length === 2) {
				parts.push(item.creators[0].lastName+" and "+item.creators[1].lastName);
			} else {
				parts.push(item.creators[0].lastName+" et al.");
			}
		}
		
		if(item.date) {
			var date = Zotero.Date.strToDate(item.date);
			if(date.year) parts.push(date.year);
		}
		
		if(item.title) {
			parts.push(item.title.substr(0, 50));
		}
		
		if(parts.length) return parts.join(" - ");
		return "Attachment";
	},
	
	/*
	  pdf.js MD5 implementation
	  Copyright (c) 2011 Mozilla Foundation

	  Contributors: Andreas Gal <gal@mozilla.com>
	                Chris G Jones <cjones@mozilla.com>
	                Shaon Barman <shaon.barman@gmail.com>
	                Vivien Nicolas <21@vingtetun.org>
	                Justin D'Arcangelo <justindarc@gmail.com>
	                Yury Delendik
	                Kalervo Kujala
	                Adil Allawi <@ironymark>
	                Jakob Miland <saebekassebil@gmail.com>
	                Artur Adib <aadib@mozilla.com>
	                Brendan Dahl <bdahl@mozilla.com>
	                David Quintana <gigaherz@gmail.com>

	  Permission is hereby granted, free of charge, to any person obtaining a
	  copy of this software and associated documentation files (the "Software"),
	  to deal in the Software without restriction, including without limitation
	  the rights to use, copy, modify, merge, publish, distribute, sublicense,
	  and/or sell copies of the Software, and to permit persons to whom the
	  Software is furnished to do so, subject to the following conditions:

	  The above copyright notice and this permission notice shall be included in
	  all copies or substantial portions of the Software.

	  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
	  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
	  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
	  DEALINGS IN THE SOFTWARE.
	*/
	"_md5":(function calculateMD5Closure() {
		// Don't throw if typed arrays are not supported
		try {
			var r = new Uint8Array([
				7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
				5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
				4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
				6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21]);
		
			var k = new Int32Array([
				-680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426,
				-1473231341, -45705983, 1770035416, -1958414417, -42063, -1990404162,
				1804603682, -40341101, -1502002290, 1236535329, -165796510, -1069501632,
				643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
				568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784,
				1735328473, -1926607734, -378558, -2022574463, 1839030562, -35309556,
				-1530992060, 1272893353, -155497632, -1094730640, 681279174, -358537222,
				-722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
				-198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606,
				-1051523, -2054922799, 1873313359, -30611744, -1560198380, 1309151649,
				-145523070, -1120210379, 718787259, -343485551]);
		} catch(e) {};
	
		function hash(data, offset, length) {
			var h0 = 1732584193, h1 = -271733879, h2 = -1732584194, h3 = 271733878;
			// pre-processing
			var paddedLength = (length + 72) & ~63; // data + 9 extra bytes
			var padded = new Uint8Array(paddedLength);
			var i, j, n;
			if (offset || length != data.byteLength) {
				padded.set(new Uint8Array(data.buffer, offset, length));
			} else {
				padded.set(data);
			}
			i = length;
			padded[i++] = 0x80;
			n = paddedLength - 8;
			while (i < n)
				padded[i++] = 0;
			padded[i++] = (length << 3) & 0xFF;
			padded[i++] = (length >> 5) & 0xFF;
			padded[i++] = (length >> 13) & 0xFF;
			padded[i++] = (length >> 21) & 0xFF;
			padded[i++] = (length >>> 29) & 0xFF;
			padded[i++] = 0;
			padded[i++] = 0;
			padded[i++] = 0;
			// chunking
			// TODO ArrayBuffer ?
			var w = new Int32Array(16);
			for (i = 0; i < paddedLength;) {
				for (j = 0; j < 16; ++j, i += 4) {
					w[j] = (padded[i] | (padded[i + 1] << 8) |
						   (padded[i + 2] << 16) | (padded[i + 3] << 24));
				}
				var a = h0, b = h1, c = h2, d = h3, f, g;
				for (j = 0; j < 64; ++j) {
					if (j < 16) {
						f = (b & c) | ((~b) & d);
						g = j;
					} else if (j < 32) {
						f = (d & b) | ((~d) & c);
						g = (5 * j + 1) & 15;
					} else if (j < 48) {
						f = b ^ c ^ d;
						g = (3 * j + 5) & 15;
					} else {
						f = c ^ (b | (~d));
						g = (7 * j) & 15;
					}
					var tmp = d, rotateArg = (a + f + k[j] + w[g]) | 0, rotate = r[j];
					d = c;
					c = b;
					b = (b + ((rotateArg << rotate) | (rotateArg >>> (32 - rotate)))) | 0;
					a = tmp;
				}
				h0 = (h0 + a) | 0;
				h1 = (h1 + b) | 0;
				h2 = (h2 + c) | 0;
				h3 = (h3 + d) | 0;
			}
			return new Uint8Array([
					h0 & 0xFF, (h0 >> 8) & 0xFF, (h0 >> 16) & 0xFF, (h0 >>> 24) & 0xFF,
					h1 & 0xFF, (h1 >> 8) & 0xFF, (h1 >> 16) & 0xFF, (h1 >>> 24) & 0xFF,
					h2 & 0xFF, (h2 >> 8) & 0xFF, (h2 >> 16) & 0xFF, (h2 >>> 24) & 0xFF,
					h3 & 0xFF, (h3 >> 8) & 0xFF, (h3 >> 16) & 0xFF, (h3 >>> 24) & 0xFF
			]);
		}
		return hash;
	})()
};