/**
 * DeepTutor Theme-Aware Style Generator
 * Generates styles that adapt to the current theme
 */

import { themeManager } from "./DeepTutorTheme.js";

/**
 * Generate theme-aware styles for DeepTutor components
 * @param {string} theme - Current theme ('light' or 'dark')
 * @returns {Object} Component styles object
 */
export function generateDeepTutorStyles(theme = "light") {
	const colors = themeManager.getColors();
	
	return {
		// Main container styles
		container: {
			width: "100%",
			minHeight: "80%",
			background: colors.background.primary,
			borderRadius: "0.5rem",
			boxShadow: "0 0.125rem 0.25rem rgba(0,0,0,0.1)",
			height: "100%",
			display: "flex",
			flexDirection: "column",
			fontFamily: "Roboto, sans-serif",
			position: "relative",
			overflow: "hidden",
			padding: "1.875rem 0.75rem 0 0.75rem",
			boxSizing: "border-box",
			userSelect: "text",
			WebkitUserSelect: "text",
			MozUserSelect: "text",
			msUserSelect: "text",
		},
		
		// Session name styles
		sessionNameDiv: {
			width: "100%",
			marginBottom: "1.25rem",
			color: colors.text.primary,
			fontWeight: 500,
			fontSize: "1rem",
			lineHeight: "1.2",
			fontFamily: "Roboto, sans-serif",
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
		},
		
		// Session info styles
		sessionInfo: {
			width: "90%",
			fontSize: "1em",
			color: colors.text.tertiary,
			marginBottom: "0.25rem",
			paddingLeft: "0.25rem",
			fontFamily: "Roboto, sans-serif",
			alignSelf: "flex-start",
			marginLeft: "5%",
		},
		
		// Chat log styles
		chatLog: {
			width: "100%",
			borderRadius: "0.625rem",
			overflowY: "auto",
			overflowX: "hidden",
			background: colors.background.primary,
			height: "100%",
			boxShadow: "none",
			fontFamily: "Roboto, sans-serif",
			flex: 1,
			display: "flex",
			flexDirection: "column",
			alignItems: "stretch",
			boxSizing: "border-box",
			marginBottom: "1.25rem",
			userSelect: "text",
			WebkitUserSelect: "text",
			MozUserSelect: "text",
			msUserSelect: "text",
		},
		
		// Message container styles
		messageContainer: {
			width: "100%",
			margin: "0.5rem 0",
			display: "flex",
			flexDirection: "column",
			justifyContent: "flex-start",
			gap: "0.75rem",
			flexWrap: "wrap",
			boxSizing: "border-box",
		},
		
		// Message bubble styles
		messageBubble: {
			padding: "0.5rem 0.75rem",
			borderRadius: "0.625rem",
			maxWidth: "100%",
			boxShadow: "none",
			animation: "slideIn 0.3s ease-out forwards",
			height: "auto",
			whiteSpace: "pre-wrap",
			wordBreak: "break-word",
			boxSizing: "border-box",
			overflowWrap: "break-word",
			userSelect: "text",
			WebkitUserSelect: "text",
			MozUserSelect: "text",
			msUserSelect: "text",
		},
		
		// User message styles
		userMessage: {
			backgroundColor: colors.message.user,
			color: colors.message.userText,
			marginLeft: "auto",
			marginRight: "1rem",
			borderRadius: "0.625rem",
			fontWeight: 400,
			textAlign: "left",
			alignSelf: "flex-end",
			maxWidth: "85%",
			width: "fit-content",
			fontSize: "0.875rem",
			lineHeight: "1.35",
			padding: "0.25rem 1.25rem",
		},
		
		// Bot message styles
		botMessage: {
			backgroundColor: colors.message.bot,
			color: colors.message.botText,
			marginRight: "auto",
			marginLeft: 0,
			borderBottomLeftRadius: "0.25rem",
			borderRadius: "1rem",
			fontWeight: 400,
			alignSelf: "flex-start",
		},
		
		// Message text styles
		messageText: {
			display: "block",
			maxWidth: "100%",
			overflowWrap: "break-word",
			wordBreak: "break-word",
			userSelect: "text",
			WebkitUserSelect: "text",
			MozUserSelect: "text",
			msUserSelect: "text",
			cursor: "text",
		},
		
		// Input styles
		input: {
			width: "100%",
			minHeight: "3rem",
			marginLeft: "0",
			borderRadius: "0.625rem",
			border: `1px solid ${colors.border.primary}`,
			padding: "0.375rem 0.5rem",
			background: colors.background.tertiary,
			fontSize: "1rem",
			fontFamily: "Roboto, sans-serif",
			outline: "none",
			boxSizing: "border-box",
			color: colors.text.primary
		},
		
		// Button styles
		button: {
			all: "revert",
			width: "100%",
			borderRadius: "0.625rem",
			padding: "1rem 1.25rem",
			background: colors.button.primary,
			color: colors.text.inverse,
			fontWeight: 700,
			fontSize: "1rem",
			border: "none",
			cursor: "pointer",
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			fontFamily: "Roboto, sans-serif",
			letterSpacing: 0.2,
		},
		
		// Secondary button styles
		buttonSecondary: {
			all: "revert",
			background: colors.button.secondary,
			color: colors.button.primary,
			fontWeight: 700,
			fontSize: "1rem",
			border: `0.125rem solid ${colors.button.primary}`,
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			borderRadius: "0.625rem",
			width: "100%",
			padding: "0.875rem 0",
			margin: "0.75rem auto 0 auto",
			cursor: "pointer",
			fontFamily: "Roboto, sans-serif",
			letterSpacing: 0.2,
			display: "block",
		},
		
		// Label styles
		label: {
			fontWeight: 400,
			fontSize: "0.875rem",
			lineHeight: "135%",
			color: colors.text.secondary,
			marginBottom: "0.625rem",
			marginLeft: "0",
		},
		
		// Link styles
		link: {
			display: "flex",
			justifyContent: "center",
			width: "100%",
			fontWeight: 500,
			fontSize: "0.875rem",
			textDecoration: "underline",
			color: colors.button.primary,
			background: "none",
			border: "none",
			cursor: "pointer",
			padding: 0,
			marginBottom: "1.25rem",
		},
		
		// Top section styles
		top: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			padding: "0.375rem 0.5rem 0.1875rem 0.5rem",
			minHeight: "4rem",
			background: colors.background.primary,
			borderBottom: `0.0625rem solid ${colors.border.quaternary}`,
		},
		
		// Icon button styles
		iconButton: {
			all: "revert",
			width: "2.5rem",
			height: "2.5rem",
			background: colors.background.quaternary,
			border: "none",
			borderRadius: "0.375rem",
			cursor: "pointer",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			transition: "background-color 0.2s ease",
			padding: "0.5rem",
		},
		
		// Bottom section styles
		bottom: {
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			padding: "1.5rem 1.25rem 1.25rem 1.25rem",
			background: colors.background.tertiary,
			width: "100%",
			boxSizing: "border-box",
			position: "relative",
			bottom: 0,
			left: 0,
			right: 0,
			margin: 0,
			zIndex: 1,
		},
		
		// Divider styles
		divider: {
			position: "absolute",
			left: 0,
			right: 0,
			height: "0.0625rem",
			background: colors.border.quaternary,
		},
		
		// Text button styles
		textButton: {
			background: colors.background.tertiary,
			border: "none",
			color: colors.text.quaternary,
			fontWeight: 500,
			fontSize: "1rem",
			lineHeight: "100%",
			letterSpacing: "0%",
			fontFamily: "Roboto, sans-serif",
			cursor: "pointer",
			padding: "0.5rem 1rem",
			margin: 0,
			borderRadius: "0.25rem",
			width: "fit-content",
			textAlign: "left",
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			transition: "background-color 0.2s ease",
			textDecoration: "underline",
		},
		
		// Welcome pane styles
		welcomeContainer: {
			position: "relative",
			width: "100%",
			height: "100%",
			background: colors.background.tertiary,
			fontFamily: "Roboto, sans-serif",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
		},
		
		// Welcome text styles
		welcomeText: {
			width: "100%",
			fontWeight: 700,
			fontSize: "1.375rem",
			lineHeight: "100%",
			letterSpacing: "0%",
			textAlign: "center",
			color: colors.text.quaternary,
		},
		
		// Subscription styles
		subscriptionTitle: {
			background: "linear-gradient(90deg, #0AE2FF 0%, #0687E5 100%)",
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
			color: colors.button.primary,
			fontWeight: 700,
			fontSize: "1.5rem",
			lineHeight: "100%",
			letterSpacing: "0%",
			textAlign: "center",
			marginBottom: "1.125rem",
			marginTop: "0.5rem",
		},
		
		// Subscription text styles
		subscriptionText: {
			fontSize: "1rem",
			color: colors.text.secondary,
			textAlign: "left",
			margin: "0 0 1.125rem 0",
			fontFamily: "Roboto, sans-serif",
			fontWeight: 400,
			lineHeight: "1.35",
			marginBottom: "1.875rem",
		},
		
		// Error styles
		errorTitle: {
			background: colors.red,
			WebkitBackgroundClip: "text",
			WebkitTextFillColor: "transparent",
			backgroundClip: "text",
			color: colors.red,
			fontWeight: 700,
			fontSize: "1.25rem",
			lineHeight: "100%",
			letterSpacing: "0%",
			textAlign: "center",
			marginBottom: "1.5rem",
		},
		
		// Error message styles
		errorMessage: {
			fontSize: "1rem",
			color: colors.text.primary,
			textAlign: "center",
			marginBottom: "1.875rem",
			fontWeight: 400,
			lineHeight: "135%",
		},
		
		// Confirm button styles
		confirmButton: {
			all: "revert",
			background: colors.red,
			color: colors.text.inverse,
			minHeight: "3rem",
			fontWeight: 700,
			fontSize: "1rem",
			border: "none",
			borderRadius: "0.625rem",
			padding: "0.625rem 1.25rem",
			width: "100%",
			cursor: "pointer",
			boxShadow: "0 0.0625rem 0.125rem rgba(0,0,0,0.08)",
			fontFamily: "Roboto, sans-serif",
			letterSpacing: 0.2,
		},
	};
}

