/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2020 Corporation for Digital Scholarship
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

'use strict';

import React, { memo } from 'react';
import ReactDom from 'react-dom';
import { IntlProvider } from 'react-intl';

import CreateParent from './components/createParent/createParent.js';

const CreateParentContainer = memo((props) => {
	return (
		<IntlProvider
			locale={Zotero.locale}
			messages={Zotero.Intl.strings}
		>

			<CreateParent
				{... props}
			/>

		</IntlProvider>
	);
});


CreateParentContainer.destroy = (domEl) => {
	ReactDom.unmountComponentAtNode(domEl);
};


CreateParentContainer.render = (domEl, props) => {
	ReactDom.render(<CreateParentContainer { ...props } />, domEl);
};


Zotero.CreateParentContainer = CreateParentContainer;
