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
import React, { forwardRef, memo, useCallback, useEffect, useRef, useState, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { usePrevious } from '../hooks/use-previous';
import { stopPropagation } from './utils';

const Wizard = memo(forwardRef(({ canAdvance = true, canRewind = true, canCancel = true, className, children, onClose, onFinish, ...props }, ref) => {
	const containerRef = useRef(null);
	const [currentId, setCurrentId] = useState(null);
	const [hasFocus, setHasFocus] = useState(true); // assumes modal is active when opened
	const previousId = usePrevious(currentId);
	const pages = React.Children.toArray(children);
	const currentIndex = currentId ? pages.findIndex(p => p.props.pageId === currentId) : 0;
	const currentPage = pages[currentIndex];
	const isLastPage = currentIndex === pages.length - 1;
	const cancelLabel = props.cancelLabel || Zotero.getString('general.cancel');
	const backLabel = props.backLabel
		|| (Zotero.isMac ? Zotero.getString('general.goBack') : Zotero.getString('general.back'));
	const nextLabel = props.nextLabel
		|| (Zotero.isMac ? Zotero.getString('general.continue') : Zotero.getString('general.next'));
	const doneLabel = props.doneLabel
		|| (Zotero.isMac ? Zotero.getString('general.done') : Zotero.getString('general.finish'));


	canAdvance = canAdvance && currentIndex < pages.length - 1;
	canRewind = canRewind && currentIndex > 0;

	useImperativeHandle(ref, () => ({
		goTo: (pageId) => {
			if (!pages.some(p => p.props.pageId === pageId)) {
				throw new Error(`Invalid wizard page id "${pageId}"`);
			}
			setCurrentId(pageId);
		},
		advance: handleContinue,
		rewind: handleGoBack
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
		if (onFinish) {
			onFinish();
		}
		window.close();
	}, [onFinish]);

	const handleKeyDown = useCallback((ev) => {
		if (ev.key === 'Enter') {
			if (canAdvance) {
				handleContinue();
			}
			else if (isLastPage) {
				handleDone();
			}
		}
		else if (ev.key === 'Escape') {
			if (currentIndex > 0 && canRewind) {
				handleGoBack();
			}
			else if (currentIndex === 0 && canCancel) {
				handleCancel();
			}
		}
	}, [canAdvance, canCancel, canRewind, currentIndex, handleCancel, handleContinue, handleDone, handleGoBack, isLastPage]);

	useEffect(() => {
		if (currentId !== previousId && 'onPageShow' in currentPage.props) {
			currentPage.props.onPageShow(currentPage.props.pageId);
		}

		if (containerRef.current) {
			(containerRef
				.current
				.querySelector('button:not(.wizard-button), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
				|| containerRef.current
			).focus();
		}
	}, [currentId, previousId, currentPage, containerRef]);

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
		<div
			className={ cx('wizard', className, { focused: hasFocus }) }
			onKeyDown={ handleKeyDown }
			tabIndex={ -1 }
			ref={ containerRef }
		>
			{ currentPage }
			<div className="wizard-controls">
				<div className="cancel-controls">
					<button
						className="wizard-button cancel-button"
						disabled={ !canCancel }
						onClick={ handleCancel }
						title={ cancelLabel }
					>
						<span>{ cancelLabel }</span>
					</button>
				</div>
				<div className="next-back-controls">
					{ (!Zotero.isLinux || (Zotero.isLinux && canRewind)) && (
						<button
							className="wizard-button back-button"
							disabled={ !canRewind }
							onClick={ handleGoBack }
							onKeyDown={ stopPropagation }
							title={ backLabel }
						>
							<span>{ backLabel }</span>
						</button>
					) }
					{ !isLastPage && (
						<button
							className="wizard-button continue-button"
							disabled={ !canAdvance }
							onClick={ handleContinue }
							onKeyDown={ stopPropagation }
							title={ nextLabel }
						>
							<span>{ nextLabel }</span>
						</button>
					) }
					{ isLastPage && (
						<button
							className="wizard-button done-button"
							onClick={ handleDone }
							onKeyDown={ stopPropagation }
							title={ doneLabel }
						>
							<span>{ doneLabel }</span>
						</button>
					) }
				</div>
			</div>
		</div>
	);
}));

Wizard.displayName = 'Wizard';

Wizard.propTypes = {
	backLabel: PropTypes.string,
	canAdvance: PropTypes.bool,
	canCancel: PropTypes.bool,
	cancelLabel: PropTypes.string,
	canRewind: PropTypes.bool,
	children: PropTypes.oneOfType([PropTypes.element, PropTypes.array]),
	className: PropTypes.string,
	doneLabel: PropTypes.string,
	nextLabel: PropTypes.string,
	onClose: PropTypes.func,
	onFinish: PropTypes.func,
};

export default Wizard;
