export default [
	{
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				Zotero: 'readonly',
				Services: 'readonly',
				ChromeUtils: 'readonly',
				Components: 'readonly',
				Cc: 'readonly',
				Ci: 'readonly',
				Cu: 'readonly',
				Cr: 'readonly',
				IOUtils: 'readonly',
				PathUtils: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
			'no-undef': 'error',
		},
	},
];
