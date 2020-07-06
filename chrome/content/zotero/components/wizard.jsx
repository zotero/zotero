import React, { memo, useCallback, useState } from 'react';
import { Button } from './button';

const Wizard = memo(({ children, label, onClose }) => {
	const [currentId, setCurrentId] = useState(null);
	const pages = React.Children.toArray(children);
	const currentIndex = currentId ? pages.findIndex(p => p.props.pageId === currentId) : 0;
	const currentPage = pages[currentIndex];
	const canAdvance = currentIndex < pages.length - 1;
	const canRewind = currentIndex > 0;

	const handleCancel = useCallback(() => {
		onClose();
	}, []);

	const handleGoBack = useCallback(() => {
		if (canRewind) {
			setCurrentId(pages[currentIndex - 1].props.pageId);
		}
	}, [canRewind, currentIndex, pages]);

	const handleContinue = useCallback(() => {
		if (currentPage.props.nextId) {
			setCurrentId(currentPage.props.nextId);
		}
		else if (canAdvance) {
			setCurrentId(pages[currentIndex + 1].props.pageId);
		}
	}, [canAdvance, currentIndex, currentPage, pages]);

	return (
		<div className="wizard">
			<h1 className="wizard-header">
				{ label }
			</h1>
			<div className="wizard-body">
				{ currentPage }
			</div>
			<div className="wizard-controls">
				<Button
					onClick={ handleCancel }
					text="zotero.wizard.actions.cancel"
					title="zotero.wizard.actions.cancel"
				/>
				<Button
					disabled={ !canRewind }
					onClick={ handleGoBack }
					text="zotero.wizard.actions.goback"
					title="zotero.wizard.actions.goback"
				/>
				<Button
					disabled={ !canAdvance }
					onClick={ handleContinue }
					text="zotero.wizard.actions.continue"
					title="zotero.wizard.actions.continue"
				/>
			</div>
		</div>
	);
});

Wizard.displayName = 'Wizard';

export default Wizard;
