import React from 'react';
import PropTypes from 'prop-types';

const SKY = '#0687E5';

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
	message: {
		fontSize: '1rem',
		color: '#000000',
		textAlign: 'center',
		marginBottom: '1.875rem',
		fontWeight: 400,
		lineHeight: '135%',
	},
	button: {
		all: 'revert',
		background: SKY,
		color: '#fff',
		width: '100%',
		minHeight: '2.4375rem',
		fontWeight: 700,
		fontSize: '1rem',
		border: 'none',
		borderRadius: '0.625rem',
		padding: '0.875rem 0',
		cursor: 'pointer',
		boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
	},
	buttonHover: {
		background: '#007BD5',
	}
};

export default function DeepTutorNoPDFWarning({ onClose }) {
	const [isButtonHovered, setIsButtonHovered] = React.useState(false);

	const handleClose = () => {
		if (onClose) {
			onClose();
		}
	};

	const buttonDynamicStyle = {
		...styles.button,
		...(isButtonHovered ? styles.buttonHover : {})
	};

	return (
		<div style={styles.container}>
			<div style={styles.content}>
				<div style={styles.message}>
          Only PDF files are supported. Please make sure the selected item includes a PDF attachment.
				</div>
				<button
					style={buttonDynamicStyle}
					onClick={handleClose}
					onMouseEnter={() => setIsButtonHovered(true)}
					onMouseLeave={() => setIsButtonHovered(false)}
				>
          Got It
				</button>
			</div>
		</div>
	);
}

DeepTutorNoPDFWarning.propTypes = {
	onClose: PropTypes.func.isRequired
};
