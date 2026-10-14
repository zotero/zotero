/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2026 Corporation for Digital Scholarship
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

/**
 * A request failure with its response code (one of PluginRequestError.codes) and optional JSON
 * details the response carries as `error.data`; anything else a handler throws is a bug
 */
class PluginRequestError extends Error {
	static codes = Object.freeze({
		// No query or command of that name
		UNKNOWN_REQUEST: "UnknownRequest",
		// The plugin lacks a manifest permission the request declares
		PERMISSION_DENIED: "PermissionDenied",
		// The call is malformed: a param fails its schema or a handler's own check
		INVALID_PARAMS: "InvalidParams",
		// A certain target necessary for the request does not exist, is not the requested type, or is invisible to the caller
		NOT_FOUND: "NotFound",
		// The caller may make the request, but Zotero forbids this action
		NOT_ALLOWED: "NotAllowed",
		// A handler returned something that is not JSON data
		INVALID_RESULT: "InvalidResult",
		// A handler threw anything but a PluginRequestError; logged
		INTERNAL_ERROR: "InternalError",
	});

	constructor(code, message, data) {
		super(message);
		this.name = "PluginRequestError";
		this.code = code;
		if (data !== undefined) {
			this.data = data;
		}
	}
}

export { PluginRequestError };