/**
 * Generate CSS styles for markdown content
 * @param {string} theme - Current theme ('light' or 'dark')
 * @returns {string} CSS string
 */
export function generateMarkdownCSS(theme = "light") {
	const colors = themeManager.getColors();
	
	return `
		.markdown table {
			border-collapse: collapse;
			width: 100%;
			margin: 1rem 0;
			font-size: 1rem;
			line-height: 1.4;
			border: 0.0625rem solid ${colors.table.border};
			border-radius: 0.5rem;
			overflow: hidden;
			box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1);
			background: ${colors.table.background};
			table-layout: auto;
		}
		.markdown thead {
			background: ${colors.table.header};
		}
		.markdown tbody {
			background: ${colors.table.background};
		}
		.markdown tr {
			border-bottom: 0.0625rem solid ${colors.table.border};
		}
		.markdown tr:last-child {
			border-bottom: none;
		}
		.markdown tr:hover {
			background: ${colors.table.hover};
		}
		.markdown th {
			padding: 0.75rem 0.5rem;
			text-align: left;
			font-weight: 600;
			color: ${colors.text.primary};
			border-bottom: 0.125rem solid ${colors.table.border};
			background: ${colors.table.header};
			font-size: 1.0rem;
			line-height: 1.6;
			white-space: normal;
			vertical-align: top;
		}
		.markdown td {
			padding: 0.75rem 0.5rem;
			text-align: left;
			color: ${colors.text.primary};
			border-bottom: 0.0625rem solid ${colors.table.border};
			border-right: 0.0625rem solid ${colors.table.border};
			border-left: 0.0625rem solid ${colors.table.border};
			font-size: 1.0rem;
			line-height: 1.6;
			white-space: normal;
			word-break: keep-all;
			overflow-wrap: break-word;
			vertical-align: top;
		}
		.markdown td:first-child {
			word-break: keep-all;
			overflow-wrap: break-word;
			white-space: normal;
			width: fit-content;
			min-width: fit-content;
		}
		.markdown td:nth-child(n+2) {
			word-break: break-word;
			overflow-wrap: break-word;
			white-space: normal;
			width: auto;
		}
		.markdown table td:first-child,
		.markdown table th:first-child {
			width: fit-content;
			min-width: fit-content;
			white-space: normal;
			word-break: keep-all;
			overflow-wrap: break-word;
		}
		.deeptutor-source-button {
			background: ${colors.sourceButton.background} !important;
			opacity: 0.4 !important;
			color: ${colors.sourceButton.text} !important;
			border: none !important;
			border-radius: 50% !important;
			width: 2rem !important;
			height: 2rem !important;
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			font-weight: 600 !important;
			font-size: 0.875rem !important;
			cursor: pointer !important;
			box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
			padding: 0 !important;
			margin: 0 0.25rem !important;
			transition: all 0.2s ease !important;
			vertical-align: middle !important;
			line-height: 1 !important;
			text-decoration: none !important;
			user-select: none !important;
			font-family: 'Roboto', sans-serif !important;
			position: relative !important;
			overflow: hidden !important;
		}
		.deeptutor-source-button:hover {
			background: ${colors.button.hover} !important;
			opacity: 0.8 !important;
			transform: scale(1.05) !important;
			box-shadow: 0 0.125rem 0.25rem rgba(0,0,0,0.15) !important;
		}
		.deeptutor-source-button:active {
			transform: scale(0.95) !important;
			box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
		}
		.deeptutor-source-button:focus {
			outline: 0.125rem solid ${colors.sourceButton.background} !important;
			outline-offset: 0.125rem !important;
		}
		.deeptutor-source-button:focus:not(:focus-visible) {
			outline: none !important;
		}
		.deeptutor-source-placeholder {
			background: ${colors.sourceButton.placeholder} !important;
			color: ${colors.sourceButton.text} !important;
			border: none !important;
			border-radius: 50% !important;
			width: 2rem !important;
			height: 2rem !important;
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			font-weight: 600 !important;
			font-size: 0.875rem !important;
			cursor: default !important;
			box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.08) !important;
			padding: 0 !important;
			margin: 0 0.25rem !important;
			vertical-align: middle !important;
			line-height: 1 !important;
			text-decoration: none !important;
			user-select: none !important;
			font-family: 'Roboto', sans-serif !important;
			position: relative !important;
			overflow: hidden !important;
		}
		.markdown table .deeptutor-source-button {
			width: 2em !important;
			height: 2em !important;
			font-size: 1em !important;
			margin: 0 0.15em !important;
			vertical-align: middle !important;
		}
		.markdown table .deeptutor-source-placeholder {
			width: 1.5em !important;
			height: 1.5em !important;
			font-size: 0.75em !important;
			margin: 0 0.15em !important;
			vertical-align: middle !important;
		}
		@keyframes pulse {
			0% { opacity: 0.3; }
			100% { opacity: 0.6; }
		}
		.katex {
			font-size: 1.1em !important;
			line-height: 1.2 !important;
			vertical-align: middle !important;
		}
		.katex:not(.katex-display) {
			font-size: 1em !important;
			line-height: 1.1 !important;
			vertical-align: middle !important;
		}
		.katex-display {
			font-size: 1.2em !important;
			line-height: 1.4 !important;
			margin-bottom: 1em !important;
			margin-top: 0.5em !important;
		}
		.katex .msupsub {
			text-align: left !important;
		}
		.katex .msubsup {
			text-align: right !important;
		}
		.katex .msupsub > .vlist-t {
			font-size: 0.7em !important;
		}
		.katex .msupsub .mord {
			font-size: 0.7em !important;
		}
		.katex .scriptstyle {
			font-size: 0.7em !important;
		}
		.katex .scriptscriptstyle {
			font-size: 0.5em !important;
		}
		.katex sup {
			font-size: 0.7em !important;
			vertical-align: super !important;
		}
		.katex sub {
			font-size: 0.7em !important;
			vertical-align: sub !important;
		}
		.katex .vlist .sizing.reset-size6.size3,
		.katex .vlist .fontsize-ensurer.reset-size6.size3 {
			font-size: 0.7em !important;
		}
		.katex .sqrt {
			vertical-align: baseline !important;
			display: inline-block !important;
			position: relative !important;
		}
		.katex .sqrt > .vlist-t {
			display: inline-block !important;
			vertical-align: baseline !important;
		}
		.katex .sqrt-sign {
			position: relative !important;
			display: inline-block !important;
		}
		.katex .sqrt-line {
			border-top: 0.08em solid !important;
			position: relative !important;
			display: block !important;
			width: 100% !important;
			margin-top: -0.3em !important;
		}
		.katex .sqrt > .vlist-t > .vlist-r > .vlist {
			display: inline-block !important;
			vertical-align: baseline !important;
		}
		.katex .sqrt .vlist {
			position: relative !important;
			display: inline-block !important;
		}
		.katex .frac-line {
			border-bottom-width: 0.06em !important;
		}
		.katex-display:has(.frac),
		.katex-display:has(.mfrac) {
			margin-top: -1em !important;
			margin-bottom: 1.5em !important;
			vertical-align: middle !important;
		}
		.katex * {
			vertical-align: baseline !important;
		}
		.katex .mop {
			vertical-align: baseline !important;
		}
		.katex:not(.katex-display)::after {
			content: " " !important;
			white-space: normal !important;
		}
		.markdown ul,
		.markdown ol {
			margin: 0.5em 0 !important;
			padding-left: 1.5em !important;
		}
		.markdown li {
			margin: 0.25em 0 !important;
			padding-left: 0.5em !important;
		}
		.markdown ul ul,
		.markdown ol ol,
		.markdown ul ol,
		.markdown ol ul {
			margin: 0.25em 0 !important;
			padding-left: 1em !important;
		}
		.markdown hr,
		hr {
			display: none !important;
			border: none !important;
			margin: 0 !important;
			padding: 0 !important;
			height: 0 !important;
			width: 0 !important;
			visibility: hidden !important;
		}
		.markdown img {
			max-width: 100% !important;
			height: auto !important;
			display: block !important;
			margin: 0.5rem auto !important;
			border-radius: 0.375rem !important;
			box-shadow: 0 0.0625rem 0.125rem rgba(0,0,0,0.1) !important;
			object-fit: contain !important;
		}
		.markdown p img,
		.markdown div img {
			max-width: 100% !important;
			width: auto !important;
			height: auto !important;
		}
		@media (max-width: 768px) {
			.markdown img {
				max-width: 95% !important;
				margin: 0.375rem auto !important;
			}
		}
	`;
} 