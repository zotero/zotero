import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { updateSessionName } from './api/libs/api.js';

const SKY = '#0687E5';
const PEARL = '#F8F6F7';

const styles = {
	container: {
		width: '100%',
		minHeight: '80%',
		background: '#FFFFFF',
		fontFamily: 'Roboto, sans-serif',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
	},
	content: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
	},
	textArea: {
		width: '100%',
        minHeight: '3rem',
        height: '3rem',
		borderRadius: '0.625rem',
		border: '0.0625rem solid #BDBDBD',
		background: PEARL,
		padding: '0.75rem 0.9375rem',
		fontSize: '1rem',
		fontWeight: 400,
		lineHeight: '133%',
		letterSpacing: '0%',
		fontFamily: 'Roboto, sans-serif',
		color: '#000000',
		outline: 'none',
		resize: 'vertical',
		marginBottom: '1.875rem',
		boxSizing: 'border-box',
	},
	buttonContainer: {
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		gap: '0.625rem',
	},
	cancelButton: {
		all: 'revert',
		background: '#FFFFFF',
		color: SKY,
		border: `0.0625rem solid ${SKY}`,
		fontWeight: 700,
		fontSize: '1rem',
		minHeight: '3rem',
		borderRadius: '0.625rem',
		padding: '0.625rem 1.25rem',
		width: '100%',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
	},
	cancelButtonHover: {
		background: PEARL,
	},
	confirmButton: {
		all: 'revert',
		background: SKY,
		color: '#FFFFFF',
		border: 'none',
		fontWeight: 700,
		fontSize: '1rem',
		minHeight: '3rem',
		borderRadius: '0.625rem',
		padding: '0.625rem 1.25rem',
		width: '100%',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
	},
	confirmButtonHover: {
		background: '#007BD5',
	}
};

export default function DeepTutorRenameSession({
	sessionId,
	currentSessionName = '',
	onClose,
	onRenameSuccess
}) {
	const [newSessionName, setNewSessionName] = useState("");
	const [isRenaming, setIsRenaming] = useState(false);
	const [isCancelHovered, setIsCancelHovered] = useState(false);
	const [isConfirmHovered, setIsConfirmHovered] = useState(false);

	const handleCancel = () => {
		if (onClose) {
			onClose();
		}
	};

	const handleConfirm = async () => {
		// Ensure newSessionName is a string and trim it
		const sessionNameString = String(newSessionName || '').trim();
		
		if (!sessionNameString) {
			return;
		}

		setIsRenaming(true);
		try {
			await updateSessionName(sessionId, sessionNameString);
			
			// Wait 0.5 seconds before calling onRenameSuccess
			await new Promise(resolve => setTimeout(resolve, 500));
			
			if (onRenameSuccess) {
				onRenameSuccess();
			}
			if (onClose) {
				onClose();
			}
		} catch (error) {
			Zotero.debug(`DeepTutorRenameSession: Error renaming session: ${error.message}`);
			// You might want to show an error message to the user here
		} finally {
			setIsRenaming(false);
		}
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		...(isCancelHovered ? styles.cancelButtonHover : {}),
		opacity: isRenaming ? 0.5 : 1,
		cursor: isRenaming ? 'not-allowed' : 'pointer'
	};

	const confirmButtonDynamicStyle = {
		...styles.confirmButton,
		...(isConfirmHovered ? styles.confirmButtonHover : {}),
		opacity: (isRenaming || !newSessionName.trim()) ? 0.5 : 1,
		cursor: (isRenaming || !newSessionName.trim()) ? 'not-allowed' : 'pointer'
	};

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<textarea
					style={styles.textArea}
					value={newSessionName}
					onChange={(e) => setNewSessionName(e.target.value)}
					disabled={isRenaming}
				/>
				<div style={styles.buttonContainer}>
					<button
						style={cancelButtonDynamicStyle}
						onClick={handleCancel}
						onMouseEnter={() => setIsCancelHovered(true)}
						onMouseLeave={() => setIsCancelHovered(false)}
						disabled={isRenaming}
					>
						Cancel
					</button>
					<button
						style={confirmButtonDynamicStyle}
						onClick={handleConfirm}
						onMouseEnter={() => setIsConfirmHovered(true)}
						onMouseLeave={() => setIsConfirmHovered(false)}
						disabled={isRenaming || !newSessionName.trim()}
					>
						{isRenaming ? 'Renaming...' : 'Confirm'}
					</button>
				</div>
			</div>
		</div>
	);
}

DeepTutorRenameSession.propTypes = {
	sessionId: PropTypes.string.isRequired,
	currentSessionName: PropTypes.string,
	onClose: PropTypes.func.isRequired,
	onRenameSuccess: PropTypes.func
};
