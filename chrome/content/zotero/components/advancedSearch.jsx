/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2019 Corporation for Digital Scholarship
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
import PropTypes from 'prop-types';
import { IntlProvider, FormattedMessage } from 'react-intl';


const AdvancedSearch = memo(({ onSearch, onClear, onSaveSearch, libraryIsEditable }) => {
	return (
		<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
			<button
				className="button-native"
				label="zotero.search.search"
				default="fletcher"
				onClick={ ev => onSearch(ev) }
			>
				<FormattedMessage id="zotero.search.search" />
			</button>
			<button
				className="button-native"
				label="zotero.search.clear"
				onClick={ ev => onClear(ev) }
			>
				<FormattedMessage id="zotero.search.clear" />
			</button>
			<button
				className="button-native"
				label="zotero.search.saveSearch"
				disabled={ !libraryIsEditable }
				onClick={ ev => onSaveSearch(ev) }
			>
				<FormattedMessage id="zotero.search.saveSearch" />
			</button>
		</IntlProvider>
	);
});

AdvancedSearch.destroy = (domEl) => {
	ReactDom.unmountComponentAtNode(domEl);
};

AdvancedSearch.render = (domEl, props) => {
	ReactDom.render(<AdvancedSearch { ...props } />, domEl);
};

AdvancedSearch.propTypes = {
	// Button Click Listeners
	onSearch: PropTypes.func,
	onClear: PropTypes.func,
	onSaveSearch: PropTypes.func,
	// Config
	libraryIsEditable: PropTypes.bool
};

AdvancedSearch.defaultProps = {
	onSearch: () => Promise.resolve(),
	onClear: () => Promise.resolve(),
	onSaveSearch: () => Promise.resolve(),
	libraryIsEditable: false
};

Zotero.AdvancedSearch = AdvancedSearch;
