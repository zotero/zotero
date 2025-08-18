import React, { useEffect, useMemo, useState } from "react"; // eslint-disable-line no-unused-vars
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";
import { DT_BASE_URL, getSessionUsageForUser } from "./api/libs/api.js";

// Close icon paths (match other popups)
const PopupClosePath = "chrome://zotero/content/DeepTutorMaterials/Main/MAIN_CLOSE.svg";
const PopupCloseDarkPath = "chrome://zotero/content/DeepTutorMaterials/Main/CLOSE_DARK.svg";

/**
 * DeepTutorUsagePopup Component
 * Fetches session usage upon open and displays usage statistics.
 * Mirrors logic from documents/libs/usage/usagePopup.tsx in a JS style.
 */
export default function DeepTutorUsagePopup({ onClose, onUpgrade, userId, activeSubscription }) {
	const { colors, isDark } = useDeepTutorTheme();
	const closePath = isDark ? PopupCloseDarkPath : PopupClosePath;

	// Local state for data fetching
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [usageData, setUsageData] = useState(null);

	// Fetch usage data when popup opens
	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				console.log("DeepTutor Usage: Starting usage data fetch...");
				console.log("DeepTutor Usage: User ID:", userId);
				console.log("DeepTutor Usage: Active subscription:", activeSubscription);
				
				setIsLoading(true);
				setError(null);

				if (!userId) {
					throw new Error("No user ID provided");
				}

				// Fetch usage data
				console.log("DeepTutor Usage: Fetching usage data for user:", userId);
				const usage = await getSessionUsageForUser(userId);
				console.log("DeepTutor Usage: Usage data result:", usage);

				if (!mounted) return;
				setUsageData(usage);
				console.log("DeepTutor Usage: Usage data fetch completed successfully");
			}
			catch (e) {
				console.error("DeepTutor Usage: Error in usage data fetch:", e);
				console.error("DeepTutor Usage: Error stack:", e.stack);
				if (mounted) {
					setError(e);
				}
			}
			finally {
				if (mounted) setIsLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [userId]);

	const styles = {
		overlay: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "rgba(0, 0, 0, 0.5)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 1000
		},
		container: {
			background: colors.background.primary,
			borderRadius: "0.5rem",
			padding: "2rem",
			maxWidth: "24rem",
			width: "100%",
			position: "relative",
			border: isDark ? `1px solid ${colors.popup.border}` : "none",
			fontFamily: "Roboto, sans-serif"
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
			marginBottom: "1.5rem"
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
		content: {
			textAlign: "center",
			color: colors.text.primary,
			fontSize: "1rem",
			lineHeight: "1.5"
		},
		placeholderText: {
			color: colors.text.tertiary,
			fontStyle: "italic",
			marginTop: "1rem"
		},
		rowBetween: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			width: "100%",
			marginBottom: "1rem",
			color: colors.text.primary,
		},
		labelText: {
			fontWeight: 600,
			fontSize: "1.125rem",
		},
		mutedText: {
			color: colors.text.tertiary,
			fontSize: "1rem",
		},
		separator: {
			height: "1px",
			background: isDark ? colors.border.primary : "#E5E7EB",
			width: "100%",
			margin: "0.25rem 0 0.5rem 0",
		},
		progressContainer: {
			width: "100%",
			height: "0.5rem",
			borderRadius: "9999px",
			background: isDark ? "#30363d" : "#E5E7EB",
			overflow: "hidden",
		},
		progressBar: {
			height: "100%",
			borderRadius: "9999px",
			transition: "width 0.3s ease",
		},
		upgradeButton: {
			all: "revert",
			background: "transparent",
			border: "none",
			color: "#0687E5",
			cursor: "pointer",
			textDecoration: "underline",
			fontFamily: "Roboto, sans-serif",
			fontSize: "1rem",
		}
	};

	// Helpers mirroring TS logic
	const getCurrentWeekRange = () => {
		const now = new Date();
		const startOfWeek = new Date(now);
		const dayOfWeek = now.getDay();
		const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
		startOfWeek.setDate(diff);
		const endOfWeek = new Date(startOfWeek);
		endOfWeek.setDate(startOfWeek.getDate() + 6);
		const formatDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		return `${formatDate(startOfWeek)} - ${formatDate(endOfWeek)}`;
	};

	const getSubscriptionDateRange = () => {
		if (!activeSubscription || !activeSubscription.startTime || !activeSubscription.endTime) {
			return getCurrentWeekRange();
		}
		const startDate = new Date(activeSubscription.startTime);
		const endDate = new Date(activeSubscription.endTime);
		const formatDate = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
		return `${formatDate(startDate)} - ${formatDate(endDate)}`;
	};

	const getSubscriptionTypeDisplay = () => {
		if (!activeSubscription || !activeSubscription.id) {
			return "DeepTutor Free";
		}
		const t = (activeSubscription.type || "").toUpperCase();
		if (t === "BASIC" || t === "PLUS") return "DeepTutor Pro";
		if (t === "PREMIUM") return "DeepTutor Premium";
		return "DeepTutor Free";
	};

	const weeklyTotal = useMemo(() => {
		if (!usageData) return 0;
		const a = Number(usageData.weeklyLiteCount || 0);
		const b = Number(usageData.weeklyBasicCount || 0);
		return a + b;
	}, [usageData]);

	const cycleTotal = useMemo(() => {
		if (!usageData) return 0;
		const a = Number(usageData.liteCount || 0);
		const b = Number(usageData.basicCount || 0);
		return a + b;
	}, [usageData]);

	const renderProgressBar = (current, max, label, { disabled = false, gradient = false, showUnlimited = false } = {}) => {
		let percentage = 0;
		if (showUnlimited) {
			percentage = 100;
		}
		else if (typeof max === "number" && max > 0) {
			percentage = Math.min((current / max) * 100, 100);
		}

		let sessionText = "";
		if (disabled) {
			sessionText = "Not available";
		}
		else if (showUnlimited) {
			sessionText = `${current} / unlimited sessions`;
		}
		else {
			sessionText = `${current} / ${max} sessions`;
		}

		const barStyle = { ...styles.progressBar };
		const useGradient = gradient || showUnlimited;
		if (disabled) {
			barStyle.background = isDark ? "#6B7280" : "#9CA3AF"; // gray
		}
		else if (useGradient) {
			barStyle.backgroundImage = "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)"; // aqua -> blue
		}
		else if (percentage >= 100) {
			barStyle.background = "#10B981"; // green
		}
		else {
			barStyle.background = colors.button.primary; // design system primary blue
		}

		return (
			<div style={{ marginBottom: "1rem" }}>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "1rem" }}>
					<span style={{ fontWeight: 400, color: disabled ? colors.text.tertiary : colors.text.primary }}>{label}</span>
					<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{sessionText}</span>
				</div>
				<div style={styles.progressContainer}>
					<div style={{ ...barStyle, width: `${percentage}%` }} />
				</div>
			</div>
		);
	};

	const handleUpgrade = () => {
		try {
			if (typeof onUpgrade === "function") {
				onUpgrade();
				return;
			}
			// Fallback: open pricing/upgrade page
			const url = `https://${DT_BASE_URL}/pricing`;
			try {
				Zotero.launchURL(url);
			}
			catch {
				if (navigator.clipboard) {
					navigator.clipboard.writeText(url).then(() => {
						Zotero.alert(null, "DeepTutor", "Upgrade URL copied to clipboard!");
					});
				}
			}
		}
		catch { /* noop */ }
	};

	return (
		<div style={styles.overlay} onClick={onClose}>
			<div style={styles.container} onClick={e => e.stopPropagation()}>
				{/* Close button positioned at top right */}
				<button
					onClick={onClose}
					style={styles.closeButton}
				>
					<img src={closePath} alt="Close" style={{ width: "1rem", height: "1rem" }} />
				</button>

				{/* Title */}
				<div style={styles.title}>
					Usage
				</div>

				{/* Content */}
				<div style={styles.content}>
					{/* Loading State */}
					{isLoading && (
						<div style={{ color: colors.text.primary, padding: "1rem 0" }}>Loading usage data...</div>
					)}

					{/* Error State */}
					{!isLoading && error && (
						<div style={{ color: isDark ? "#FCA5A5" : "#B91C1C", padding: "0.75rem", border: `1px solid ${isDark ? "#7F1D1D" : "#FCA5A5"}`, background: isDark ? "#2B2B2B" : "#FEF2F2", borderRadius: "0.5rem", marginBottom: "1rem" }}>
							<div>Error loading usage data. Please try again later.</div>
							{error.message && (
								<div style={{ fontSize: "0.8rem", marginTop: "0.5rem", opacity: 0.8 }}>
									Details: {error.message}
								</div>
							)}
						</div>
					)}

					{/* Usage Data Display */}
					{!isLoading && !error && usageData && (
						<div>
							{/* Subscription Type and Date Range Row */}
							<div style={styles.rowBetween}>
								<span style={styles.labelText}>{getSubscriptionTypeDisplay()}</span>
								<span style={styles.mutedText}>
									{(!activeSubscription || !activeSubscription.id) ? getCurrentWeekRange() : getSubscriptionDateRange()}
								</span>
							</div>

							{/* Free Mode Display */}
							{(!activeSubscription || !activeSubscription.id) && (
								<div>
									{renderProgressBar(weeklyTotal, 5, "Standard Mode", { disabled: false, gradient: false })}
									{renderProgressBar(0, 0, "Advanced Mode", { disabled: true })}
									<div style={{ marginTop: "1rem" }}>
										<span style={{ color: colors.text.primary }}>
											Need more sessions? {" "}
											<button type="button" onClick={handleUpgrade} style={styles.upgradeButton}>
												Upgrade Plan
											</button>
										</span>
									</div>
								</div>
							)}

							{/* Pro Subscription Display */}
							{activeSubscription && activeSubscription.id && ["BASIC", "PLUS"].includes((activeSubscription.type || "").toUpperCase()) && (
								<div>
									{/* Standard Mode (no progress) */}
									<div style={{ marginBottom: "0.75rem" }}>
										<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
											<span style={{ fontWeight: 400, color: colors.text.primary }}>Standard Mode</span>
											<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.liteCount || 0)} sessions</span>
										</div>
										<div style={styles.separator} />
									</div>

									{/* Advanced Mode (no progress) */}
									<div style={{ marginBottom: "0.75rem" }}>
										<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
											<span style={{ fontWeight: 400, color: colors.text.primary }}>Advanced Mode</span>
											<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.basicCount || 0)} sessions</span>
										</div>
										<div style={styles.separator} />
									</div>

									{/* Total Sessions Progress Bar */}
									<div style={{ marginTop: "1rem" }}>
										{renderProgressBar(cycleTotal, 200, "Total Sessions", { disabled: false, gradient: false })}
									</div>

									{/* Upgrade Message */}
									<div style={{ marginTop: "1rem" }}>
										<span style={{ color: colors.text.primary }}>
											Need more sessions? {" "}
											<button type="button" onClick={handleUpgrade} style={styles.upgradeButton}>
												Upgrade Plan
											</button>
										</span>
									</div>
								</div>
							)}

							{/* Premium Subscription Display */}
							{activeSubscription && activeSubscription.id && (activeSubscription.type || "").toUpperCase() === "PREMIUM" && (
								<div>
									{/* Standard Mode (no progress) */}
									<div style={{ marginBottom: "0.75rem" }}>
										<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
											<span style={{ fontWeight: 400, color: colors.text.primary }}>Standard Mode</span>
											<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.liteCount || 0)} sessions</span>
										</div>
										<div style={styles.separator} />
									</div>

									{/* Advanced Mode (no progress) */}
									<div style={{ marginBottom: "0.75rem" }}>
										<div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", marginBottom: "0.25rem" }}>
											<span style={{ fontWeight: 400, color: colors.text.primary }}>Advanced Mode</span>
											<span style={{ fontWeight: 400, color: colors.text.tertiary }}>{Number(usageData.basicCount || 0)} sessions</span>
										</div>
										<div style={styles.separator} />
									</div>

									{/* Total Sessions Progress Bar - unlimited */}
									<div style={{ marginTop: "1rem" }}>
										{renderProgressBar(cycleTotal, 200, "Total Sessions", { disabled: false, gradient: false, showUnlimited: true })}
									</div>
								</div>
							)}
						</div>
					)}

					{/* No Data State */}
					{!isLoading && !error && !usageData && (
						<div style={{ color: colors.text.tertiary, padding: "1rem 0" }}>No usage data available</div>
					)}
				</div>
			</div>
		</div>
	);
}

// PropTypes for component validation

DeepTutorUsagePopup.propTypes = {

	/** Callback to close the popup */
	onClose: PropTypes.func.isRequired,

	/** Optional callback to trigger upgrade flow */
	onUpgrade: PropTypes.func,

	/** The ID of the user whose usage is being displayed */
	userId: PropTypes.string,

	/** The active user subscription details */
	activeSubscription: PropTypes.shape({
		id: PropTypes.string,
		startTime: PropTypes.string,
		endTime: PropTypes.string,
		type: PropTypes.string,
	}),
};


