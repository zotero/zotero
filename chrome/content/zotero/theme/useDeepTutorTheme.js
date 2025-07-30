/**
 * React Hook for DeepTutor Theme Management
 * Provides easy access to current theme and colors
 */

import { useState, useEffect } from "react";
import { themeManager } from "./DeepTutorTheme.js";

/**
 * Custom hook for accessing DeepTutor theme
 * @returns {Object} Theme state and colors
 */
export function useDeepTutorTheme() {
	const [themeState, setThemeState] = useState({
		theme: themeManager.getCurrentTheme(),
		colors: themeManager.getColors()
	});
	
	useEffect(() => {
		// Function to handle theme changes
		const handleThemeChange = (theme, colors) => {
			setThemeState({ theme, colors });
		};
		
		// Add listener for theme changes
		themeManager.addListener(handleThemeChange);
		
		// Cleanup function
		return () => {
			themeManager.removeListener(handleThemeChange);
		};
	}, []);
	
	// Helper functions for easy color access
	const getColor = (category, subcategory) => {
		return themeManager.getColor(category, subcategory);
	};
	
	const isDark = themeState.theme === "dark";
	const isLight = themeState.theme === "light";
	
	return {
		...themeState,
		getColor,
		isDark,
		isLight,
		setTheme: themeManager.setTheme.bind(themeManager)
	};
}

/**
 * Hook for getting specific color values
 * @param {string} category - Color category (e.g., 'background', 'text')
 * @param {string} subcategory - Color subcategory (e.g., 'primary', 'secondary')
 * @returns {string} Color value
 */
export function useDeepTutorColor(category, subcategory) {
	const { getColor } = useDeepTutorTheme();
	return getColor(category, subcategory);
}

/**
 * Hook for checking if current theme is dark
 * @returns {boolean} True if dark theme is active
 */
export function useIsDarkTheme() {
	const { isDark } = useDeepTutorTheme();
	return isDark;
} 