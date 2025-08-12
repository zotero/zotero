import React, { useState } from 'react';
import { signInWithGoogle } from './auth/cognitoAuth.js';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

const FolderImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_FOLDER.svg';
const PageImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_PAGE.svg';
const GoogleImg = 'chrome://zotero/content/DeepTutorMaterials/SignIn/Google.png';

export default function DeepTutorWelcomePane({ onWelcomeSignIn, onSignInSuccess: _onSignInSuccess, localhostServer }) {
	const { colors } = useDeepTutorTheme();
	const [isSignInHovered, setIsSignInHovered] = useState(false);
	const [isGoogleHovered, setIsGoogleHovered] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');

	const handleSignInMouseEnter = () => setIsSignInHovered(true);
	const handleSignInMouseLeave = () => setIsSignInHovered(false);

	const handleGoogleMouseEnter = () => setIsGoogleHovered(true);
	const handleGoogleMouseLeave = () => setIsGoogleHovered(false);

	// Theme-aware styles
	const styles = {
		container: {
			position: 'relative',
			width: '100%',
			height: '100%',
			background: colors.background.tertiary,
			fontFamily: 'Roboto, sans-serif',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
		},
		folderBg: {
			position: 'absolute',
			width: '18%',
			height: 'auto',
			bottom: '33%',
			left: '31%',
			opacity: 0.8,
			zIndex: 0,
		},
		pageBg: {
			position: 'absolute',
			width: '15%',
			height: 'auto',
			top: '27%',
			right: '25%',
			opacity: 0.8,
			zIndex: 0,
		},
		contentWrapper: {
			position: 'relative',
			width: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'center',
			gap: '0.625rem',
			zIndex: 1,
		},
		mainTextWrapper: {
			width: '100%',
			marginBottom: '0.625rem',
			display: 'flex',
			justifyContent: 'center',
		},
		subTextWrapper: {
			width: '100%',
			marginBottom: '0.625rem',
			display: 'flex',
			justifyContent: 'center',
		},
		descTextWrapper: {
			width: '100%',
			marginBottom: '1.875rem',
			display: 'flex',
			justifyContent: 'center',
		},
		buttonWrapper: {
			width: '100%',
			display: 'flex',
			justifyContent: 'center',
		},
		mainText: {
			width: '100%',
			fontWeight: 700,
			fontSize: '1.375rem',
			lineHeight: '100%',
			letterSpacing: '0%',
			textAlign: 'center',
			color: colors.text.allText,
		},
		subText: {
			width: '100%',
			fontWeight: 600,
			fontSize: '1.25rem',
			lineHeight: '100%',
			letterSpacing: '0%',
			textAlign: 'center',
			color: colors.text.allText,
		},
		descText: {
			width: '100%',
			fontWeight: 400,
			fontSize: '1rem',
			lineHeight: '135%',
			letterSpacing: '0%',
			textAlign: 'center',
			color: colors.text.allText,
		},
		signInButton: {
			all: 'revert',
			background: colors.button.primary,
			color: colors.button.primaryText,
			fontWeight: 600,
			fontSize: '1em',
			border: 'none',
			borderRadius: '0.625rem',
			width: '100%',
			maxWidth: '21.625rem',
			minHeight: '3rem',
			padding: '0.625rem 1.25rem',
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.08)',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			zIndex: 1,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
		},
		googleButton: {
			all: 'revert',
			width: '100%',
			maxWidth: '21.625rem',
			minHeight: '3rem',
			borderRadius: '0.625rem',
			border: `1px solid ${colors.button.secondaryBorder}`,
			padding: '0.625rem 1.25rem',
			background: colors.button.secondary,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			fontWeight: 500,
			fontSize: '1rem',
			color: colors.button.secondaryText,
			cursor: 'pointer',
			fontFamily: 'Roboto, sans-serif',
			letterSpacing: 0.2,
			zIndex: 1,
			marginTop: '0.625rem',
		},
		googleIcon: {
			width: '1.375rem',
			height: '1.375rem',
			objectFit: 'contain',
			marginRight: '0.5rem',
		},
		errorMessage: {
			color: colors.error,
			fontSize: '0.875rem',
			marginTop: '0.625rem',
			textAlign: 'center',
			width: '100%',
		},
		successMessage: {
			color: colors.success,
			fontSize: '0.875rem',
			marginTop: '0.625rem',
			textAlign: 'center',
			width: '100%',
		},
	};

	const signInButtonStyle = {
		...styles.signInButton,
		background: isSignInHovered ? colors.button.hover : colors.button.primary,
	};

	const googleButtonStyle = {
		...styles.googleButton,
		background: isGoogleHovered ? colors.background.quaternary : colors.button.secondary,
	};

	const handleGoogleSignIn = async () => {
		try {
			setIsLoading(true);
			setError('');
			setMessage('');

			Zotero.debug('DeepTutor Welcome: Attempting Google sign in');

			// Check if localhostServer is available
			if (!localhostServer) {
				throw new Error('Localhost server not available');
			}

			// Check if server is running
			if (!localhostServer.isServerRunning()) {
				throw new Error('Localhost server is not running. Please try again.');
			}

			// Enable the Google OAuth endpoint
			localhostServer.enableGoogleOAuth();
			console.log("🔐 DeepTutor Welcome: Google OAuth endpoint enabled");

			// Open the Google sign-in URL in browser
			const urlOpened = await localhostServer.openGoogleSignInUrl();

			if (urlOpened) {
				console.log("✅ DeepTutor Welcome: Google sign-in URL opened successfully");
				Zotero.debug("DeepTutor Welcome: Google sign-in URL opened successfully");
				setMessage('Google sign-in process started! Please complete authentication in your browser.');
			}
			else {
				console.error("❌ DeepTutor Welcome: Failed to open Google sign-in URL");
				Zotero.debug("DeepTutor Welcome: Failed to open Google sign-in URL");
				throw new Error('Failed to open Google sign-in URL');
			}

			// Call the simplified signInWithGoogle function (now just returns immediately)
			try {
				const _result = await signInWithGoogle();
				Zotero.debug('DeepTutor Welcome: signInWithGoogle called successfully');
				
				// The actual authentication will happen when the localhost server receives the OAuth code
				// We don't need to call onSignInSuccess here since it will be triggered by the auth state change
				// when the OAuth code is processed by the localhost server
				// Initialize empty Map for recent sessions
				const emptyMap = new Map();
				Zotero.Prefs.set('deeptutor.recentSessions', JSON.stringify(Object.fromEntries(emptyMap)));

				setMessage('Google sign-in URL opened! Please complete authentication in your browser. The sign-in will complete automatically once you finish the Google authentication.');
			}
			catch (signInError) {
				Zotero.debug(`DeepTutor Welcome: signInWithGoogle failed: ${signInError.message}`);
				// Don't throw here - the URL was opened successfully, so we just log the error
				console.warn("⚠️ DeepTutor Welcome: signInWithGoogle failed, but URL was opened:", signInError.message);
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutor Welcome: Google sign in failed: ${error.message}`);
			setError(`Google login failed: ${error.message}`);
		}
		finally {
			setIsLoading(false);
		}
	};

	return (
		<div style={styles.container}>
			{/* Background Images */}
			<img src={FolderImg} alt="Folder" style={styles.folderBg} />
			<img src={PageImg} alt="Page" style={styles.pageBg} />
			{/* Content Section */}
			<div style={styles.contentWrapper}>
				<div style={styles.mainTextWrapper}>
					<div style={styles.mainText}>Start Chatting with DeepTutor</div>
				</div>
				<div style={styles.subTextWrapper}>
					<div style={styles.subText}>Sign in to read papers more efficiently</div>
				</div>
				<div style={styles.descTextWrapper}>
					<div style={styles.descText}>
            Get accurate answers and deep summaries, and save<br />
            reading history to build a personalized learning tool.
					</div>
				</div>
				<div style={styles.buttonWrapper}>
					<button
						style={signInButtonStyle}
						onMouseEnter={handleSignInMouseEnter}
						onMouseLeave={handleSignInMouseLeave}
						onClick={onWelcomeSignIn}
						disabled={isLoading}
					>
            Sign in
					</button>
				</div>
				<div style={styles.buttonWrapper}>
					<button
						style={googleButtonStyle}
						onMouseEnter={handleGoogleMouseEnter}
						onMouseLeave={handleGoogleMouseLeave}
						onClick={handleGoogleSignIn}
						disabled={isLoading}
					>
						<img src={GoogleImg} alt="Google" style={styles.googleIcon} />
            Sign in with Google
					</button>
				</div>
				{error && <div style={styles.errorMessage}>{error}</div>}
				{message && <div style={styles.successMessage}>{message}</div>}
			</div>
		</div>
	);
}
