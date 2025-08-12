import React from 'react';
import PropTypes from 'prop-types';

const AQUA = '#0AE2FF';
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
	title: {
		background: 'linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)',
		WebkitBackgroundClip: 'text',
		WebkitTextFillColor: 'transparent',
		backgroundClip: 'text',
		color: SKY,
		fontWeight: 700,
		fontSize: '1.5rem',
		lineHeight: '100%',
		letterSpacing: '0%',
		textAlign: 'center',
		marginBottom: '18px',
		marginTop: '8px',
	},
	image: {
		width: '6.875rem',
		height: '6.875rem',
		objectFit: 'contain',
		margin: '0 auto 20px auto',
		display: 'block',
	},
	text: {
		fontSize: '1rem',
		color: '#222',
		textAlign: 'center',
		margin: '0 0 30px 0',
		fontFamily: 'Roboto, sans-serif',
		fontWeight: 500,
		lineHeight: '1.35',
	},
	button: {
		all: 'revert',
		background: SKY,
		color: '#fff',
		width: '100%',
		minHeight: '2.4375rem',
		fontWeight: 600,
		fontSize: '1rem',
		border: 'none',
		borderRadius: '0.625rem',
		padding: '0.875rem 0',
		margin: '0 auto 0 auto',
		cursor: 'pointer',
		boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
		fontFamily: 'Roboto, sans-serif',
		letterSpacing: 0.2,
		display: 'block',
	},
};

export default function DeepTutorSubscriptionConfirm({ onClose, imagePath }) {
	return (
		<div style={styles.container}>
			<img src={imagePath} alt="Subscription Confirm" style={styles.image} />
			<div style={styles.text}>Your Support for DeepTutor<br />is greatly appreciated!</div>
			<button style={styles.button} onClick={onClose}>Start Using Premium</button>
		</div>
	);
}
