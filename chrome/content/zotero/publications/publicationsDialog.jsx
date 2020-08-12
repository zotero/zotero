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

import React, { memo, useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import ReactDom from 'react-dom';
import Wizard from './components/wizard';
import WizardPage from './components/wizardPage';
import RadioSet from './components/radioSet';
import LicenseInfo from './components/licenseInfo';
import { nextHtmlId } from './components/utils';

const importSourceOptions = [
	{ label: Zotero.getString('publications.sharing.reserved'), value: 'reserved' },
	{ label: Zotero.getString('publications.sharing.cc'), value: 'cc' },
	{ label: Zotero.getString('publications.sharing.cc0'), value: 'cc0' },
];

const adaptationsOptions = [
	{ label: Zotero.getString('general.no'), value: 'no' },
	{ label: Zotero.getString('publications.chooseLicense.adaptations.sharealike'), value: 'sharealike' },
	{ label: Zotero.getString('general.yes'), value: 'yes' },
];

const commercialOptions = [
	{ label: Zotero.getString('general.no'), value: 'no' },
	{ label: Zotero.getString('general.yes'), value: 'yes' },
];

/**
 * Update the calculated license and image
 *
 * Possible licenses:
 *
 * 'cc-by'
 * 'cc-by-sa'
 * 'cc-by-nd'
 * 'cc-by-nc'
 * 'cc-by-nc-sa'
 * 'cc-by-nc-nd'
 * 'cc0'
 * 'reserved'
 */
function getLicense(sharing, adaptations, commercial) {
	if (sharing == 'cc0' || sharing == 'reserved') {
		return sharing;
	}
	else {
		let license = 'cc-by';
		if (commercial === 'no') {
			license += '-nc';
		}
		if (adaptations === 'no') {
			license += '-nd';
		}
		else if (adaptations == 'sharealike') {
			license += '-sa';
		}
		return license;
	}
}

const PublicationsDialog = memo(() => {
	const id = useRef(nextHtmlId());
	const [shouldIncludeFiles, setShouldIncludeFiles] = useState(false);
	const [shouldIncludeNotes, setShouldIncludeNotes] = useState(false);
	const [authorship, setAuthorship] = useState(false);
	const [sharing, setSharing] = useState('reserved');
	const [adaptations, setAdaptations] = useState('no');
	const [commercial, setCommercial] = useState('no');
	const license = getLicense(sharing, adaptations, commercial);

	const handleShouldIncludeFilesChange = useCallback((ev) => {
		setShouldIncludeFiles(ev.currentTarget.checked);
	}, []);

	const handleShouldIncludeNotesChange = useCallback((ev) => {
		setShouldIncludeNotes(ev.currentTarget.checked);
	}, []);

	const handleAutorshipChange = useCallback((ev) => {
		setAuthorship(ev.currentTarget.checked);
	}, []);

	const handleSharingChange = useCallback((newSharing) => {
		setSharing(newSharing);
	}, []);

	const handleAdaptationsChange = useCallback((newAdaptations) => {
		setAdaptations(newAdaptations);
	}, []);

	const handleCommercialChange = useCallback((newCommercial) => {
		setCommercial(newCommercial);
	}, []);

	return (
		<Wizard
			className="publications-dialog"
		>
			<WizardPage
				pageId="intro"
				label={ Zotero.getString('publications.my_publications') }
			>
				<p className="description">
					{ Zotero.getString('publications.intro') }
				</p>
				<div className="include-files-container">
					<input
						checked={ shouldIncludeFiles }
						id={ id.current + '-include-files-checkbox' }
						label={ Zotero.getString('publications.include.checkbox.files') }
						onChange={ handleShouldIncludeFilesChange }
						type="checkbox"
					/>
					<label htmlFor={ id.current + '-create-collection-checkbox' }>
						{ Zotero.getString('publications.include.checkbox.files') }
					</label>
				</div>
				<div className="include-notes-container">
					<input
						checked={ shouldIncludeNotes }
						id={ id.current + '-include-notes-checkbox' }
						label={ Zotero.getString('publications.include.checkbox.notes') }
						onChange={ handleShouldIncludeNotesChange }
						type="checkbox"
					/>
					<label htmlFor={ id.current + '-include-notes-checkbox' }>
						{ Zotero.getString('publications.include.checkbox.notes') }
					</label>
				</div>
				<p className="description">
					{ Zotero.getString('publications.include.adjustAtAnyTime') }
				</p>
				<div className="confirm-authorship-checkbox">
					<input
						checked={ authorship }
						id={ id.current + '-authorship-checkbox' }
						onChange={ handleAutorshipChange }
						type="checkbox"
					/>
				</div>
			</WizardPage>
			<WizardPage
				pageId="choose-sharing"
				label={ Zotero.getString('publications.sharing.title') }
			>
				<p className="description">
					{ Zotero.getString('publications.sharing.text') }
				</p>
				<p className="description">
					{ Zotero.getString('publications.sharing.prompt') }
				</p>
				<RadioSet
					onChange={ handleSharingChange }
					options={ importSourceOptions }
					value={ sharing }
				/>
				<LicenseInfo license={ license } />
			</WizardPage>
			<WizardPage
				pageId="choose-license"
				label={ Zotero.getString('publications.chooseLicense.title') }
			>
				<p className="description">
					{ Zotero.getString('publications.chooseLicense.text') }
				</p>
				<h2>
					{ Zotero.getString('publications.chooseLicense.adaptations.prompt') }
				</h2>
				<RadioSet
					onChange={ handleAdaptationsChange }
					options={ adaptationsOptions }
					value={ adaptations }
				/>
				<h2>
					{ Zotero.getString('publications.chooseLicense.commercial.prompt') }
				</h2>
				<RadioSet
					onChange={ handleCommercialChange }
					options={ commercialOptions }
					value={ commercial }
				/>
				<LicenseInfo license={ license } />
			</WizardPage>
		</Wizard>
	);
});

PublicationsDialog.init = (domEl, props) => {
	ReactDom.render(<PublicationsDialog { ...props } />, domEl);
};

PublicationsDialog.propTypes = {
	libraryID: PropTypes.number,
};

PublicationsDialog.displayName = 'PublicationsDialog';

Zotero.PublicationsDialog = PublicationsDialog;
