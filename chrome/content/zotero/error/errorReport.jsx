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

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import ReactDom from 'react-dom';
import Wizard from './components/wizard';
import WizardPage from './components/wizardPage';
import { nextHtmlId } from './components/utils';
import ZOTERO_CONFIG from 'config';

const ErrorReport = memo(({ io }) => {
	const id = useRef(nextHtmlId());
	const data = io.data;
	const msg = data.msg;
	const errorData = data.errorData;
	const extraData = data.extraData ? data.extraData : '';
	const nextLabel = Zotero.isMac ? Zotero.getString('general.continue') : Zotero.getString('general.next');
	const [canAdvance, setCanAdvance] = useState(false);
	const [canRewind, setCanRewind] = useState(false);
	const [canCancel, setCanCancel] = useState(true);
	const [logText, setLogText] = useState('');
	const wizardRef = useRef(null);
	const [reportID, setReportID] = useState('');
	const [diagnosticInfo, setDiagnosticInfo] = useState('');
	
	const handleClose = useCallback(() => {
		window.close();
	}, []);

	const handleSubmit = useCallback(async () => {
		setCanAdvance(false);
		setCanRewind(false);
		setCanCancel(false);
		
		const parts = {
			error: "true",
			errorData: errorData.join('\n'),
			extraData: extraData,
			diagnostic: diagnosticInfo
		};
		
		let body = '';
		for (let key in parts) {
			body += key + '=' + encodeURIComponent(parts[key]) + '&';
		}
		body = body.substr(0, body.length - 1);
		const xmlhttp = await Zotero.HTTP.request(
			"POST",
			ZOTERO_CONFIG.REPOSITORY_URL + "report",
			{
				body,
				successCodes: false,
				foreground: true
			}
		);

		if (!xmlhttp.responseXML) {
			try {
				if (xmlhttp.status > 1000) {
					alert(Zotero.getString('errorReport.noNetworkConnection'));
				}
				else {
					alert(Zotero.getString('errorReport.invalidResponseRepository'));
				}
			}
			catch (e) {
				alert(Zotero.getString('errorReport.repoCannotBeContacted'));
			}
			
			wizardRef.current.rewind();
			return;
		}
		
		var reported = xmlhttp.responseXML.getElementsByTagName('reported');
		if (reported.length != 1) {
			alert(Zotero.getString('errorReport.invalidResponseRepository'));
			wizardRef.current.rewind();
			return;
		}

		setReportID(reported[0].getAttribute('reportID'));
		wizardRef.current.goTo('error-summary');
	}, [errorData, extraData, diagnosticInfo]);

	useEffect(() => {
		(async () => {
			const newDiagnosticInfo = await Zotero.getSystemInfo();
			setDiagnosticInfo(newDiagnosticInfo);
			const errorDataText = errorData.length
				? data.errorData.join('\n\n')
				: Zotero.getString('errorReport.noErrorsLogged', Zotero.appName);
			
			const newLogText = errorDataText + '\n\n'
				+ (extraData !== '' ? extraData + '\n\n' : '')
				+ newDiagnosticInfo;
			setLogText(newLogText);
			setCanAdvance(true);
		})();
	}, [data, errorData, extraData]);

	return (
		<Wizard
			canAdvance={ canAdvance }
			canRewind={ canRewind }
			canCancel={ canCancel }
			className="error-report"
			onClose={ handleClose }
			ref={ wizardRef }
		>
			<WizardPage pageId="error-intro">
				<p className="description">{ msg }</p>
				<textarea value={ logText }></textarea>
				<p className="description">
					{ Zotero.getString('errorReport.advanceMessage', nextLabel) }
				</p>
			</WizardPage>
			<WizardPage pageId="error-progress" onPageShow={ handleSubmit }>
				{ Zotero.getString('errorReport.submissionInProgress') }
			</WizardPage>
			<WizardPage pageId="error-summary">
				<p className="description">
					{ Zotero.getString('errorReport.submitted') }
				</p>
				<div className="report-result">
					<label htmlFor={ id + '-report-result' }>
						{ Zotero.getString('errorReport.reportID') }
					</label>
					<input
						readOnly={ true }
						id={ id + '-report-result' }
						value={ reportID }
					/>
				</div>
				<p className="description">
					{ Zotero.getString('errorReport.postToForums') }
				</p>
				<p className="description">
					{ Zotero.getString('errorReport.notReviewed') }
				</p>
			</WizardPage>
		</Wizard>
	);
});

ErrorReport.init = (domEl, io) => {
	ReactDom.render(<ErrorReport io={ io } />, domEl);
};

ErrorReport.propTypes = {
	
};

ErrorReport.displayName = 'ErrorReport';

Zotero.ErrorReport = ErrorReport;
