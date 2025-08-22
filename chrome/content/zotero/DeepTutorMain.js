import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';
import ModelSelection from './DeepTutorModelSelection.js';
import SessionHistory from './DeepTutorSessionHistory.js';
import DeepTutorChatBox from './DeepTutorChatBox.js';
import DeepTutorWelcomePane from './DeepTutorWelcomePane.js';
import DeepTutorSignIn from './DeepTutorSignIn.js';
import DeepTutorSubscription from './DeepTutorSubscription.js';
import DeepTutorTopSection from './DeepTutorTopSection.js';
import DeepTutorBottomSection from './DeepTutorBottomSection.js';
import DeepTutorUsagePopup from './DeepTutorUsagePopup.js';
import DeepTutorWorkspaceSetup from './DeepTutorWorkspaceSetup.js';
import DeepTutorNoSessionPane from './DeepTutorNoSessionPane.js';
import DeepTutorSessionDelete from './DeepTutorSessionDelete.js';
import DeepTutorRenameSession from './DeepTutorRenameSession.js';
import DeepTutorNoPDFWarning from './DeepTutorNoPDFWarning.js';
import DeepTutorFileSizeWarning from './DeepTutorFileSizeWarning.js';
import DeepTutorSubscriptionPopup from './DeepTutorSubscriptionPopup.js';
import { DT_BASE_URL } from './api/libs/api.js';


// Icon paths for popup close buttons
const PopupClosePath = 'chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg';
const PopupCloseDarkPath = 'chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg';

/**
 * Main display component for DeepTutor with theme integration
 */
