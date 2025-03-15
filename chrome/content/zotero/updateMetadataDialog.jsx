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

var React = require('react');
var ReactDOM = require('react-dom');

import DiffTable from 'components/diffTable/table';

var Zotero_UpdateMetadataDialog = {
	init(options) {
		return new Promise((resolve) => {
			// Init React diffTable component
			let diffTableContainer = document.getElementById('diff-table-container');
			ReactDOM.createRoot(diffTableContainer).render(
				<DiffTable
					onToggle={options.onToggle}
					onExpand={options.onExpand}
					onIgnore={options.onIgnore}
					onOpenItem={options.onOpenItem}
					onApply={options.onApply}
					ref={ref => resolve(ref)}
				/>
			);
		});
	}
};
