import reactPlugin from "eslint-plugin-react";
import babel from "@babel/eslint-plugin";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	...compat.extends("@zotero"),
	
	{
		files: ['**/*.{js,jsm,jsx,mjs}'],
		
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				Zotero: "readonly",
				ZOTERO_CONFIG: "readonly",
				AddonManager: "readonly",
				Cc: "readonly",
				Ci: "readonly",
				ChromeUtils: "readonly",
				Components: "readonly",
				ConcurrentCaller: "readonly",
				Cr: "readonly",
				ctypes: "readonly",
				OS: "readonly",
				MozXULElement: "readonly",
				PathUtils: "readonly",
				PluralForm: "readonly",
				Services: "readonly",
				windowUtils: "readonly",
				XPCOMUtils: "readonly",
				XRegExp: "readonly",
				XULElement: "readonly",
				XULElementBase: "readonly",
				XULElementMixin: "readonly",
				XULTextElement: "readonly",
				ItemPaneSectionElementBase: "readonly",
				Cu: "readonly",
				ChromeWorker: "readonly",
				Localization: "readonly",
				L10nFileSource: "readonly",
				L10nRegistry: "readonly",
				ZoteroPane_Local: "readonly",
				ZoteroPane: "readonly",
				Zotero_Tabs: "readonly",
				ZoteroContextPane: "readonly",
				Zotero_File_Interface: "readonly",
				Zotero_LocateMenu: "readonly",
				IOUtils: "readonly",
				NetUtil: "readonly",
				FileUtils: "readonly",
				globalThis: "readonly",
			},
			
			parser: babelParser,
			ecmaVersion: 2022,
			sourceType: "module",
			
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
		
		plugins: {
			"@babel": babel,
		},
		
		settings: {
			react: {
				version: "detect",
			},
		},
	},
	
	reactPlugin.configs.flat.recommended,
	reactPlugin.configs.flat['jsx-runtime'],
	
	{
		ignores: [
			"build/*",
			"chrome/content/zotero/xpcom/citeproc.js",
			"chrome/content/zotero/xpcom/isbn.js",
			"chrome/content/zotero/xpcom/rdf/*",
			"chrome/content/zotero/xpcom/xregexp/*",
			"chrome/content/zotero/xpcom/translation/tlds.js",
			"resource/bluebird/*",
			"resource/classnames.js",
			"resource/citeproc_rs*",
			"resource/jspath.js",
			"resource/loader.mjs",
			"resource/pako.js",
			"resource/PluralForm.jsm",
			"resource/prop-types.js",
			"resource/react*",
			"resource/require.js",
			"resource/SingleFile/*",
			"resource/tinymce/*",
			"test/resource/*",
			"translators/*",
		]
	}
];
