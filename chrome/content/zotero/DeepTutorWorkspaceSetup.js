import React, { useEffect, useState } from "react"; // eslint-disable-line no-unused-vars
import ReactDOM from "react-dom";
import PropTypes from "prop-types";
import { useDeepTutorTheme } from "./theme/useDeepTutorTheme.js";

/**
 * Full-screen first-run workspace setup popup for DeepTutor.
 *
 * Options:
 *  - Start New Workspace: create ~/DeepTutor next to the current data dir's parent and set it
 *  - Copy from Zotero: copy current data dir to ~/DeepTutor and set it
 *  - Share with Zotero: keep current data dir
 *
 * On success this sets the prefs flag `deeptutor.workspaceSetupCompleted` and calls onComplete().
 */
export default function DeepTutorWorkspaceSetup({ onComplete }) {
	const { colors, isDark } = useDeepTutorTheme();

	const [choice, setChoice] = useState("start");
	const [isWorking, setIsWorking] = useState(false);
	const [error, setError] = useState("");
	const [portalEl, setPortalEl] = useState(null);
	const [page, setPage] = useState("main"); // 'main' | 'pathEntry'
	const [pathPurpose, setPathPurpose] = useState("copy"); // 'copy' | 'share'
	const [customZoteroPath, setCustomZoteroPath] = useState("");
	const [showHelpPopup, setShowHelpPopup] = useState(false);


	useEffect(() => {
		try {
			const win = (typeof window !== 'undefined' && window.top) ? window.top : window;
			const doc = win && win.document ? win.document : document;
			if (!doc) {
				return;
			}
			let container = doc.getElementById('deeptutor-workspace-setup-overlay-root');
			if (!container) {
				container = doc.createElement('div');
				container.id = 'deeptutor-workspace-setup-overlay-root';
				(doc.documentElement || doc.body).appendChild(container);
			}
			setPortalEl(container);
		}
		catch {
			// Portal creation failed
		}
	}, []);


	const styles = {
		overlay: {
			position: "fixed",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: isDark ? "#000000" : "#FFFFFF", // Solid background color
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 2000,
			backgroundImage: `url(${isDark ? "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/dark_mode_background.png" : "chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/light_mode_background.png"})`,
			backgroundSize: '1512px 945px',
			backgroundRepeat: 'no-repeat',
			backgroundPosition: 'center',
		},
		container: {
			position: "relative",
			width: "756px", // Exactly half of 1512px background width
			height: "472px", // Exactly half of 945px background height
			background: "transparent",
			borderRadius: "0.75rem",
			border: "none", // Removed border
			padding: "2.5rem 3rem",
			boxShadow: "none",
			fontFamily: "Roboto, Inter, Arial, sans-serif",
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'flex-start', // Changed from 'center' to 'flex-start' for left alignment
			justifyContent: 'center',
			textAlign: 'left', // Changed from 'center' to 'left'
		},
		contentArea: {
			width: "100%", // Use full width of container
			height: "100%", // Use full height of container
			display: 'flex',
			flexDirection: 'column',
			alignItems: 'flex-start', // Left align all content
			justifyContent: 'center',
			padding: "0", // Remove padding since container already has it
		},
		logo: {
			width: '10rem',
			height: 'auto',
			marginBottom: '1rem',
			alignSelf: 'center', // Center the logo icon
		},
		title: {
			width: "100%",
			textAlign: "center",
			margin: 0,
			marginBottom: "1rem",
			fontWeight: 800,
			fontSize: "3rem", // 48px
			lineHeight: 1.15,
			color: isDark ? "#E1E0E4" : "#1C1B1F",
		},
		subtitle: {
			fontSize: "2rem", // 32px
			fontWeight: 600,
			color: colors.text.primary,
			marginTop: "1rem", // Added padding above subtitle
			marginBottom: "1.5rem",
			textAlign: 'left', // Changed back to left alignment
			width: '100%',
		},
		optionRow: {
			display: "flex",
			alignItems: "center",
			gap: "0.75rem",
			padding: "0.5rem, 0rem",
			marginBottom: "0.25rem",
			borderRadius: "0.5rem",
			border: "none", // Removed border
			cursor: "pointer",
			background: "transparent",
		},
		optionLabel: {
			color: colors.text.primary,
			fontSize: "1.5rem", // Changed from 1rem to 1.5rem (24px)
			fontWeight: 400,
			flexGrow: 1,
			textAlign: 'left',
		},
		actions: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: 'center',
			width: '100%',
			marginTop: "1.5rem",
		},
		spacer: {
			flexGrow: 1,
		},
		primary: {
			all: "revert",
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.5rem",
			padding: "0.75rem 2rem", // Wider padding for wider button
			minWidth: "120px", // Ensure minimum width
			fontWeight: 700,
			cursor: "pointer"
		},
		secondary: {
			all: "revert",
			background: colors.background.quaternary,
			color: colors.text.primary,
			border: `1px solid ${colors.border.primary}`,
			borderRadius: "0.5rem",
			padding: "0.75rem 1.25rem",
			fontWeight: 600,
			cursor: "pointer"
		},
		hint: {
			fontSize: "1.25rem",
			color: isDark ? "#CDCDCD" : "#757575",
			marginLeft: "2.5rem",
			marginBottom: "1rem",
			fontStyle: "italic",
		},
		error: {
			color: colors.error.primary,
			backgroundColor: colors.error.background,
			padding: "0.75rem",
			borderRadius: "0.5rem",
			marginBottom: "1rem",
			border: `1px solid ${colors.error.border}`,
		},
		close: {
			all: "revert",
			position: "absolute",
			right: "1rem",
			top: "1rem",
			background: "none",
			border: "none",
			width: "1.25rem",
			height: "1.25rem",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center"
		},
		backButton: {
			all: "revert",
			position: "absolute",
			left: "1rem",
			top: "1rem",
			background: "transparent", // Changed from colors.background.quaternary to transparent
			border: "none", // Removed border
			color: "#0687E5", // Changed to blue link color
			borderRadius: "0", // Removed border radius
			padding: "0.25rem 0.75rem",
			cursor: "pointer",
			fontWeight: 400, // Changed from 600 to 400 for text-like appearance
			textDecoration: "underline", // Added underline to make it look like a link
		},
		input: {
			width: "100%",
			padding: "0.75rem",
			borderRadius: "0.5rem",
			border: `1px solid ${colors.border.primary}`,
			color: colors.text.primary,
			background: colors.background.primary,
			fontFamily: "Roboto, sans-serif",
		},
		textButton: {
			all: "revert",
			background: "transparent",
			border: "none",
			color: "#0687E5",
			cursor: "pointer",
			textDecoration: "underline",
			fontFamily: "Roboto, sans-serif",
			fontSize: "1rem",
			marginTop: "0.75rem",
		},
		helpOverlay: {
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			background: "rgba(0,0,0,0.5)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 2100,
		},
		helpContent: {
			background: colors.background.primary,
			border: isDark ? `1px solid ${colors.popup.border}` : "none",
			borderRadius: "0.5rem",
			padding: "2rem",
			maxWidth: "24rem",
			width: "90%",
			position: "relative",
		},
		helpTitle: {
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
			marginBottom: "1.5rem",
			fontFamily: "Roboto, sans-serif",
		},
		helpMessage: {
			fontSize: "1.25rem",
			color: colors.text.allText || colors.text.primary,
			textAlign: "left",
			marginBottom: "1.875rem",
			fontWeight: 400,
			lineHeight: "135%",
			fontFamily: "Roboto, sans-serif",
		},
		helpButton: {
			all: "revert",
			background: colors.button.primary,
			color: colors.button.primaryText,
			border: "none",
			borderRadius: "0.625rem",
			padding: "0.75rem 1.5rem",
			minHeight: "3rem",
			fontWeight: 600,
			fontSize: "1rem",
			cursor: "pointer",
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			fontFamily: "Roboto, sans-serif",
			letterSpacing: 0.2,
			transition: "background 0.2s",
			display: "block",
			width: "100%",
		},
	};


	const computeDeepTutorDir = () => {
		try {
			const base = Zotero.DataDirectory.defaultDir;
			const parent = PathUtils.parent(base);
			const deepTutorPath = PathUtils.join(parent, "DeepTutorData");
			return deepTutorPath;
		}
		catch {
			return "~/DeepTutorData";
		}
	};

	const markCompleted = () => {
		try {
			Zotero.Prefs.set("deeptutor.workspaceSetupCompleted", true);
		}
		catch {
			// ignore
		}
	};

	const handleContinue = async () => {
		if (isWorking) return;
		setError("");
		setIsWorking(true);
		try {
			if (choice === "start") {
				const deepTutorDir = computeDeepTutorDir();
				await IOUtils.makeDirectory(deepTutorDir, { ignoreExisting: true, permissions: 0o755 });
				Zotero.DataDirectory.set(deepTutorDir);
				
				markCompleted();
				setIsWorking(false);
				if (onComplete) {
					onComplete();
				}
				return;
			}

			if (choice === "copy" || choice === "share") {
				try {
					const currentDataDir = Zotero.DataDirectory.defaultDir;
					const parentDir = PathUtils.parent(currentDataDir);
					const defaultZoteroPath = PathUtils.join(parentDir, "Zotero");
					
					await IOUtils.stat(defaultZoteroPath);
					
					const zoteroDbPath = PathUtils.join(defaultZoteroPath, "zotero.sqlite");
					try {
						await IOUtils.stat(zoteroDbPath);
					}
					catch {
						throw new Error("Default Zotero path exists but is not a valid Zotero data directory (missing zotero.sqlite)");
					}
					
					if (choice === "copy") {
						await handleCopyFromZotero(defaultZoteroPath);
					}
					else {
						Zotero.DataDirectory.set(defaultZoteroPath);
						
						markCompleted();
						try {
							Zotero.Utilities.Internal.quit(true);
						}
						catch {
							// Restart failed
						}
					}
				}
				catch {
					setPathPurpose(choice === "copy" ? "copy" : "share");
					setPage("pathEntry");
					setIsWorking(false);
				}
			}
		}
		catch (_err) {
			setError(_err && _err.message ? _err.message : String(_err));
			setIsWorking(false);
		}
	};

	const handleCopyFromZotero = async (sourcePath) => {
		const deepTutorDir = computeDeepTutorDir();

		if (deepTutorDir === sourcePath) {
			throw new Error("Computed DeepTutor directory equals source Zotero directory");
		}
		await IOUtils.makeDirectory(deepTutorDir, { ignoreExisting: true, permissions: 0o755 });
		
		const targetEmpty = await Zotero.File.directoryIsEmpty(deepTutorDir);
		if (!targetEmpty) {
			throw new Error(`Target DeepTutor directory is not empty: ${deepTutorDir}. Choose 'Start New Workspace' or clear the folder.`);
		}
		
		await Zotero.File.copyDirectory(sourcePath, deepTutorDir);
		
		try {
			const dbFrom = PathUtils.join(deepTutorDir, "zotero.sqlite");
			await IOUtils.stat(dbFrom);
			await IOUtils.move(dbFrom, PathUtils.join(deepTutorDir, "zotero.sqlite"));
		}
		catch {
			// Database rename skipped
		}
		
		Zotero.DataDirectory.set(deepTutorDir);
		
		markCompleted();
		try {
			Zotero.Utilities.Internal.quit(true);
		}
		catch {
			setIsWorking(false);
			if (onComplete) {
				onComplete();
			}
		}
	};

	const handlePathEntryContinue = async () => {
		if (isWorking) return;
		setError("");
		setIsWorking(true);
		
		try {
			const trimmedPath = customZoteroPath.trim();
			
			if (!trimmedPath) {
				throw new Error("Please enter a valid Zotero data directory path");
			}

			try {
				await IOUtils.stat(trimmedPath);
			}
			catch {
				throw new Error("The specified path does not exist or is not accessible");
			}

			const zoteroDbPath = PathUtils.join(trimmedPath, "zotero.sqlite");
			try {
				await IOUtils.stat(zoteroDbPath);
			}
			catch {
				throw new Error("The specified path does not appear to be a valid Zotero data directory (missing zotero.sqlite)");
			}

			const currentDataDir = Zotero.DataDirectory.defaultDir;
			if (trimmedPath === currentDataDir) {
				throw new Error("Cannot share with the current DeepTutor data directory. Please select a different Zotero data directory.");
			}

			if (pathPurpose === "copy") {
				await handleCopyFromZotero(trimmedPath);
			}
			else {
				Zotero.DataDirectory.set(trimmedPath);
				
				markCompleted();
				try {
					Zotero.Utilities.Internal.quit(true);
				}
				catch {
					setIsWorking(false);
					if (onComplete) onComplete();
				}
			}
		}
		catch (_err) {
			setError(_err && _err.message ? _err.message : String(_err));
			setIsWorking(false);
		}
	};

	const overlay = (
		<div style={styles.overlay}>
			<div style={styles.container}>

				{page === "main" && (
					<>
						<img src="chrome://zotero/content/DeepTutorMaterials/WorkspaceSettings/deeptutor_main.svg" alt="DeepTutor" style={styles.logo} />
						<h2 style={styles.title}>Welcome to DeepTutor</h2>
						<div style={styles.subtitle}>How would you like to set up your DeepTutor workspace?</div>

						<div role="radiogroup" aria-label="Workspace setup options" style={{ width: '100%', marginTop: "1rem" }}>
							<label style={styles.optionRow} onClick={() => setChoice("start")}>
								<input type="radio" name="dt-setup" checked={choice === "start"} onChange={() => setChoice("start")} />
								<span style={styles.optionLabel}>Start New Workspace</span>
							</label>

							<label style={styles.optionRow} onClick={() => setChoice("copy")}>
								<input type="radio" name="dt-setup" checked={choice === "copy"} onChange={() => setChoice("copy")} />
								<span style={styles.optionLabel}>Copy from Zotero</span>
							</label>

							<label style={styles.optionRow} onClick={() => setChoice("share")}>
								<input type="radio" name="dt-setup" checked={choice === "share"} onChange={() => setChoice("share")} />
								<span style={styles.optionLabel}>Share with Zotero</span>
							</label>
							<div style={{ ...styles.hint, textAlign: 'left', width: '100%' }}>Note: Sharing database with Zotero means you can&apos;t run both apps at the same time.</div>
						</div>

						{error ? <div style={styles.error}>{error}</div> : null}

						<div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
							<button style={styles.primary} onClick={handleContinue} disabled={isWorking}>{isWorking ? "Working..." : "Continue"}</button>
						</div>
					</>
				)}

				{page === "pathEntry" && (
					<>
						<button style={styles.backButton} onClick={() => {
							setPage("main"); setError("");
						}}>← Back</button>
						<h2 style={styles.title}>Find Zotero Data Directory</h2>
						<div style={{ color: colors.text.primary, fontWeight: 600, marginBottom: "0.75rem", textAlign: 'center', width: '100%' }}>
							To {pathPurpose === "copy" ? "copy Zotero's workspace with DeepTutor" : "share Zotero's workspace with DeepTutor"}, please copy your Zotero Data Directory path here:
						</div>
						<input
							style={styles.input}
							placeholder="Your Zotero Data Directory"
							value={customZoteroPath}
							onChange={e => setCustomZoteroPath(e.target.value)}
						/>
						<div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem', width: '100%' }}>
							<button style={styles.textButton} onClick={() => setShowHelpPopup(true)}>How to find my Zotero file path?</button>
						</div>
						{error ? <div style={styles.error}>{error}</div> : null}
						<div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
							<button
								style={styles.primary}
								onClick={handlePathEntryContinue}
								disabled={isWorking || !customZoteroPath.trim()}
							>
								{isWorking ? "Working..." : "Continue"}
							</button>
						</div>
						{showHelpPopup && (
							<div style={styles.helpOverlay}>
								<div style={styles.helpContent}>
									<div style={styles.helpTitle}>Find My Zotero Data Directory</div>
									<div style={styles.helpMessage}>
										{Zotero.isWin
											? "On Zotero, on the top left menus, please navigate to Edit > Settings > Data Directory Location. Please copy the path into the input box"
											: "On Zotero, on the top left menus, please navigate to Zotero > Settings > Data Directory Location. Please copy the path into the input box"}
									</div>
									<button style={styles.helpButton} onClick={() => setShowHelpPopup(false)}>Got It</button>
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);

	if (!portalEl) {
		return null;
	}
	return ReactDOM.createPortal(overlay, portalEl);
}

DeepTutorWorkspaceSetup.propTypes = {
	onComplete: PropTypes.func
};


