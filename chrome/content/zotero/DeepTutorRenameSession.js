import React, { useState, useEffect, useRef } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { updateSessionName } from './api/libs/api.js';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const SKY = '#0687E5';
const PEARL = '#F8F6F7';

export default function DeepTutorRenameSession({
	sessionId,
	currentSessionName: _currentSessionName = '',
	onConfirmRename,
	onCancelRename
}) {
	const { colors, isDark } = useDeepTutorTheme();
	const [newSessionName, setNewSessionName] = useState(_currentSessionName);
	const [isRenaming, setIsRenaming] = useState(false);
	const [isCancelHovered, setIsCancelHovered] = useState(false);
	const [isConfirmHovered, setIsConfirmHovered] = useState(false);
	const textareaRef = useRef(null);

	// Select all text when component mounts
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.select();
		}
	}, []);

	const styles = {
		container: {
			width: '24rem',
			maxWidth: '90vw',
			background: colors.background.primary,
			fontFamily: 'Roboto, sans-serif',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			position: 'relative',
			borderRadius: '0.625rem',
			boxShadow: '0 0.25rem 0.5rem rgba(0,0,0,0.15)',
			padding: '0.25rem 1.25rem',
		},
		header: {
			width: '100%',
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			padding: '1.25rem 0 0 0',
			marginBottom: '1.5rem',
			position: 'relative',
		},
		title: {
			width: '100%',
			textAlign: 'center',
			background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
			WebkitBackgroundClip: 'text',
			WebkitTextFillColor: 'transparent',
			backgroundClip: 'text',
			color: '#0687E5',
			fontWeight: 700,
			fontSize: '1.5rem',
			lineHeight: '1.2',
			letterSpacing: '0%',
		},
		closeButton: {
			all: 'revert',
			background: 'transparent',
			border: 'none',
			cursor: 'pointer',
			padding: '0.75rem',
			borderRadius: '0.25rem',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			color: colors.text.tertiary,
			fontSize: '2rem',
			lineHeight: 1,
			position: 'absolute',
			right: '0rem',
			top: '50%',
			transform: 'translateY(-50%)',
		},
		content: {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			padding: '0 0 1.25rem 0',
		},
		textArea: {
			width: '100%',
			minHeight: '3rem',
			height: '3rem',
			borderRadius: '0.625rem',
			border: `0.0625rem solid ${colors.border.primary}`,
			background: colors.background.secondary,
			padding: '0.75rem 0.9375rem',
			fontSize: '1rem',
			fontWeight: 400,
			lineHeight: '133%',
			letterSpacing: '0%',
			fontFamily: 'Roboto, sans-serif',
			color: colors.text.allText,
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
		confirmButton: {
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: 'none',
			borderRadius: '0.625rem',
			padding: '0.75rem 1.5rem',
			minHeight: '3rem',
			fontWeight: 600,
			fontSize: '1rem',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			transition: 'background 0.2s',
			display: 'block',
			width: '100%',
			marginBottom: '0.5rem',
		},
		confirmButtonHover: {
			background: SKY,
		},
		cancelButton: {
			background: colors.button.secondary,
			color: colors.button.secondaryText,
			border: `0.0625rem solid ${colors.button.secondaryBorder}`,
			borderRadius: '0.625rem',
			padding: '0.75rem 1.5rem',
			minHeight: '3rem',
			fontWeight: 600,
			fontSize: '1rem',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.04)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			transition: 'background 0.2s',
			display: 'block',
			width: '100%',
		},
		cancelButtonHover: {
			background: isDark ? '#1A8CD8' : PEARL,
		}
	};

	const handleCancel = () => {
		if (onCancelRename) {
			onCancelRename();
		}
	};

	const handleTextareaFocus = (e) => {
		// Select all text when the textarea is focused
		e.target.select();
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
			
			// Wait 0.5 seconds before calling onConfirmRename
			await new Promise(resolve => setTimeout(resolve, 500));
			
			if (onConfirmRename) {
				onConfirmRename(sessionId);
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutorRenameSession: Error renaming session: ${error.message}`);
			// You might want to show an error message to the user here
		}
		finally {
			setIsRenaming(false);
		}
	};

	const confirmButtonDynamicStyle = {
		...styles.confirmButton,
		...(isConfirmHovered ? styles.confirmButtonHover : {}),
		opacity: (isRenaming || !newSessionName.trim()) ? 0.5 : 1,
		cursor: (isRenaming || !newSessionName.trim()) ? 'not-allowed' : 'pointer'
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		...(isCancelHovered ? styles.cancelButtonHover : {}),
		opacity: isRenaming ? 0.5 : 1,
		cursor: isRenaming ? 'not-allowed' : 'pointer'
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div style={styles.title}>Rename</div>
				<button
					style={styles.closeButton}
					onClick={handleCancel}
				>
					×
				</button>
			</div>
			<div style={styles.content}>
				<textarea
					ref={textareaRef}
					style={styles.textArea}
					value={newSessionName}
					onChange={e => setNewSessionName(e.target.value)}
					onFocus={handleTextareaFocus}
					disabled={isRenaming}
					placeholder="Enter new session name..."
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
	onConfirmRename: PropTypes.func.isRequired,
	onCancelRename: PropTypes.func.isRequired
};
