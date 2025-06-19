/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2023 Corporation for Digital Scholarship
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

Zotero.Server.Endpoints['/integration/macWordCommand'] = function () {};
Zotero.Server.Endpoints['/integration/macWordCommand'].prototype = {
	supportedMethods: ["GET"],
	supportedDataTypes: ["application/json"],
	permitBookmarklet: true,
	init: function (data) {
		// Some dark magic to fix incorrectly encoded unicode characters here
		// from https://stackoverflow.com/questions/5396560/how-do-i-convert-special-utf-8-chars-to-their-iso-8859-1-equivalent-using-javasc
		const document = decodeURIComponent(escape(data.searchParams.get('document')));
		Zotero.Integration.execCommand(
			data.searchParams.get('agent'),
			data.searchParams.get('command'),
			document,
			data.searchParams.get('templateVersion')
		);
		return 200;
	},
};
