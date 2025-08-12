import React, { useState } from 'react'; // eslint-disable-line no-unused-vars
import PropTypes from 'prop-types';
import { useDeepTutorTheme } from './theme/useDeepTutorTheme.js';

// Icon path definitions
const PLUS_ICON_PATH = 'chrome://zotero/content/DeepTutorMaterials/NoSession/NOS_WHITE_PLUS.svg';
const PLUS_ICON_DARK_PATH = 'chrome://zotero/content/DeepTutorMaterials/NoSession/NOS_DARK_PLUS.svg';

const DeepTutorNoSessionPane = ({ onCreateNewSession }) => {
	const { colors, isDark } = useDeepTutorTheme();
	const [isHovered, setIsHovered] = useState(false);

	// Choose plus icon based on theme
	const plusIconPath = isDark ? PLUS_ICON_DARK_PATH : PLUS_ICON_PATH;

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
			fontSize: '1.25rem',
			lineHeight: '135%',
			letterSpacing: '0%',
			textAlign: 'center',
			color: colors.text.allText,
		},
		createSessionButton: {
			all: 'revert',
			background: colors.button.primary,
			color: colors.button.primaryText,
			fontWeight: 500,
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
			gap: '0.5rem',
		},
		plusIcon: {
			width: '1.25rem',
			height: '1.25rem',
			color: colors.button.primaryText,
		},
	};

	const handleMouseEnter = () => setIsHovered(true);
	const handleMouseLeave = () => setIsHovered(false);

	const buttonStyle = {
		...styles.createSessionButton,
		background: isHovered ? colors.button.hover : colors.button.primary,
	};

	const FolderImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_FOLDER.svg';
	const PageImg = 'chrome://zotero/content/DeepTutorMaterials/Welcome/WELCOME_PAGE.svg';

	return (
		<div style={styles.container}>
			{/* Background Images */}
			<img src={FolderImg} alt="Folder" style={styles.folderBg} />
			<img src={PageImg} alt="Page" style={styles.pageBg} />
			{/* Content Section */}
			<div style={styles.contentWrapper}>
				<div style={styles.mainTextWrapper}>
					<div style={styles.mainText}>Begin Your DeepTutor Journey</div>
				</div>
				<div style={styles.subTextWrapper}>
					<div style={styles.subText}>Create a session to chat with our AI tutor</div>
				</div>
				<div style={styles.descTextWrapper}>
					<div style={styles.descText}>
          Get accurate answers and deep summaries, and save<br />
          reading history to build a personalized learning tool.
					</div>
				</div>
				<div style={styles.buttonWrapper}>
					<button
						style={buttonStyle}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
						onClick={onCreateNewSession}
					>
            Create a New Session
						<img src={plusIconPath} alt="Plus" style={styles.plusIcon} />
					</button>
				</div>
			</div>
		</div>
	);
};

DeepTutorNoSessionPane.propTypes = {
	onCreateNewSession: PropTypes.func.isRequired,
};

export default DeepTutorNoSessionPane;
