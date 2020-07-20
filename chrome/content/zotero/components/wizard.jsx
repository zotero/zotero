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
import React, { forwardRef, memo, useCallback, useEffect, useState, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { usePrevious } from '../hooks/use-previous';

const Wizard = ({ canAdvance = true, canRewind = true, canCancel = true, className, children, onClose }, ref) => {
	const [currentId, setCurrentId] = useState(null);
	const [hasFocus, setHasFocus] = useState(true); // assumes modal is active when opened
	const previousId = usePrevious(currentId);
	const pages = React.Children.toArray(children);
	const currentIndex = currentId ? pages.findIndex(p => p.props.pageId === currentId) : 0;
	const currentPage = pages[currentIndex];
	const isLastPage = currentIndex === pages.length - 1;
	canAdvance = canAdvance && currentIndex < pages.length - 1;
	canRewind = canRewind && currentIndex > 0;

	useImperativeHandle(ref, () => ({
		goTo: (pageId) => {
			if (!pages.some(p => p.props.pageId === pageId)) {
				throw new Error(`Invalid wizard page id "${pageId}"`);
			}
			setCurrentId(pageId);
		},
		advance: handleContinue
	}));

	const handleCancel = useCallback(() => {
		onClose();
	}, [onClose]);

	const handleGoBack = useCallback(() => {
		const shouldContinue = 'onPageRewound' in currentPage.props ? currentPage.props.onPageRewound() : true;
		if (canRewind && shouldContinue) {
			setCurrentId(pages[currentIndex - 1].props.pageId);
		}
	}, [canRewind, currentIndex, currentPage, pages]);

	const handleContinue = useCallback(() => {
		const shouldContinue = 'onPageAdvance' in currentPage.props ? currentPage.props.onPageAdvance() : true;
		if (!shouldContinue) {
			return;
		}
		if (currentPage.props.nextId) {
			setCurrentId(currentPage.props.nextId);
		}
		else if (canAdvance) {
			setCurrentId(pages[currentIndex + 1].props.pageId);
		}
	}, [canAdvance, currentIndex, currentPage, pages]);

	const handleActivate = useCallback(() => {
		setHasFocus(true);
	}, []);

	const handleDeactivate = useCallback(() => {
		setHasFocus(false);
	}, []);

	const handleDone = useCallback(() => {
		window.close();
	}, []);

	useEffect(() => {
		if (currentId !== previousId && 'onPageShow' in currentPage.props) {
			currentPage.props.onPageShow();
		}
	}, [currentId, previousId, currentPage]);

	// @NOTE: window management, XUL only
	useEffect(() => {
		window.addEventListener("activate", handleActivate);
		return () => {
			document.removeEventListener('activate', handleActivate);
		};
	}, [handleActivate]);

	useEffect(() => {
		window.addEventListener("deactivate", handleDeactivate);
		return () => {
			document.removeEventListener('deactivate', handleDeactivate);
		};
	}, [handleDeactivate]);


	return (
		<div className={ cx('wizard', className, { focused: hasFocus }) }>
			<div className="wizard-body">
				{ currentPage }
			</div>
			<div className="wizard-controls">
				<div className="left">
					<button
						disabled={ !canCancel }
						onClick={ handleCancel }
						title={ Zotero.getString('general.cancel') }
					>
						{ Zotero.getString('general.cancel') }
					</button>
				</div>
				<div className="right">
					<button
						disabled={ !canRewind }
						onClick={ handleGoBack }
						title={ Zotero.getString('general.goBack') }
					>
						{ Zotero.getString('general.goBack') }
					</button>
					{ !isLastPage && (
						<button
							disabled={ !canAdvance }
							onClick={ handleContinue }
							title={ Zotero.getString('general.continue') }
						>
							{ Zotero.getString('general.continue') }
						</button>
					) }
					{ isLastPage && (
						<button
							onClick={ handleDone }
							title={ Zotero.getString('general.done') }
						>
							{ Zotero.getString('general.done') }
						</button>
					) }
				</div>
			</div>
		</div>
	);
};

Wizard.propTypes = {
	canAdvance: PropTypes.bool,
	canCancel: PropTypes.bool,
	canRewind: PropTypes.bool,
	children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),
	className: PropTypes.string,
	onClose: PropTypes.func,
};

export default memo(forwardRef(Wizard));
