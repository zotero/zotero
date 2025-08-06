/**
 * DeepTutor Theme Configuration
 * Centralized color system for light and dark modes
 */

// Color palette definitions
const DeepTutorColors = {
	// Primary brand colors (same in both themes)
	primary: {
		sky: "#0687E5",
		aqua: "#0AE2FF",
		pearl: "#F2F2F2",
		green: "#22C55E",
		red: "#dc3545"
	},
	
	// Light theme colors
	light: {
		// Background colors
		background: {
			primary: "#FFFFFF",
			secondary: "#F8F9FA",
			tertiary: "#F2F2F2",
			quaternary: "#F8F6F7"
		},
		
		// Text colors
		text: {
			primary: "#1C1B1F",
			secondary: "#222222",
			tertiary: "#495057",
			quaternary: "#292929",
			inverse: "#FFFFFF",
			allText: "#1C1B1F"
		},
		
		// Border colors
		border: {
			primary: "#DADCE0",
			secondary: "#E0E0E0",
			tertiary: "#BDBDBD",
			quaternary: "#D9D9D9"
		},
		
		// Button colors
		button: {
			primary: "#0687E5",
			secondary: "#FFFFFF",
			disabled: "#CCCCCC",
			hover: "#87CEEB",
			primaryText: "#FFFFFF",
			secondaryText: "#1C1B1F",
			secondaryBorder: "#0687E5"
		},
		
		// Message colors
		message: {
			user: "#FFFFFF",
			bot: "#F2F2F2",
			userText: "#1C1B1F",
			botText: "#000000"
		},
		
		// Table colors
		table: {
			background: "#FFFFFF",
			header: "#F8F6F7",
			border: "#E0E0E0",
			hover: "#F5F5F5"
		},
		
		// Source button colors
		sourceButton: {
			background: "#0687E5",
			placeholder: "#9E9E9E",
			text: "#FFFFFF",
			streamingBackground: "#9E9E9E",
			streamingText: "#FFFFFF"
		},
		
		// Error and success colors
		error: "#D72424",
		success: "#28A745"
	},
	
	// Dark theme colors
	dark: {
		// Background colors
		background: {
			primary: "#1E1E1E",
			secondary: "#2A2A2E",
			tertiary: "#303030",
			quaternary: "#38383D"
		},
		
		// Text colors
		text: {
			primary: "#FFFFFF",
			secondary: "#E1E1E1",
			tertiary: "#B0B0B0",
			quaternary: "#CCCCCC",
			inverse: "#000000",
			allText: "#FFFFFF"
		},
		
		// Border colors
		border: {
			primary: "#404040",
			secondary: "#555555",
			tertiary: "#666666",
			quaternary: "#4A4A4A"
		},
		
		// Button colors
		button: {
			primary: "#33A9FF",
			secondary: "#1C1B1F",
			disabled: "#666666",
			hover: "#0570c0",
			primaryText: "#1C1B1F",
			secondaryText: "#BDBDBD",
			secondaryBorder: "#BDBDBD"
		},
		
		// Message colors
		message: {
			user: "#33A9FF",
			bot: "#2A2A2E",
			userText: "#FFFFFF",
			botText: "#E1E1E1"
		},
		
		// Table colors
		table: {
			background: "#2A2A2E",
			header: "#38383D",
			border: "#555555",
			hover: "#404040"
		},
		
		// Source button colors
		sourceButton: {
			background: "#0687E5",
			placeholder: "#666666",
			text: "#FFFFFF",
			streamingBackground: "#666666",
			streamingText: "#FFFFFF"
		},
		
		// Error and success colors
		error: "#D72424",
		success: "#28A745"
	}
};

/**
 * Theme manager class
 */
class DeepTutorThemeManager {
	constructor() {
		this.currentTheme = this.detectSystemTheme();
		this.listeners = [];
		this.init();
	}
	
	/**
	 * Detect system color scheme preference
	 */
	detectSystemTheme() {
		if (typeof window !== "undefined" && window.matchMedia) {
			return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
		}
		return "light"; // Default to light theme
	}
	
	/**
	 * Initialize theme system
	 */
	init() {
		// Listen for system theme changes
		if (typeof window !== "undefined" && window.matchMedia) {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			mediaQuery.addEventListener("change", (e) => {
				this.currentTheme = e.matches ? "dark" : "light";
				this.notifyListeners();
			});
		}
	}
	
	/**
	 * Get current theme
	 */
	getCurrentTheme() {
		return this.currentTheme;
	}
	
	/**
	 * Get colors for current theme
	 */
	getColors() {
		return {
			...DeepTutorColors.primary,
			...DeepTutorColors[this.currentTheme]
		};
	}
	
	/**
	 * Get specific color from current theme
	 */
	getColor(category, subcategory) {
		const colors = this.getColors();
		return colors[category]?.[subcategory] || colors[category] || colors[subcategory];
	}
	
	/**
	 * Add theme change listener
	 */
	addListener(callback) {
		this.listeners.push(callback);
	}
	
	/**
	 * Remove theme change listener
	 */
	removeListener(callback) {
		const index = this.listeners.indexOf(callback);
		if (index > -1) {
			this.listeners.splice(index, 1);
		}
	}
	
	/**
	 * Notify all listeners of theme change
	 */
	notifyListeners() {
		this.listeners.forEach(callback => {
			try {
				callback(this.currentTheme, this.getColors());
			} catch (error) {
				console.error("Error in theme change listener:", error);
			}
		});
	}
	
	/**
	 * Force theme change (for testing or user preference)
	 */
	setTheme(theme) {
		if (theme !== "light" && theme !== "dark") {
			throw new Error("Theme must be 'light' or 'dark'");
		}
		this.currentTheme = theme;
		this.notifyListeners();
	}
}

// Create singleton instance
const themeManager = new DeepTutorThemeManager();

// Export for use in components
export { DeepTutorColors, DeepTutorThemeManager, themeManager }; 