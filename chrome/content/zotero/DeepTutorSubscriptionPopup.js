import React, { useEffect, useState } from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";
import { getActiveUserSubscriptionByUserId, DT_BASE_URL } from "./api/libs/api.js";
import DeepTutorProcessingSubscription from "./DeepTutorProcessingSubscription.js";
import DeepTutorSubscriptionConfirm from "./DeepTutorSubscriptionConfirm.js";

// Close icon paths (match other popups)
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg";
const PopupCloseDarkPath = "chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg";

// Arrow icon paths for upgrade buttons
const ArrowForwardPath = "chrome://zotero/content/DeepTutorMaterials/Subscription/arrow_forward.svg";
const ArrowForwardDarkPath = "chrome://zotero/content/DeepTutorMaterials/Subscription/arrow_forward_dark.svg";
const SubscriptionConfirmBookPath = "chrome://zotero/content/DeepTutorMaterials/Subscription/SUB_SUCCESS.svg";

/**
 * DeepTutorSubscriptionPopup
 * Popup to select plan: Free, Pro, Premium. Each tab shows different content and action.
 */
export default function DeepTutorSubscriptionPopup({ onClose, onAction: _onAction, userId, activeSubscription }) {
	const { colors, isDark } = useDeepTutorTheme();
	const closePath = isDark ? PopupCloseDarkPath : PopupClosePath;
	const [currentPlan, setCurrentPlan] = useState(null); // 'free' | 'pro' | 'premium' | null
	const [currentPanel, setCurrentPanel] = useState("select"); // "select" | "processing" | "confirm"

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				if (!userId) {
					setCurrentPlan("free");
					return;
				}
				
				// Use activeSubscription prop if available, otherwise fetch from API
				let active = activeSubscription;
				if (!active) {
					active = await getActiveUserSubscriptionByUserId(userId);
				}
				
				if (!mounted) return;
				
				// Determine current plan from subscription type
				if (active && active.type) {
					const subscriptionType = active.type.toUpperCase();
					if (subscriptionType === "PREMIUM") {
						setCurrentPlan("premium");
					}
					else if (subscriptionType === "PLUS") {
						setCurrentPlan("pro");
					}
					else if (subscriptionType === "BASIC") {
						setCurrentPlan("free");
					}
					else {
						setCurrentPlan("free");
					}
				}
				else {
					setCurrentPlan("free");
				}
			}
			catch {
				if (mounted) setCurrentPlan("free");
			}
		})();
		return () => {
			mounted = false;
		};
	}, [userId, activeSubscription]);
	const [activeTab, setActiveTab] = useState("pro"); // "free" | "pro" | "premium"

	// Open external subscription URL
	const openSubscriptionUrl = (url) => {
		Zotero.launchURL(url);
	};

	const handleProcessingContinue = async () => {
		try {
			Zotero.debug("DeepTutorSubscriptionPopup: Checking user subscription status after processing");
			const active = userId ? await getActiveUserSubscriptionByUserId(userId) : null;
			const hasActiveSubscription = !!active;
			Zotero.debug(`DeepTutorSubscriptionPopup: Active subscription check result: ${hasActiveSubscription}`);
			if (hasActiveSubscription) {
				setCurrentPanel("confirm");
			}
			else {
				setCurrentPanel("select");
			}
		}
		catch (error) {
			Zotero.debug(`DeepTutorSubscriptionPopup: Error checking subscription status: ${error.message}`);
			setCurrentPanel("select");
		}
	};

	const styles = {
		container: {
			background: colors.background.primary,
			borderRadius: "0.5rem",
			padding: "2rem 2rem 1rem 2rem",
			maxWidth: "28rem",
			width: "100%",
			position: "relative",
			boxSizing: "border-box",
			fontFamily: "Roboto, sans-serif",
			border: isDark ? "1px solid #0687E5" : "none"
		},
		title: {
			width: "100%",
			textAlign: "center",
			background: "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)",
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
			color: "#0687E5",
			fontWeight: 700,
			fontSize: "1.5rem",
			lineHeight: "1.2",
			letterSpacing: "0%",
			marginBottom: "1.25rem"
		},
		closeButton: {
			all: "revert",
			background: "none",
			border: "none",
			cursor: "pointer",
			position: "absolute",
			right: "1rem",
			top: "1rem",
			width: "1rem",
			height: "1rem",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		tabs: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 0,
			marginBottom: "1rem",
			width: "90%",
			marginLeft: "auto",
			marginRight: "auto"
		},
		tab: {
			flex: 1,
			padding: "0.5rem 0.75rem",
			textAlign: "center",
			borderRadius: "0.375rem",
			cursor: "pointer",
			fontWeight: 400,
			fontSize: "16px",
			fontFamily: "Roboto, sans-serif",
			background: isDark ? "#2B2B2B" : "#F8F6F7",
			color: isDark ? "#BBBBBB" : "#757575",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		tabActive: {
			background: isDark ? "#4A4A4A" : "#D9D9D9",
			color: isDark ? "#FFFFFF" : "#000000"
		},
		content: {
			display: "flex",
			flexDirection: "column",
			gap: "0.75rem",
			marginBottom: "1rem"
		},
		planHeaderRow: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			gap: "0.5rem",
			width: "100%",
			marginBottom: "0.25rem"
		},
		planTitle: {
			color: isDark ? "#FFFFFF" : "#292929",
			fontWeight: 500,
			fontSize: "1.25rem",
			lineHeight: "1.4375rem",
			textAlign: "left",
			fontFamily: "Roboto, sans-serif"
		},
		bestDealBadge: {
			background: "#0687E5",
			color: "#FFFFFF",
			fontWeight: 700,
			fontSize: "12px",
			padding: "2px 6px",
			borderRadius: "0.375rem"
		},
		priceRow: {
			display: "flex",
			flexDirection: "row",
			alignItems: "baseline",
			gap: "0.5rem",
			marginTop: 0,
			marginBottom: 0
		},
		price: {
			fontWeight: 700,
			fontSize: "4rem",
			color: colors.text.allText,
			margin: 0,
			display: "flex",
			alignItems: "center",
			fontFamily: "Roboto, sans-serif"
		},
		monthly: {
			color: "#757575",
			fontWeight: 400,
			fontSize: "1rem",
			margin: 0,
			fontFamily: "Roboto, sans-serif"
		},
		featureList: {
			display: "flex",
			flexDirection: "column",
			gap: "0.375rem"
		},
		feature: {
			fontSize: "0.9rem",
			lineHeight: "1.375rem",
			color: colors.text.allText,
			fontWeight: 500,
			fontFamily: "Roboto, sans-serif"
		},
		footer: {
			display: "flex",
			flexDirection: "row",
			gap: "0.5rem",
			marginTop: "0.5rem"
		},
		primaryButton: {
			all: "revert",
			flex: 1,
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 500,
			fontSize: "16px",
			cursor: "pointer",
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			fontFamily: "Roboto, sans-serif",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			gap: "0.5rem"
		},
		currentPlanButton: {
			all: "revert",
			flex: 1,
			background: "#FFFFFF",
			color: "#757575",
			border: "1px solid #757575",
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 500,
			fontSize: "16px",
			cursor: "default",
			fontFamily: "Roboto, sans-serif"
		},
		downgradeButton: {
			all: "revert",
			flex: 1,
			background: isDark ? "#4A4A4A" : "#9E9E9E",
			color: "#FFFFFF",
			border: "none",
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 500,
			fontSize: "16px",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif"
		},
		secondaryButton: {
			all: "revert",
			flex: 1,
			background: colors.background.quaternary,
			color: colors.text.allText,
			border: `1px solid ${colors.border.primary}`,
			borderRadius: "0.5rem",
			padding: "0.75rem 1rem",
			fontWeight: 600,
			fontSize: "1rem",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif"
		}
	};

	const renderTabButton = (tabKey, label) => (
		<button
			key={tabKey}
			style={activeTab === tabKey ? { ...styles.tab, ...styles.tabActive, border: 'none' } : { ...styles.tab, border: 'none' }}
			onClick={() => setActiveTab(tabKey)}
		>
			{label}
		</button>
	);

	const renderFree = () => (
		<div style={styles.content}>
			<div style={styles.planTitle}>Free</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$0</p>
				<p style={styles.monthly}>/month</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>✅ Standard Mode</div>
				<div style={styles.feature}>✅ Up to 5 new sessions / week</div>
				<div style={styles.feature}>✅ 1 context file per session</div>
				<div style={styles.feature}>✅ Up to 10MB per file</div>
			</div>
		</div>
	);

	const renderPro = () => (
		<div style={styles.content}>
			<div style={styles.planHeaderRow}>
				<div style={styles.planTitle}>Pro</div>
				<div style={styles.bestDealBadge}>BEST DEAL</div>
			</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$9.99</p>
				<p style={styles.monthly}>/month</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>✅ Standard + Advanced Mode</div>
				<div style={styles.feature}>✅ Up to 200 new sessions / month</div>
				<div style={styles.feature}>✅ Up to 10 context files per session</div>
				<div style={styles.feature}>✅ Up to 50MB per file</div>
			</div>
		</div>
	);

	const renderPremium = () => (
		<div style={styles.content}>
			<div style={styles.planHeaderRow}>
				<div style={styles.planTitle}>Premium</div>
			</div>
			<div style={styles.priceRow}>
				<p style={styles.price}>$14.99</p>
				<p style={styles.monthly}>/month</p>
			</div>
			<div style={styles.featureList}>
				<div style={styles.feature}>✅ Standard + Advanced Mode</div>
				<div style={styles.feature}>✅ Unlimited new sessions</div>
				<div style={styles.feature}>✅ Up to 20 context files per session</div>
				<div style={styles.feature}>✅ Up to 100MB per file</div>
			</div>
		</div>
	);

	// Helper function to determine button text based on current plan vs selected plan
	const getButtonText = () => {
		if (!currentPlan || activeTab === currentPlan) {
			return "Current Plan";
		}
		
		// Define plan hierarchy for comparison
		const planHierarchy = { free: 0, pro: 1, premium: 2 };
		const currentLevel = planHierarchy[currentPlan];
		const selectedLevel = planHierarchy[activeTab];
		
		if (selectedLevel > currentLevel) {
			// Upgrade
			if (activeTab === "pro") return "Get Pro";
			if (activeTab === "premium") return "Get Premium";
		}
		else if (selectedLevel < currentLevel) {
			// Downgrade
			if (activeTab === "free") return "Downgrade to Free";
			if (activeTab === "pro") return "Downgrade to Pro";
		}
		
		// Fallback
		if (activeTab === "free") return "Continue with Free";
		if (activeTab === "pro") return "Get Pro";
		return "Get Premium";
	};

	// Helper function to determine button style
	const getButtonStyle = () => {
		if (!currentPlan || activeTab === currentPlan) {
			return styles.currentPlanButton;
		}
		
		// Define plan hierarchy for comparison
		const planHierarchy = { free: 0, pro: 1, premium: 2 };
		const currentLevel = planHierarchy[currentPlan];
		const selectedLevel = planHierarchy[activeTab];
		
		if (selectedLevel < currentLevel) {
			// Downgrade - use gray button
			return styles.downgradeButton;
		}
		
		// Upgrade or same level - use primary button
		return styles.primaryButton;
	};

	// Helper function to determine if button should show arrow
	const shouldShowArrow = () => {
		if (!currentPlan || activeTab === currentPlan) {
			return false;
		}
		
		// Define plan hierarchy for comparison
		const planHierarchy = { free: 0, pro: 1, premium: 2 };
		const currentLevel = planHierarchy[currentPlan];
		const selectedLevel = planHierarchy[activeTab];
		
		// Only show arrow for upgrades (Get Pro, Get Premium)
		return selectedLevel > currentLevel;
	};

	const handlePrimary = () => {
		try {
			if (currentPlan && activeTab === currentPlan) {
				return; // no-op for current plan
			}
			
			// Check if this is a downgrade action
			const planHierarchy = { free: 0, pro: 1, premium: 2 };
			const currentLevel = planHierarchy[currentPlan];
			const selectedLevel = planHierarchy[activeTab];
			
			if (selectedLevel < currentLevel) {
				// Downgrade - redirect to manage subscription page
				const manageUrl = `http://localhost:3000/dzSubscription?manage=true`;
				//const manageUrl = `https://${DT_BASE_URL}/manage-subscription`;
				try {
					Zotero.launchURL(manageUrl);
				}
				catch (error) {
					Zotero.debug(`DeepTutor: Error opening manage subscription URL: ${error.message}`);
					// Fallback to clipboard if URL opening fails
					if (navigator.clipboard) {
						navigator.clipboard.writeText(manageUrl).then(() => {
							Zotero.alert(null, 'DeepTutor', 'Manage subscription URL copied to clipboard!');
						});
					}
					else {
						Zotero.alert(null, 'DeepTutor', `Please manually visit this URL:\n${manageUrl}`);
					}
				}
				// Close the popup after handling downgrade
				onClose();
				return;
			}
			
			// Regular upgrade action: open URL and show processing panel (do not delegate to parent)
			let url = `http://localhost:3000/dzSubscription?plan=premium`;
			//let url = `https://${DT_BASE_URL}/dzSubscription?plan=premium`;
			if (activeTab === "pro") {
				url = `http://localhost:3000/dzSubscription?plan=pro`;
				//url = `https://${DT_BASE_URL}/dzSubscription?plan=pro`;
			}
			openSubscriptionUrl(url);
			setCurrentPanel("processing");
		}
		catch { }
	};

	return (
		<div style={styles.container}>
			{currentPanel === "select" && (
				<>
					<div style={styles.title}>Upgrade Your Plan</div>
					<button style={styles.closeButton} onClick={onClose}>
						<img src={closePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
					</button>
					<div style={styles.tabs}>
						{renderTabButton("free", "Free")}
						{renderTabButton("pro", "Pro")}
						{renderTabButton("premium", "Premium")}
					</div>

					{activeTab === "free" && renderFree()}
					{activeTab === "pro" && renderPro()}
					{activeTab === "premium" && renderPremium()}

					<div style={styles.footer}>
						<button
							style={getButtonStyle()}
							onClick={handlePrimary}
						>
							<span>{getButtonText()}</span>
							{shouldShowArrow() && (
								<img
									src={isDark ? ArrowForwardDarkPath : ArrowForwardPath}
									alt="Forward"
									style={{ width: "1.25rem", height: "1.25rem" }}
								/>
							)}
						</button>
					</div>
				</>
			)}
			{currentPanel === "processing" && (
				<>
					<div style={styles.title}>Processing Subscription</div>
					<button style={styles.closeButton} onClick={onClose}>
						<img src={closePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
					</button>
					<DeepTutorProcessingSubscription
						onContinue={handleProcessingContinue}
						onCancel={onClose}
					/>
				</>
			)}
			{currentPanel === "confirm" && (
				<>
					<div style={styles.title}>Upgrade Successfully!</div>
					<button style={styles.closeButton} onClick={onClose}>
						<img src={closePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
					</button>
					<DeepTutorSubscriptionConfirm
						onClose={onClose}
						imagePath={SubscriptionConfirmBookPath}
					/>
				</>
			)}
		</div>
	);
}


DeepTutorSubscriptionPopup.propTypes = {

	/** Called when the user presses close or cancel */
	onClose: PropTypes.func.isRequired,

	/** Called when user confirms on a plan; receives one of: "free" | "pro" | "premium" */
	onAction: PropTypes.func,

	/** User id for resolving current plan */
	userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),

	/** Active subscription object for determining current plan */
	activeSubscription: PropTypes.object
};

DeepTutorSubscriptionPopup.defaultProps = {
	onAction: () => {}
};
