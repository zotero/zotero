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

import React from 'react';
// TODO: Investigate what causes `import ReactDOM` to fail
// with https://fb.me/react-invalid-hook-call in `tagsboxTest.js`
// import ReactDOM from 'react-dom';
const ReactDOM = require('react-dom');
import { IntlProvider } from 'react-intl';
import DiffTable from 'components/diffTable/table';

Zotero.DiffTable = {
	init(container, props, callback) {
		let ref = React.createRef();
		let elem = (
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<DiffTable ref={ref} {...props} />
			</IntlProvider>
		);
		ReactDOM.render(elem, container, () => {
			callback(ref);
		});
	}
};
