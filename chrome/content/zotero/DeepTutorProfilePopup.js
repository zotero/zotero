import React from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

// Icon paths for light and dark themes
const ICON_PATHS = {
	person: {
		light: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_person.svg",
		dark: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_person_dark.svg"
	},
	manage: {
		light: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_manage.svg",
		dark: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_manage_dark.svg"
	},
	usage: {
		light: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_usage.svg",
		dark: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_usage_dark.svg"
	},
	signout: {
		light: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_signout.svg",
		dark: "chrome://zotero/content/DeepTutorMaterials/Profile/profile_signout_dark.svg"
	}
};

/**
 * DeepTutorProfilePopup Component
 * Profile popup with 4 vertically stacked sections following AccountPopup.tsx pattern:
 * 1) Person row (person icon, email text, check icon) — gray and not clickable
 * 2) Manage Subscription — button row
 * 3) Usage — button row
 * 4) Sign Out — button row
 *
 * Supports both light and dark themes with reverse colors and SVG icons
 */
function DeepTutorProfilePopup({
	onManageSubscription,
	onShowUsage,
	onSignOut,
	userData,
	currentUser
}) {
	const { colors, isDark } = useDeepTutorTheme();

	// Choose icons based on theme
	const getIconPath = (iconName) => {
		return isDark ? ICON_PATHS[iconName].dark : ICON_PATHS[iconName].light;
	};

	// Fixed column for leading icons to ensure alignment across rows
	const leadingIconStyle = { height: "1.25rem", width: "1.25rem", flexShrink: 0 };



	// Determine display name/email - prioritizing email first
	const getDisplayName = () => {
		if (userData) {
			const { name, firstName, lastName, email } = userData;
			if (email) {
				return email;
			}
			if (name && name.trim()) {
				return name;
			}
			if (firstName || lastName) {
				return `${firstName || ""} ${lastName || ""}`.trim();
			}
		}
		if (currentUser) {
			// Cognito user object may expose username/email differently - prioritizing email first
			return (currentUser.email
				|| currentUser.username
				|| (typeof currentUser.getUsername === "function" && currentUser.getUsername())
				|| "User");
		}
		return "User";
	};

	// Theme-aware styles
	const styles = {
		wrapper: {
			position: "absolute",
			bottom: "0",
			left: "0",
			marginTop: "0.5rem",
			zIndex: 50,
			width: "auto",
			minWidth: "14rem",
			maxWidth: "24rem",
			overflow: "visible",
			borderRadius: "0.5rem",
			border: `1px solid ${isDark ? colors.border.primary : "#BDBDBD"}`,
			background: colors.background.primary,
			boxShadow: "0 4px 8px rgba(0,0,0,0.08)"
		},
		content: {
			display: "flex",
			flexDirection: "column",
			padding: "0.75rem",
			paddingRight: "1rem"
		},
		// Person row (non-clickable)
		personRow: {
			display: "flex",
			alignItems: "center",
			padding: "0.125rem 0.5rem",
			paddingTop: "0.375rem",
			paddingBottom: "0.375rem",
			paddingLeft: "0.375rem"
		},
		personContent: {
			display: "flex",
			flexGrow: 1,
			alignItems: "center",
			justifyContent: "space-between"
		},
		personText: {
			marginLeft: "0.75rem",
			fontFamily: "Roboto, sans-serif",
			fontSize: "1rem",
			fontWeight: 400,
			color: isDark ? colors.text.tertiary : "#6B7280"
		},
		checkIcon: {
			marginLeft: "0.75rem",
			height: "1.25rem",
			width: "1.25rem"
		},
		// Button styles
		button: {
			display: "flex",
			width: "100%",
			alignItems: "center",
			borderRadius: "0.25rem",
			padding: "0.125rem 0.5rem",
			paddingTop: "0.375rem",
			paddingBottom: "0.375rem",
			textAlign: "left",
			border: "none",
			background: "transparent",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif",
			fontSize: "1rem",
			fontWeight: 400,
			color: colors.text.primary,
			transition: "background-color 0.2s ease"
		},
		buttonHover: {
			background: isDark ? colors.background.tertiary : "#F3F4F6"
		},
		buttonText: {
			marginLeft: "0.75rem"
		},
		// Spacing between buttons
		buttonSpacing: {
			marginTop: "0.25rem"
		}
	};

	return (
		<div
			id="deeptutor-profile-popup"
			style={styles.wrapper}
		>
			<div style={styles.content}>
				{/* Person row (non-clickable) */}
				<div style={styles.personRow}>
					<img
						src={getIconPath("person")}
						alt="Person"
						style={leadingIconStyle}
					/>
					<div style={styles.personContent}>
						<span style={styles.personText}>
							{getDisplayName()}
						</span>
						<img
							src="chrome://zotero/content/DeepTutorMaterials/Profile/check.svg"
							alt="Check"
							style={styles.checkIcon}
						/>
					</div>
				</div>

				{/* Manage Subscription */}
				<button
					type="button"
					style={styles.button}
					onClick={onManageSubscription}
					onMouseEnter={(e) => {
						e.target.style.background = styles.buttonHover.background;
					}}
					onMouseLeave={(e) => {
						e.target.style.background = "transparent";
					}}
				>
					<img
						src={getIconPath("manage")}
						alt="Manage"
						style={leadingIconStyle}
					/>
					<span style={styles.buttonText}>
						Manage Subscription
					</span>
				</button>

				{/* Usage */}
				<button
					type="button"
					style={{ ...styles.button, ...styles.buttonSpacing }}
					onClick={onShowUsage}
					onMouseEnter={(e) => {
						e.target.style.background = styles.buttonHover.background;
					}}
					onMouseLeave={(e) => {
						e.target.style.background = "transparent";
					}}
				>
					<img
						src={getIconPath("usage")}
						alt="Usage"
						style={leadingIconStyle}
					/>
					<span style={styles.buttonText}>
						Usage
					</span>
				</button>

				{/* Sign Out */}
				<button
					type="button"
					style={{ ...styles.button, ...styles.buttonSpacing }}
					onClick={onSignOut}
					onMouseEnter={(e) => {
						e.target.style.background = styles.buttonHover.background;
					}}
					onMouseLeave={(e) => {
						e.target.style.background = "transparent";
					}}
				>
					<img
						src={getIconPath("signout")}
						alt="Sign Out"
						style={leadingIconStyle}
					/>
					<span style={styles.buttonText}>
						Sign Out
					</span>
				</button>
			</div>
		</div>
	);
}

// PropTypes for component validation
DeepTutorProfilePopup.propTypes = {

	/** Callback to close the popup */
	onClose: PropTypes.func,

	/** Callback to manage subscription (will redirect to Stripe portal) */
	onManageSubscription: PropTypes.func.isRequired,

	/** Callback to open usage popup */
	onShowUsage: PropTypes.func.isRequired,

	/** Callback to sign out the current user */
	onSignOut: PropTypes.func.isRequired,

	/** User data object containing name, email, etc. */
	userData: PropTypes.object,

	/** Current authenticated user object */
	currentUser: PropTypes.object
};

export default DeepTutorProfilePopup;


