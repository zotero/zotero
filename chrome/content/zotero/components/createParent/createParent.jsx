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
import ReactDOM from "react-dom";
import PropTypes from 'prop-types';
import cx from 'classnames';
import { IntlProvider } from "react-intl";

function CreateParent({ loading, item, toggleAccept }) {
	// When the input has/does not have characters toggle the accept button on the dialog
	const handleInput = (e) => {
		if (e.target.value.trim() !== '') {
			toggleAccept(true);
		}
		else {
			toggleAccept(false);
		}
	};

	return (
		<IntlProvider
			locale={ Zotero.locale }
			messages={ Zotero.Intl.strings }
		>
			<div className="create-parent-container">
				<span className="title">
					{ item.attachmentFilename }
				</span>
				<div className="body">
					<input
						id="parent-item-identifier"
						placeholder={ Zotero.getString('createParent.prompt') }
						size="50"
						disabled={ loading }
						onChange={ handleInput }
					/>
					<div
						mode="undetermined"
						className={ cx('downloadProgress', { hidden: !loading }) }
					>
						<div className="progress-bar"></div>
					</div>
				</div>
			</div>
		</IntlProvider>
	);
}


CreateParent.propTypes = {
	loading: PropTypes.bool,
	item: PropTypes.object,
	toggleAccept: PropTypes.func
};

Zotero.CreateParent = memo(CreateParent);


Zotero.CreateParent.destroy = (domEl) => {
	ReactDOM.unmountComponentAtNode(domEl);
};


Zotero.CreateParent.render = (domEl, props) => {
	ReactDOM.render(<CreateParent { ...props } />, domEl);
};
