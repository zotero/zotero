import React from 'react';
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

export default function DeepTutorNoteSave({ 
	isSuccessful, 
	noteName, 
	containerName, 
	onClose 
}) {
	const { colors } = useDeepTutorTheme();
	const [isButtonHovered, setIsButtonHovered] = React.useState(false);

	const styles = {
		container: {
			width: '100%',
			minHeight: '80%',
			background: colors.background.primary,
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
			marginBottom: '1.5rem'
		},
		message: {
			fontSize: '1rem',
			color: colors.text.allText,
			textAlign: 'left',
			marginBottom: '1.875rem',
			fontWeight: 400,
			lineHeight: '135%',
		},
		button: {
			all: 'revert',
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
		},
		buttonHover: {
			background: colors.button.primaryHover,
		}
	};

	const handleClose = () => {
		if (onClose) {
			onClose();
		}
	};

	const getTitle = () => {
		return isSuccessful ? 'Note Created Successfully' : 'Error Creating Note';
	};

	const getMessage = () => {
		if (isSuccessful) {
			return `Note "${noteName}" created successfully in "${containerName}".`;
		} else {
			return 'Error Creating Note';
		}
	};

	const buttonDynamicStyle = {
		...styles.button,
		...(isButtonHovered ? styles.buttonHover : {})
	};

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<div style={styles.title}>
					{getTitle()}
				</div>
				<div style={styles.message}>
					{getMessage()}
				</div>
				<button
					style={buttonDynamicStyle}
					onClick={handleClose}
					onMouseEnter={() => setIsButtonHovered(true)}
					onMouseLeave={() => setIsButtonHovered(false)}
				>
					Confirm
				</button>
			</div>
		</div>
	);
}

DeepTutorNoteSave.propTypes = {
	isSuccessful: PropTypes.bool.isRequired,
	noteName: PropTypes.string.isRequired,
	containerName: PropTypes.string.isRequired,
	onClose: PropTypes.func.isRequired
};
