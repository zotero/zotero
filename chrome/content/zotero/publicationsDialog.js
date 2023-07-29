/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2015 Center for History and New Media
					 George Mason University, Fairfax, Virginia, USA
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
const getLicense = (sharing, adaptations, commercial, currentPage) => {
	if (sharing === 'cc0' || sharing === 'reserved') {
		return sharing;
	}
	if (currentPage !== 'choose-license') {
		return 'cc';
	}

	let license = 'cc-by';
	if (commercial === 'no') {
		license += '-nc';
	}
	if (adaptations === 'no') {
		license += '-nd';
	}
	else if (adaptations === 'sharealike') {
		license += '-sa';
	}
	return license;
};

const id = document.getElementById.bind(document);

const Zotero_Publications_Dialog = { // eslint-disable-line no-unused-vars, camelcase
	async init() {
		this.io = window.arguments?.[0] ?? {};
		this.wizard = id('publications-dialog-wizard');

		id('include-files')
			.addEventListener('CheckboxStateChange', this.onIntroPageCheckboxChange.bind(this));
		id('confirm-authorship-checkbox')
			.addEventListener('CheckboxStateChange', this.onIntroPageCheckboxChange.bind(this));
		id('sharing-radiogroup')
			.addEventListener('select', this.onLicenseAspectRadioChange.bind(this));
		id('choose-adaptations')
			.addEventListener('select', this.onLicenseAspectRadioChange.bind(this));
		id('choose-commercial')
			.addEventListener('select', this.onLicenseAspectRadioChange.bind(this));
		id('keep-rights-checkbox')
			.addEventListener('CheckboxStateChange', this.onKeepRightsCheckboxChange.bind(this));
		this.wizard.getPageById('intro')
			.addEventListener('pageshow', this.onIntroPageShow.bind(this));
		this.wizard.getPageById('choose-sharing')
			.addEventListener('pageshow', this.onSharingPageShow.bind(this));
		this.wizard.getPageById('choose-license')
			.addEventListener('pageshow', this.onLicensePageShow.bind(this));

		this.wizard.addEventListener('wizardnext', this.onWizardNext.bind(this));
		this.wizard.addEventListener('wizardfinish', this.onFinish.bind(this));

		// wizard.shadowRoot content isn't exposed to our css
		this.wizard.shadowRoot
			.querySelector('.wizard-header-label').style.fontSize = '16px';
		
		this.updateNextButton();
		this.updateIntroPage();
	},

	onIntroPageShow() {
		this.updateNextButton();
		this.updateIntroPage();
		this.updateFocus();
	},

	onSharingPageShow() {
		this.updateSharingPage();
		this.updateNextButton();
		this.updateLicense();
		this.updateFocus();
	},

	onLicensePageShow() {
		this.updateNextButton();
		this.updateLicense();
		this.updateFocus();
	},

	onWizardNext(ev) {
		if ((this.wizard.currentPage.pageid === 'intro' && !id('include-files').checked)
			|| (this.wizard.currentPage.pageid === 'choose-sharing'
				&& (id('sharing-radiogroup').selectedItem.value !== 'cc'
					|| (this.io.hasRights === 'all' && id('keep-rights-checkbox').checked)
				))
		) {
			ev.preventDefault();
			this.onFinish();
			window.close();
		}
	},

	onFinish() {
		this.io.includeFiles = id('include-files').checked;
		this.io.includeNotes = id('include-notes').checked;
		this.io.keepRights = true;
		if (this.wizard.currentPage.pageid !== 'intro') {
			this.io.keepRights = id('keep-rights-checkbox').checked;
			this.io.license = getLicense(
				id('sharing-radiogroup').selectedItem.value,
				id('choose-adaptations').selectedItem.value,
				id('choose-commercial').selectedItem.value,
				this.wizard.currentPage.pageid
			);
			this.io.licenseName = id('final-license-info').licenseName;
		}
	},

	onIntroPageCheckboxChange() {
		this.updateIntroPage();
		this.updateNextButton();
	},

	onKeepRightsCheckboxChange() {
		this.updateSharingPage();
		this.updateNextButton();
	},

	onLicenseAspectRadioChange() {
		this.updateNextButton();
		this.updateLicense();
	},

	updateIntroPage() {
		id('include-files').disabled = !this.io.hasFiles;
		id('include-notes').disabled = !this.io.hasNotes;
		id('confirm-authorship-checkbox').dataset.l10nId = id('include-files').checked
			? 'publications-intro-authorship-files'
			: 'publications-intro-authorship';
	},

	updateSharingPage() {
		id('keep-rights').style.display
			= this.io.hasRights === 'none' ? 'none' : '';

		id('keep-rights-checkbox').disabled = this.io.hasRights === 'none';
		id('keep-rights-checkbox').dataset.l10nId
			= this.io.hasRights === 'some'
				? 'publications-sharing-keep-rights-field-where-available'
				: 'publications-sharing-keep-rights-field';
		id('choose-sharing-options').style.display
			= this.io.hasRights === 'all' && id('keep-rights-checkbox').checked ? 'none' : '';
	},

	updateLicense() {
		const license = getLicense(
			id('sharing-radiogroup').selectedItem.value,
			id('choose-adaptations').selectedItem.value,
			id('choose-commercial').selectedItem.value,
			this.wizard.currentPage.pageid
		);
		id('sharing-license-info').license = license;
		id('final-license-info').license = license;
	},

	updateFocus() {
		this.wizard.currentPage.querySelector('radiogroup:not([disabled]),checkbox:not([disabled])').focus();
	},

	updateNextButton() {
		const nextButton = this.wizard.getButton('next');
		this.wizard.canAdvance = id('confirm-authorship-checkbox').checked;

		if (this.io.hasRights === 'all' && id('keep-rights-checkbox').checked) {
			nextButton.dataset.l10nId = 'publications-buttons-add-to-my-publications';
		}
		else if (this.wizard.currentPage.pageid === 'intro') {
			nextButton.dataset.l10nId = id('include-files').checked
				? 'publications-buttons-next-sharing'
				: 'publications-buttons-add-to-my-publications';
		}
		else if (this.wizard.currentPage.pageid === 'choose-sharing') {
			nextButton.dataset.l10nId
				= id('sharing-radiogroup').selectedItem.value === 'cc'
					? 'publications-buttons-next-choose-license'
					: 'publications-buttons-add-to-my-publications';
		}
	},
	
};
