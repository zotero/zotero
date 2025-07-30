import React, { useState } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const SKY = '#0687E5';

export default function DeepTutorSessionDelete({
	sessionToDelete,
	onConfirmDelete,
	onCancelDelete,
	sessionName = 'this session'
}) {
	const { colors, isDark } = useDeepTutorTheme();
	const [isConfirmHovered, setIsConfirmHovered] = useState(false);
	const [isCancelHovered, setIsCancelHovered] = useState(false);

	// Theme-aware styles
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
		message: {
			fontSize: '1rem',
			color: colors.text.allText,
			textAlign: 'center',
			marginBottom: '1.875rem',
			fontWeight: 400,
			lineHeight: '135%',
		},
		buttonContainer: {
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			gap: '0.625rem',
		},
		confirmButton: {
			all: 'revert',
			background: '#dc3545',
			color: '#fff',
			minHeight: '3rem',
			fontWeight: 700,
			fontSize: '1rem',
			border: 'none',
			borderRadius: '0.625rem',
			padding: '0.625rem 1.25rem',
			width: '100%',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
		},
		confirmButtonHover: {
			background: '#dc3545',
		},
		cancelButton: {
			all: 'revert',
			background: isDark ? 'transparent' : '#fff',
			color: isDark ? '#33A9FF' : SKY,
			fontWeight: 700,
			fontSize: '1rem',
			minHeight: '3rem',
			border: `0.125rem solid ${isDark ? '#33A9FF' : SKY}`,
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			borderRadius: '0.625rem',
			width: '100%',
			padding: '0.625rem 1.25rem',
			cursor: 'pointer',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
		},
		cancelButtonHover: {
			background: isDark ? '#1A8CD8' : '#F8F6F7',
		}
	};

	// Truncate session name if it's too long
	const truncateSessionName = (name, maxLength = 35) => {
		if (!name || name.length <= maxLength) {
			return name;
		}
		return name.substring(0, maxLength) + '...';
	};

	const displaySessionName = truncateSessionName(sessionName);

	const handleConfirm = () => {
		if (sessionToDelete && onConfirmDelete) {
			onConfirmDelete(sessionToDelete);
		}
	};

	const handleCancel = () => {
		if (onCancelDelete) {
			onCancelDelete();
		}
	};

	const confirmButtonDynamicStyle = {
		...styles.confirmButton,
		...(isConfirmHovered ? styles.confirmButtonHover : {})
	};

	const cancelButtonDynamicStyle = {
		...styles.cancelButton,
		...(isCancelHovered ? styles.cancelButtonHover : {})
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div style={styles.title}>Confirm Deletion?</div>
				<button style={styles.closeButton} onClick={handleCancel}>
					×
				</button>
			</div>
			<div style={styles.content}>
				<div style={styles.message}>
					Are you sure you want to delete &quot;{displaySessionName}&quot;? This action cannot be undone.
				</div>
				<div style={styles.buttonContainer}>
					<button
						style={confirmButtonDynamicStyle}
						onClick={handleConfirm}
						onMouseEnter={() => setIsConfirmHovered(true)}
						onMouseLeave={() => setIsConfirmHovered(false)}
					>
						Delete Session
					</button>
					<button
						style={cancelButtonDynamicStyle}
						onClick={handleCancel}
						onMouseEnter={() => setIsCancelHovered(true)}
						onMouseLeave={() => setIsCancelHovered(false)}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

DeepTutorSessionDelete.propTypes = {
	sessionToDelete: PropTypes.string,
	onConfirmDelete: PropTypes.func.isRequired,
	onCancelDelete: PropTypes.func.isRequired,
	sessionName: PropTypes.string
};