const DeepTutorMain = (props) => {
	const { colors, isDark } = useDeepTutorTheme();

	// Theme-aware styles
	const styles = {
		container: {
			display: 'flex',
			flexDirection: 'column',
			height: '100%',
			width: '100%',
			background: colors.background.tertiary,
			fontFamily: 'Roboto, Inter, Arial, sans-serif',
			position: 'relative',
		},
		top: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '0.375rem 0.5rem 0.1875rem 0.5rem',
			minHeight: '4rem',
			background: colors.background.primary,
			borderBottom: `0.0625rem solid ${colors.border.primary}`,
		},
		logo: {
			height: '2rem',
			width: 'auto',
			display: 'block',
		},
		topRight: {
			display: 'flex',
			flexDirection: 'row',
			gap: '0.75rem',
		},
		iconButton: {
			all: 'revert',
			width: '2.5rem',
			height: '2.5rem',
			background: colors.background.quaternary,
			border: 'none',
			borderRadius: '0.375rem',
			cursor: 'pointer',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transition: 'background-color 0.2s ease',
			padding: '0.5rem',
		},
		iconButtonActive: {
			background: colors.border.quaternary,
		},
		iconImage: {
			width: '1.5rem',
			height: '1.5rem',
			objectFit: 'contain',
		},
		middle: {
			flex: 1,
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'flex-start',
			position: 'relative',
			background: colors.background.tertiary,
			minHeight: 0,
			width: '100%',
			padding: '0',
		},
		paneList: {
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'center',
			justifyContent: 'flex-start',
			position: 'relative',
			padding: '0',
		},
		bottom: {
			display: 'flex',
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '1.125rem 2rem 1.5rem 2rem',
			background: colors.background.primary,
			borderTop: `0.0625rem solid ${colors.border.primary}`,
		},
		bottomLeft: {
			display: 'flex',
			flexDirection: 'column',
			gap: '0.5rem',
		},
		textButton: {
			all: 'revert',
			background: colors.background.quaternary,
			border: 'none',
			color: colors.button.primary,
			fontWeight: 500,
			fontSize: '1em',
			fontFamily: 'Roboto, sans-serif',
			cursor: 'pointer',
			padding: '0.25rem 0.5rem',
			margin: 0,
			borderRadius: '0.25rem',
			width: 'fit-content',
			textAlign: 'left',
			display: 'flex',
			alignItems: 'center',
			gap: '0.5rem',
			transition: 'background-color 0.2s ease',
			':hover': {
				background: colors.border.quaternary
			}
		},
		buttonIcon: {
			width: '1rem',
			height: '1rem',
			objectFit: 'contain',
		},
		upgradeButton: {
			all: 'revert',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			height: '2.0625rem',
			minWidth: '2.0625rem',
			padding: '0 1.125rem',
			background: colors.button.primary,
			border: 'none',
			borderRadius: '0.5rem',
			fontWeight: 600,
			fontSize: '1em',
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
			padding: '0.25rem 0.5rem 0.5rem 0.5rem',
			marginBottom: '0.5rem',
			zIndex: 1000,
			minWidth: '12.5rem',
		},
		profileButtonContainer: {
			position: 'relative',
		},
		componentButton: {
			all: 'revert',
			padding: '0.375rem 1.125rem',
			borderRadius: '0.375rem',
			border: `1px solid ${colors.button.primary}`,
			background: '#FFFFFF',
			color: colors.button.primary,
			fontWeight: 600,
			cursor: 'pointer',
			fontFamily: 'Roboto, Inter, Arial, sans-serif',
			width: '100%',
			textAlign: 'left',
			marginBottom: '0.25rem',
			transition: 'all 0.2s ease',
			'&:hover': {
				background: colors.background.quaternary,
			},
		},
		componentButtonActive: {
			background: colors.button.primary,
			color: colors.button.primaryText,
		},
	};

	// Dynamic close button path based on theme
	const closeButtonPath = isDark ? PopupCloseDarkPath : PopupClosePath;

	// Calculate responsive widths for DeepTutor pane using windowWidth for reactivity
	let minWidth, maxWidth, defaultWidth;
	if (props.collapsed) {
		minWidth = '0';
		maxWidth = '0';
		defaultWidth = '0';
	}
	else {
		// Maximum width: 80% of window width
		maxWidth = `${props.windowWidth * 0.8}px`;

		// Default width: 1/3 of window width
		defaultWidth = `${props.windowWidth * 0.33}px`;
		// Minimum width: 360px
		minWidth = '360px';
	}

	const containerStyle = {
		...styles.container,
		width: props.collapsed ? '0' : defaultWidth,
		minWidth: minWidth,
		maxWidth: maxWidth,
		transition: 'all 0.3s ease-in-out',
		overflow: 'hidden',
		display: 'flex',
		flex: '1',
		flexDirection: 'column',
		height: '100%'
	};

	return (
		<div
			ref={props.containerRef}
			style={containerStyle}
			id="zotero-deep-tutor-pane"
			onClick={props.handleContainerClick}
		>
			<DeepTutorTopSection
				currentPane={props.currentPane}
				onSwitchPane={props.switchPane}
				onToggleModelSelectionPopup={props.toggleModelSelectionPopup}
			/>

			{/* Middle Section */}
			<div style={styles.middle}>
				<div style={styles.paneList}>
					{props.currentPane === 'main' && (
						<DeepTutorChatBox
							ref={props.tutorBoxRef}
							currentSession={props.currentSession}
							key={props.currentSession?.id}
							onSessionSelect={props.handleSessionSelect}
							onInitWaitChange={props.handleInitWaitChange}
						/>
					)}
					{props.currentPane === 'sessionHistory'
						&& <SessionHistory
							sessions={props.sessions}
							onSessionSelect={props.handleSessionSelect}
							isLoading={props.isLoading}
							error={props.error}
							onCreateNewSession={props.toggleModelSelectionPopup}
							onShowDeletePopup={props.handleShowDeletePopup}
							onRenameSession={props.handleShowRenamePopup}
						/>
					}
					{props.currentPane === 'noSession'
						&& <DeepTutorNoSessionPane onCreateNewSession={props.toggleModelSelectionPopup} />
					}
					{props.currentPane === 'modelSelection'
						&& <ModelSelection
							onSubmit={props.handleModelSelectionSubmit}
							user={props.userData}
							externallyFrozen={props.modelSelectionFrozen}
							onShowNoPDFWarning={props.openNoPDFWarningPopup}
							onShowFileSizeWarning={props.openFileSizeWarningPopup}
							subscriptionType={props.activeSubscription?.type || "BASIC"}
							usageSummary={props.usageSummary}
							hasActiveSubscription={Boolean(props.activeSubscription && props.activeSubscription.id)}
							onShowSubscriptionPopup={props.toggleSubscriptionPopup}
							refreshUsageSummary={props.refreshUsageSummary}
						/>
					}
					{props.currentPane === 'welcome'
						&& <DeepTutorWelcomePane
							onWelcomeSignIn={props.toggleSignInPopup}
							onSignInSuccess={props.handleSignInSuccess}
							localhostServer={props.localhostServer}
						/>
					}
				</div>
			</div>

			{/* Bottom Section */}
			<DeepTutorBottomSection
				currentPane={props.currentPane}
				onSwitchPane={props.switchPane}
				onToggleProfilePopup={props.toggleProfilePopup}
				onToggleSignInPopup={props.toggleSignInPopup}
				onToggleSignUpPopup={props.handleOpenSignUpPage}

				onToggleSubscriptionPopup={props.toggleSubscriptionPopup}
				onToggleUsagePopup={props.toggleUsagePopup}
				showProfilePopup={props.showProfilePopup}
				isAuthenticated={props.currentUser}
				currentUser={props.currentUser}
				onSignOut={props.handleSignOut}
				onSwitchNoSession={() => props.switchPane('noSession')}
				userData={props.userData}
				activeSubscription={props.activeSubscription}
				usageSummary={props.usageSummary}
				onRefreshUsageSummary={props.refreshUsageSummary}
			/>

			{/* Popups */}
			{props.showSignInPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						{/* Header */}
						<div style={{
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
						}}>
							Sign in
						</div>

						{/* Close button positioned at top right */}
						<button
							onClick={props.toggleSignInPopup}
							style={{
								all: 'revert',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								position: 'absolute',
								right: '1rem',
								top: '1rem',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>

						<DeepTutorSignIn
							onSignInSuccess={props.handleSignInSuccess}
							onSignInSignUp={props.handleOpenSignUpPage}
							onClose={props.toggleSignInPopup}
							localhostServer={props.localhostServer}
						/>
					</div>
				</div>
			)}

			{props.showUsagePopup && (
				<DeepTutorUsagePopup
					onClose={props.toggleUsagePopup}
					userId={props.userData && props.userData.id}
					activeSubscription={props.activeSubscription}
					usageSummary={props.usageSummary}
					onUpgrade={props.toggleSubscriptionPopup}
					onRefreshUsageSummary={props.refreshUsageSummary}
				/>
			)}

			{props.showWorkspaceSetupPopup && (
				<DeepTutorWorkspaceSetup
					onClose={props.toggleWorkspaceSetupPopup}
					onComplete={props.handleWorkspaceSetupComplete}
				/>
			)}

			{props.showDeletePopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
						borderRadius: '0.5rem',
					}}>
						<DeepTutorSessionDelete
							sessionToDelete={props.sessionToDelete}
							sessionName={props.sessionNameToDelete}
							onConfirmDelete={() => props.handleConfirmDelete(props.sessionToDelete)}
							onCancelDelete={props.handleCancelDelete}
						/>
					</div>
				</div>
			)}

			{props.showRenamePopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
						borderRadius: '0.5rem',
					}}>
						<DeepTutorRenameSession
							sessionId={props.sessionToRename}
							currentSessionName={props.sessionNameToRename}
							onConfirmRename={(_sessionId) => {
								props.handleRenameSuccess();
								props.handleCancelRename();
							}}
							onCancelRename={props.handleCancelRename}
						/>
					</div>
				</div>
			)}

			{props.showNoPDFWarningPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 2000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						<button
							onClick={props.closeNoPDFWarningPopup}
							style={{
								all: 'revert',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								position: 'absolute',
								right: '1rem',
								top: '1rem',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>
						<DeepTutorNoPDFWarning
							onClose={props.closeNoPDFWarningPopup}
						/>
					</div>
				</div>
			)}

			{props.showFileSizeWarningPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 2000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						<button
							onClick={props.closeFileSizeWarningPopup}
							style={{
								all: "revert",
								background: "none",
								border: "none",
								cursor: 'pointer',
								position: 'absolute',
								right: '1rem',
								top: '1rem',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>
						<DeepTutorFileSizeWarning
							onClose={props.closeFileSizeWarningPopup}
						/>
					</div>
				</div>
			)}

			{props.showSubscriptionConfirmPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						<button
							onClick={props.toggleSubscriptionConfirmPopup}
							style={{
								all: 'revert',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								position: 'absolute',
								right: 0,
								top: '50%',
								transform: 'translateY(-50%)',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>
						<DeepTutorSubscription
							onClose={props.toggleSubscriptionConfirmPopup}
							onSubscriptionStatusChange={props.handleSubscriptionStatusChange}
						/>
					</div>
				</div>
			)}

			{props.showSubscriptionPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 3000,
				}}>
					<DeepTutorSubscriptionPopup
						onClose={props.toggleSubscriptionPopup}
						onAction={(plan) => {
							// Open different URLs based on selected plan
							//let url = `http://localhost:3000/dzSubscription?plan=premium`;
							let url = `https://${DT_BASE_URL}/dzSubscription?plan=premium`;
							if (plan === 'pro') {
								//url = `http://localhost:3000/dzSubscription?plan=pro`;
								url = `https://${DT_BASE_URL}/dzSubscription?plan=pro`;
							}
							else if (plan === 'free') {
								// No external action for free; simply close
								props.toggleSubscriptionPopup();
								return;
							}

							try {
								Zotero.launchURL(url);
							}
							catch (error) {
								Zotero.debug(`DeepTutor: Error opening subscription URL: ${error.message}`);
								try {
									if (Zotero.Utilities && Zotero.Utilities.Internal && Zotero.Utilities.Internal.launchURL) {
										Zotero.Utilities.Internal.launchURL(url);
									}
									else {
										throw new Error('No launchURL available');
									}
								}
								catch (fallbackError) {
									Zotero.debug(`DeepTutor: Fallback launchURL failed: ${fallbackError.message}`);
									if (navigator.clipboard) {
										navigator.clipboard.writeText(url).then(() => {
											Zotero.alert(null, 'DeepTutor', 'Subscription URL copied to clipboard!');
										});
									}
									else {
										Zotero.alert(null, 'DeepTutor', `Please manually open this URL:\n${url}`);
									}
								}
							}
							finally {
								props.toggleSubscriptionPopup();
							}
						}}
						userId={props.userData && props.userData.id}
						activeSubscription={props.activeSubscription}
						onRefreshSubscription={props.refreshActiveSubscription}
					/>
				</div>
			)}
			{props.showManageSubscriptionPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						<button
							onClick={props.toggleManageSubscriptionPopup}
							style={{
								all: 'revert',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								position: 'absolute',
								right: 0,
								top: '50%',
								transform: 'translateY(-50%)',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>
						<DeepTutorSubscription
							onClose={props.toggleManageSubscriptionPopup}
							onSubscriptionStatusChange={props.handleSubscriptionStatusChange}
							isManageMode={true}
						/>
					</div>
				</div>
			)}

			{/* Model Selection Popup */}
			{props.showModelSelectionPopup && (
				<div style={{
					position: 'absolute',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000,
				}}>
					<div style={{
						background: colors.background.primary,
						borderRadius: '0.5rem',
						padding: '2rem',
						maxWidth: '24rem',
						width: '100%',
						position: 'relative',
						border: isDark ? `1px solid ${colors.popup.border}` : 'none',
					}}>
						{/* Header */}
						<div style={{
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
						}}>
							Create a new session
						</div>
						
						{/* Close button positioned at top right */}
						<button
							onClick={props.toggleModelSelectionPopup}
							style={{
								all: 'revert',
								background: 'none',
								border: 'none',
								cursor: 'pointer',
								position: 'absolute',
								right: '1rem',
								top: '1rem',
								width: '1rem',
								height: '1rem',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<img src={closeButtonPath} alt="Close" style={{ width: '1rem', height: '1rem' }} />
						</button>
						
						<ModelSelection
							onSubmit={props.handleModelSelectionSubmit}
							user={props.userData}
							externallyFrozen={props.modelSelectionFrozen}
							onShowNoPDFWarning={props.openNoPDFWarningPopup}
							onShowFileSizeWarning={props.openFileSizeWarningPopup}
							subscriptionType={props.activeSubscription?.type || "BASIC"}
							usageSummary={props.usageSummary}
							hasActiveSubscription={Boolean(props.activeSubscription && props.activeSubscription.id)}
							onShowSubscriptionPopup={props.toggleSubscriptionPopup}
							refreshUsageSummary={props.refreshUsageSummary}
						/>
					</div>
				</div>
			)}
		</div>
	);
};

DeepTutorMain.propTypes = {
	// State props
	currentPane: PropTypes.string.isRequired,
	currentSession: PropTypes.object,
	sessions: PropTypes.array.isRequired,
	isLoading: PropTypes.bool.isRequired,
	error: PropTypes.string,
	collapsed: PropTypes.bool.isRequired,
	windowWidth: PropTypes.number.isRequired,
	windowHeight: PropTypes.number.isRequired,

	// User props
	currentUser: PropTypes.object,
	userData: PropTypes.object,
	activeSubscription: PropTypes.object,
	usageSummary: PropTypes.object,

	// Popup state props
	showProfilePopup: PropTypes.bool.isRequired,
	showSignInPopup: PropTypes.bool.isRequired,
	showUsagePopup: PropTypes.bool.isRequired,
	showWorkspaceSetupPopup: PropTypes.bool,

	showModelSelectionPopup: PropTypes.bool.isRequired,
	showDeletePopup: PropTypes.bool.isRequired,
	showRenamePopup: PropTypes.bool.isRequired,
	showNoPDFWarningPopup: PropTypes.bool.isRequired,
	showFileSizeWarningPopup: PropTypes.bool.isRequired,
	showSubscriptionConfirmPopup: PropTypes.bool.isRequired,
	showManageSubscriptionPopup: PropTypes.bool.isRequired,
	showSubscriptionPopup: PropTypes.bool.isRequired,

	// Session props
	sessionToDelete: PropTypes.string,
	sessionNameToDelete: PropTypes.string,
	sessionToRename: PropTypes.string,
	sessionNameToRename: PropTypes.string,

	// Feature flags
	modelSelectionFrozen: PropTypes.bool.isRequired,
	localhostServer: PropTypes.object,

	// Refs
	containerRef: PropTypes.object.isRequired,
	tutorBoxRef: PropTypes.object.isRequired,

	// Event handlers
	handleContainerClick: PropTypes.func.isRequired,
	handleSessionSelect: PropTypes.func.isRequired,
	handleInitWaitChange: PropTypes.func.isRequired,
	handleModelSelectionSubmit: PropTypes.func.isRequired,
	handleSignInSuccess: PropTypes.func.isRequired,

	handleSignOut: PropTypes.func.isRequired,
	handleOpenSignUpPage: PropTypes.func.isRequired,

	handleShowDeletePopup: PropTypes.func.isRequired,
	handleConfirmDelete: PropTypes.func.isRequired,
	handleCancelDelete: PropTypes.func.isRequired,
	handleShowRenamePopup: PropTypes.func.isRequired,
	handleRenameSuccess: PropTypes.func.isRequired,
	handleCancelRename: PropTypes.func.isRequired,
	handleSubscriptionStatusChange: PropTypes.func.isRequired,
	refreshActiveSubscription: PropTypes.func.isRequired,
	refreshUsageSummary: PropTypes.func,

	// Toggle handlers
	switchPane: PropTypes.func.isRequired,
	toggleModelSelectionPopup: PropTypes.func.isRequired,
	toggleSignInPopup: PropTypes.func.isRequired,
	toggleUsagePopup: PropTypes.func.isRequired,
	toggleWorkspaceSetupPopup: PropTypes.func,

	toggleProfilePopup: PropTypes.func.isRequired,
	toggleRenamePopup: PropTypes.func.isRequired,
	openNoPDFWarningPopup: PropTypes.func.isRequired,
	closeNoPDFWarningPopup: PropTypes.func.isRequired,
	openFileSizeWarningPopup: PropTypes.func.isRequired,
	closeFileSizeWarningPopup: PropTypes.func.isRequired,
	toggleSubscriptionPopup: PropTypes.func.isRequired,
	toggleManageSubscriptionPopup: PropTypes.func.isRequired,
	toggleSubscriptionConfirmPopup: PropTypes.func.isRequired,
	handleWorkspaceSetupComplete: PropTypes.func,
};

export default DeepTutorMain;
