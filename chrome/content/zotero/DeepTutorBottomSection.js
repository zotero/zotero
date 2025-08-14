import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

// Icon path definitions
const FEED_ICON_PATH = 'chrome://zotero/content/DeepTutorMaterials/Bot/BOT_FEEDBACK.svg';
const FEED_ICON_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/Bot/BOT_FEEDBACK_DARK.svg';
const PERSON_ICON_PATH = 'chrome://zotero/content/DeepTutorMaterials/Bot/BOT_PROFILE.svg';
const PERSON_ICON_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/Bot/BOT_PROFILE_DARK.svg';

const DeepTutorBottomSection = (props) => {
	const { colors, isDark } = useDeepTutorTheme();
	const [isUpgradeHovered, setIsUpgradeHovered] = useState(false);
	const [isSignOutHovered, setIsSignOutHovered] = useState(false);

	// Choose icons based on theme
	const feedIconPath = isDark ? FEED_ICON_DARK_PATH : FEED_ICON_PATH;
	const personIconPath = isDark ? PERSON_ICON_DARK_PATH : PERSON_ICON_PATH;

	// Theme-aware styles
	const styles = {
		divider: {
			position: 'absolute',
			left: 0,
			right: 0,
			height: '0.0625rem',
			background: colors.border.quaternary,
		},
		bottom: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '1.5rem 1.25rem 1.25rem 1.25rem',
			background: colors.background.tertiary,
			width: '100%',
			boxSizing: 'border-box',
			position: 'relative',
			bottom: 0,
			left: 0,
			right: 0,
			margin: 0,
			zIndex: 1,
		},
		contentWrapper: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'flex-start',
			width: '100%',
			gap: '0.3125rem',
		},
		bottomLeft: {
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			gap: '0.3125rem',
			width: '100%',
			marginTop: '0.625rem',
		},
		feedbackBox: {
			display: 'flex',
			alignItems: 'center',
			width: '100%',
			marginBottom: '0.3125rem',
		},
		buttonsBox: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			width: '100%',
		},
		textButton: {
			background: colors.background.tertiary,
			border: 'none',
			color: colors.text.allText,
			fontWeight: 500,
			fontSize: '1rem',
			lineHeight: '100%',
			letterSpacing: '0%',
			fontFamily: 'Roboto, sans-serif',
			cursor: 'pointer',
			padding: '0.5rem 1rem',
			margin: 0,
			borderRadius: '0.25rem',
			width: 'fit-content',
			textAlign: 'left',
			display: 'flex',
			alignItems: 'center',
			gap: '0.5rem',
			transition: 'background-color 0.2s ease',
			textDecoration: 'underline',
			':hover': {
				background: colors.border.quaternary
			}
		},
		buttonIcon: {
			width: '1.1rem',
			height: '1.1rem',
			objectFit: 'contain',
		},
		upgradeButton: {
			all: 'revert',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			width: '7rem',
			height: '3rem',
			padding: '0.625rem 1.25rem',
			background: colors.button.primary,
			border: 'none',
			borderRadius: '0.625rem',
			fontWeight: 600,
			fontSize: '1rem',
			color: colors.button.primaryText,
			cursor: 'pointer',
			boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.03)',
			transition: 'background 0.2s',
			fontFamily: 'Roboto, sans-serif',
		},
		profilePopup: {
			position: 'absolute',
			bottom: '100%',
			left: 0,
			background: colors.background.primary,
			borderRadius: '0.5rem',
			boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.15)',
			padding: '0.75rem',
			marginBottom: '0.5rem',
			zIndex: 1000,
			minWidth: '12.5rem',
		},
		profileButtonContainer: {
			position: 'relative',
		},
		componentButton: {
			padding: '0.375rem 1.125rem',
			borderRadius: '0.375rem',
			border: `1px solid ${colors.button.primary}`,
			background: '#FFFFFF',
			color: colors.button.primary,
			fontWeight: 500,
			cursor: 'pointer',
			fontFamily: 'Roboto, Inter, Arial, sans-serif',
			width: '100%',
			textAlign: 'left',
			marginBottom: '0.25rem',
			transition: 'all 0.2s ease',
		},
		componentButtonActive: {
			background: colors.button.primary,
			color: colors.button.primaryText,
		},
		profileInfo: {
			padding: '0.5rem 0',
			borderBottom: `0.0625rem solid ${colors.border.primary}`,
			marginBottom: '0.5rem',
		},
		userEmail: {
			fontSize: '1rem',
			fontWeight: 500,
			color: colors.text.secondary,
			marginBottom: '0.25rem',
		},
		userStatus: {
			fontSize: '0.875rem',
			color: colors.text.tertiary,
		},
		signOutButton: {
			background: colors.error,
			color: colors.text.inverse,
			border: 'none',
			borderRadius: '0.375rem',
			padding: '0.375rem 0.75rem',
			fontSize: '1rem',
			fontWeight: 600,
			cursor: 'pointer',
			width: '100%',
			minHeight: '3rem',
			marginTop: '0.5rem',
			transition: 'background 0.2s',
		},
	};

	// Temporarily hide subscription button - set to true to show it again
	const showSubscriptionButton = false;

	const handleUpgradeMouseEnter = () => {
		setIsUpgradeHovered(true);
	};

	const handleUpgradeMouseLeave = () => {
		setIsUpgradeHovered(false);
	};

	const renderProfilePopup = () => {
		if (!props.showProfilePopup) return null;

		// Determine display name/email - prioritizing email first
		let displayName = 'User';
		if (props.userData) {
			const { name, firstName, lastName, email } = props.userData;
			if (email) {
				displayName = email;
			}
			else if (name && name.trim()) {
				displayName = name;
			}
			else if ((firstName || lastName)) {
				displayName = `${firstName || ''} ${lastName || ''}`.trim();
			}
		}
		else if (props.currentUser) {
			// Cognito user object may expose username/email differently - prioritizing email first
			displayName = (props.currentUser.email
                 || props.currentUser.username
                 || (typeof props.currentUser.getUsername === 'function' && props.currentUser.getUsername())
                 || displayName);
		}

		return (
			<div style={styles.profilePopup} onClick={e => e.stopPropagation()}>
				{props.isAuthenticated
					? (
						<>
							<div style={styles.profileInfo}>
								<div style={styles.userEmail}>{displayName}</div>
								<div style={styles.userStatus}>Logged in</div>
							</div>
							<button
								style={{
									...styles.signOutButton,
									background: isSignOutHovered ? '#dc3545' : colors.error
								}}
								onClick={props.onSignOut}
								onMouseEnter={() => setIsSignOutHovered(true)}
								onMouseLeave={() => setIsSignOutHovered(false)}
							>
                             Sign out
							</button>
						</>
					)
					: (
						<div style={styles.profileInfo}>
							<div style={styles.userStatus}>Not logged in</div>
							<button
								style={{ ...styles.componentButton, marginTop: '8px' }}
								onClick={props.onToggleSignInPopup}
							>
                             Sign in
							</button>
						</div>
					)}
			</div>
		);
	};

	const renderMain = () => {
		const upgradeButtonDynamicStyle = {
			...styles.upgradeButton,
			background: isUpgradeHovered ? colors.button.hover : colors.button.primary,
		};

		// Determine button text based on subscription status
		let buttonText = "Upgrade";
		if (props.userSubscribed) {
			buttonText = "Premium";
		}
		else if (props.isFreeTrial) {
			buttonText = "Start Trial";
		}

		return (
			<div style={styles.contentWrapper}>
				<div style={styles.divider} />
				<div style={styles.bottomLeft}>
					<div style={styles.feedbackBox}>
						<button
							style={styles.textButton}
							onClick={() => {
								Zotero.debug("DeepTutor: Feedback button clicked");
								const url = 'https://docs.google.com/forms/d/e/1FAIpQLSfgLdhUz79oBsNTIF_rD3hEw5pCTbXOOGfi1UBKViiVgFjI-A/viewform?usp=dialog';
								Zotero.debug(`DeepTutor: Attempting to open feedback URL: ${url}`);
                                 
								try {
									// Primary: Use Zotero's proper API for opening external URLs
									Zotero.debug("DeepTutor: Trying primary method - Zotero.launchURL");
									Zotero.launchURL(url);
									Zotero.debug("DeepTutor: Successfully called Zotero.launchURL");
								}
								catch (error) {
									Zotero.debug(`DeepTutor: Primary method failed - Zotero.launchURL: ${error.message}`);
                                     
									// Fallback 1: Try Zotero.Utilities.Internal.launchURL
									try {
										if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.launchURL) {
											Zotero.debug("DeepTutor: Trying Fallback 1 - Zotero.Utilities.Internal.launchURL");
											Zotero.Utilities.Internal.launchURL(url);
											Zotero.debug("DeepTutor: Successfully called Zotero.Utilities.Internal.launchURL");
										}
										else {
											throw new Error("Zotero.Utilities.Internal.launchURL not available");
										}
									}
									catch (fallback1Error) {
										Zotero.debug(`DeepTutor: Fallback 1 failed - Zotero.Utilities.Internal.launchURL: ${fallback1Error.message}`);
                                         
										// Fallback 2: Try Zotero.HTTP.loadDocuments
										try {
											if (Zotero.HTTP && Zotero.HTTP.loadDocuments) {
												Zotero.debug("DeepTutor: Trying Fallback 2 - Zotero.HTTP.loadDocuments");
												Zotero.HTTP.loadDocuments([url]);
												Zotero.debug("DeepTutor: Successfully called Zotero.HTTP.loadDocuments");
											}
											else {
												throw new Error("Zotero.HTTP.loadDocuments not available");
											}
										}
										catch (fallback2Error) {
											Zotero.debug(`DeepTutor: Fallback 2 failed - Zotero.HTTP.loadDocuments: ${fallback2Error.message}`);
                                             
											// Fallback 3: Try XPCOM nsIExternalProtocolService
											try {
												if (typeof Cc !== 'undefined' && typeof Ci !== 'undefined') {
													Zotero.debug("DeepTutor: Trying Fallback 3 - XPCOM nsIExternalProtocolService (using Cc/Ci shortcuts)");
													const extps = Cc["@mozilla.org/uriloader/external-protocol-service;1"]
                                                         .getService(Ci.nsIExternalProtocolService);
													const uri = Cc["@mozilla.org/network/io-service;1"]
                                                         .getService(Ci.nsIIOService)
                                                         .newURI(url, null, null);
													extps.loadURI(uri);
													Zotero.debug("DeepTutor: Successfully opened URL via XPCOM nsIExternalProtocolService");
												}
												else {
													throw new Error("XPCOM Cc/Ci shortcuts not available");
												}
											}
											catch (fallback3Error) {
												Zotero.debug(`DeepTutor: Fallback 3 failed - XPCOM nsIExternalProtocolService: ${fallback3Error.message}`);
                                                 
												// Final fallback: Copy URL to clipboard
												if (navigator.clipboard) {
													Zotero.debug("DeepTutor: Trying final fallback - copy URL to clipboard");
													navigator.clipboard.writeText(url)
                                                         .then(() => {
                                                         	Zotero.debug("DeepTutor: Successfully copied feedback URL to clipboard");
                                                         	Zotero.alert(null, "DeepTutor", 'Feedback form URL copied to clipboard!\nPlease paste it in your browser to access the form.');
                                                         })
                                                         .catch((clipboardError) => {
                                                         	Zotero.debug(`DeepTutor: Failed to copy to clipboard: ${clipboardError.message}`);
                                                         	Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
                                                         });
												}
												else {
													Zotero.debug("DeepTutor: Clipboard API not available, showing alert with URL");
													Zotero.alert(null, "DeepTutor", `Please manually visit this URL:\n${url}`);
												}
											}
										}
									}
								}
							}}
						>
							<img src={feedIconPath} alt="Give Us Feedback" style={styles.buttonIcon} />
							<span style={{ textDecoration: 'underline' }}>Give Us Feedback</span>
						</button>
					</div>
					<div style={styles.buttonsBox}>
						<div style={styles.profileButtonContainer}>
							<button style={styles.textButton} onClick={(e) => {
								e.stopPropagation();
								props.onToggleProfilePopup();
							}}>
								<img src={personIconPath} alt="Profile" style={styles.buttonIcon} />
								<span style={{ textDecoration: 'underline' }}>Profile</span>
							</button>
							{renderProfilePopup()}
						</div>
						{/* Temporarily hide subscription button - set to true to show it again */}
						{showSubscriptionButton && (
							<button
								style={upgradeButtonDynamicStyle}
								onClick={props.onToggleSubscriptionPopup}
								onMouseEnter={handleUpgradeMouseEnter}
								onMouseLeave={handleUpgradeMouseLeave}
							>
								{buttonText}
							</button>
						)}
					</div>
				</div>
			</div>
		);
	};

	const renderWelcome = () => {
		return (
			<div style={styles.contentWrapper}>
			</div>
		);
	};

	const renderSessionHistory = () => {
		return renderMain();
	};

	let content;
	if (props.currentPane === 'welcome') {
		content = renderWelcome();
	}
	else if (props.currentPane === 'main') {
		content = renderMain();
	}
	else if (props.currentPane === 'sessionHistory') {
		content = renderSessionHistory();
	}
	else {
		content = renderMain();
	}
	return (
		<div style={styles.bottom}>
			{content}
		</div>
	);
};

DeepTutorBottomSection.propTypes = {
	currentPane: PropTypes.string.isRequired,
	onSwitchPane: PropTypes.func.isRequired,
	onToggleProfilePopup: PropTypes.func.isRequired,
	onToggleSignInPopup: PropTypes.func.isRequired,
	onToggleSignUpPopup: PropTypes.func.isRequired,

	onToggleSubscriptionPopup: PropTypes.func.isRequired,
	showProfilePopup: PropTypes.bool.isRequired,
	isAuthenticated: PropTypes.bool,
	currentUser: PropTypes.object,
	onSignOut: PropTypes.func,
	onSwitchNoSession: PropTypes.func,
	userData: PropTypes.object,
	userSubscribed: PropTypes.bool,
	isFreeTrial: PropTypes.bool
};

DeepTutorBottomSection.defaultProps = {
	isAuthenticated: false,
	currentUser: null,
	onSignOut: () => {},
	userData: null,
	userSubscribed: false,
	isFreeTrial: true
};

export default DeepTutorBottomSection;
