import React from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

// Icon path definitions
const LOGO_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_DPTLOGO.svg';
const LOGO_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_DPTLOGO_DARK.svg';
const HISTORY_ICON_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_HISTORY_NEW.svg';
const HISTORY_ICON_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_HISTORY_DARK.svg';
const PLUS_ICON_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_NEW.svg';
const PLUS_ICON_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/Top/TOP_NEW_DARK.svg';

const styles = {
	top: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '1.25rem 1.25rem 1.875rem 1.25rem',
		minHeight: '4rem',
		background: '#F2F2F2',
		width: '100%',
		boxSizing: 'border-box',
	},
	welcomeTop: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		padding: '1.25rem 1.25rem 1.875rem 1.25rem',
		minHeight: '4rem',
		background: '#F2F2F2',
		width: '100%',
		boxSizing: 'border-box',
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
		height: '1.75rem',
		alignItems: 'center',
	},
	iconButton: {
		width: '2.5rem',
		height: '2.5rem',
		background: '#F2F2F2',
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
		background: '#F2F2F2',
	},
	iconImage: {
		width: '1.0625rem',
		height: '1.0625rem',
		objectFit: 'contain',
	},
	contentWrapper: {
		display: 'flex',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		width: '100%',
		height: '1.75rem',
	},
};

const DeepTutorTopSection = (props) => {
	const { colors, isDark } = useDeepTutorTheme();
	
	// Choose logo based on theme
	const logoPath = isDark ? LOGO_DARK_PATH : LOGO_PATH;
	
	// Choose icons based on theme
	const historyIconPath = isDark ? HISTORY_ICON_DARK_PATH : HISTORY_ICON_PATH;
	const plusIconPath = isDark ? PLUS_ICON_DARK_PATH : PLUS_ICON_PATH;
	
	// Theme-aware styles
	const themeStyles = {
		top: {
			...styles.top,
			background: colors.background.tertiary,
			color: colors.text.allText,
		},
		welcomeTop: {
			...styles.welcomeTop,
			background: colors.background.tertiary,
			color: colors.text.allText,
		},
		iconButton: {
			...styles.iconButton,
			background: colors.background.tertiary,
			color: colors.text.allText,
		},
		iconButtonActive: {
			...styles.iconButtonActive,
			background: colors.background.tertiary,
			color: colors.text.allText,
		},
	};
	
	const getIconButtonStyle = (isActive) => {
		return {
			...themeStyles.iconButton,
			...(isActive ? themeStyles.iconButtonActive : {})
		};
	};

	const renderMain = () => {
		return (
			<div style={styles.contentWrapper}>
				<img src={logoPath} alt="DeepTutor Logo" style={styles.logo} />
				<div style={styles.topRight}>
					<button
						style={getIconButtonStyle(props.currentPane === 'sessionHistory')}
						onClick={() => props.onSwitchPane('sessionHistory')}
						title="Session History"
					>
						<img
							src={historyIconPath}
							alt="History"
							style={styles.iconImage}
						/>
					</button>
					<button
						style={getIconButtonStyle(props.currentPane === 'modelSelection')}
						onClick={props.onToggleModelSelectionPopup}
						title="Create New Session"
					>
						<img
							src={plusIconPath}
							alt="New Session"
							style={styles.iconImage}
						/>
					</button>
				</div>
			</div>
		);
	};

	const renderWelcome = () => {
		return (
			<div style={styles.contentWrapper}>
				<img src={logoPath} alt="DeepTutor Logo" style={styles.logo} />
			</div>
		);
	};

	const renderSessionHistory = () => {
		return (
			<div style={styles.contentWrapper}>
				<img src={logoPath} alt="DeepTutor Logo" style={styles.logo} />
			</div>
		);
	};

	let content;
	if (props.currentPane === 'main') {
		content = renderMain();
	}
	else if (props.currentPane === 'welcome') {
		content = renderWelcome();
	}
	else if (props.currentPane === 'sessionHistory') {
		content = renderSessionHistory();
	}
	else {
		// fallback to main design for other panes
		content = renderMain();
	}
	
	return (
		<div style={props.currentPane === 'welcome' ? themeStyles.welcomeTop : themeStyles.top}>
			{content}
		</div>
	);
};

DeepTutorTopSection.propTypes = {
	currentPane: PropTypes.string.isRequired,
	onSwitchPane: PropTypes.func.isRequired,
	onToggleModelSelectionPopup: PropTypes.func.isRequired,
};

export default DeepTutorTopSection;
