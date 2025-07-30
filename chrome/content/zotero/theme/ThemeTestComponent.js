/**
 * Test Component to Demonstrate Theme System
 * This shows how the DeepTutorWelcomePane colors change between light and dark modes
 */

import { useState } from "react";
import { useDeepTutorTheme } from "./useDeepTutorTheme.js";

const ThemeTestComponent = () => {
	const { theme, colors, setTheme } = useDeepTutorTheme();
	const [showColorInfo, setShowColorInfo] = useState(false);

	const toggleTheme = () => {
		setTheme(theme === "light" ? "dark" : "light");
	};

	const styles = {
		container: {
			padding: "2rem",
			background: colors.background.primary,
			color: colors.text.allText,
			fontFamily: "Roboto, sans-serif",
			minHeight: "100vh",
		},
		header: {
			textAlign: "center",
			marginBottom: "2rem",
			fontSize: "2rem",
			fontWeight: "bold",
		},
		buttonContainer: {
			display: "flex",
			gap: "1rem",
			justifyContent: "center",
			marginBottom: "2rem",
		},
		primaryButton: {
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			padding: "0.75rem 1.5rem",
			borderRadius: "0.5rem",
			fontSize: "1rem",
			fontWeight: "600",
			cursor: "pointer",
		},
		secondaryButton: {
			background: colors.button.secondary,
			color: colors.button.secondaryText,
			border: `2px solid ${colors.button.secondaryBorder}`,
			padding: "0.75rem 1.5rem",
			borderRadius: "0.5rem",
			fontSize: "1rem",
			fontWeight: "600",
			cursor: "pointer",
		},
		colorInfo: {
			background: colors.background.secondary,
			padding: "1rem",
			borderRadius: "0.5rem",
			marginTop: "1rem",
		},
		colorGrid: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
			gap: "1rem",
			marginTop: "1rem",
		},
		colorItem: {
			padding: "0.5rem",
			borderRadius: "0.25rem",
			textAlign: "center",
			fontSize: "0.875rem",
		},
		errorText: {
			color: colors.error,
			fontSize: "1rem",
			marginTop: "1rem",
		},
		successText: {
			color: colors.success,
			fontSize: "1rem",
			marginTop: "1rem",
		},
	};

	return (
		<div style={styles.container}>
			<h1 style={styles.header}>
				DeepTutor Theme Test - Current Theme: {theme.toUpperCase()}
			</h1>

			<div style={styles.buttonContainer}>
				<button style={styles.primaryButton} onClick={toggleTheme}>
					Switch to {theme === "light" ? "Dark" : "Light"} Mode
				</button>
				<button style={styles.secondaryButton} onClick={() => setShowColorInfo(!showColorInfo)}>
					{showColorInfo ? "Hide" : "Show"} Color Information
				</button>
			</div>

			{/* Welcome Pane Style Demo */}
			<div style={{ background: colors.background.tertiary, padding: "2rem", borderRadius: "1rem", marginBottom: "2rem" }}>
				<h2 style={{ color: colors.text.allText, textAlign: "center", marginBottom: "1rem" }}>
					Welcome Pane Style Demo
				</h2>
				<p style={{ color: colors.text.allText, textAlign: "center", marginBottom: "1.5rem" }}>
					This demonstrates the exact colors used in the DeepTutorWelcomePane component
				</p>
				<div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
					<button style={styles.primaryButton}>
						Sign in (Primary Button)
					</button>
					<button style={styles.secondaryButton}>
						Sign in with Google (Secondary Button)
					</button>
				</div>
				<div style={styles.errorText}>
					Error message example (Error Text)
				</div>
				<div style={styles.successText}>
					Success message example (Success Text)
				</div>
			</div>

			{showColorInfo && (
				<div style={styles.colorInfo}>
					<h3 style={{ color: colors.text.allText, marginBottom: "1rem" }}>
						Current Theme Colors
					</h3>
					<div style={styles.colorGrid}>
						<div style={{ ...styles.colorItem, background: colors.text.allText, color: colors.background.primary }}>
							All Text: {colors.text.allText}
						</div>
						<div style={{ ...styles.colorItem, background: colors.button.primary, color: colors.button.primaryText }}>
							Primary Button: {colors.button.primary}
						</div>
						<div style={{ ...styles.colorItem, background: colors.button.secondary, color: colors.button.secondaryText, border: `2px solid ${colors.button.secondaryBorder}` }}>
							Secondary Button: {colors.button.secondary}
						</div>
						<div style={{ ...styles.colorItem, background: colors.error, color: "#FFFFFF" }}>
							Error: {colors.error}
						</div>
						<div style={{ ...styles.colorItem, background: colors.success, color: "#FFFFFF" }}>
							Success: {colors.success}
						</div>
						<div style={{ ...styles.colorItem, background: colors.background.tertiary, color: colors.text.allText }}>
							Background: {colors.background.tertiary}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default ThemeTestComponent; 