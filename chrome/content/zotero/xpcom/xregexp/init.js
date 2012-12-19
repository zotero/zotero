//List of files to be loaded by Zotero
var load = [
	/**Core functions**/
	'xregexp',

	/**Addons**/
	'addons/build',												//adds ability to "build regular expressions using named subpatterns, for readability and pattern reuse"
	'addons/matchrecursive',							//adds ability to "match recursive constructs using XRegExp pattern strings as left and right delimiters"

	/**Unicode support**/
	'addons/unicode/unicode-base',				//required for all other unicode packages. Adds \p{Letter} category

	'addons/unicode/unicode-blocks',			//adds support for all Unicode blocks (e.g. InArabic, InCyrillic_Extended_A, etc.)
	'addons/unicode/unicode-categories',	//adds support for all Unicode categories (e.g. Punctuation, Lowercase_Letter, etc.)
	'addons/unicode/unicode-properties',	//adds Level 1 Unicode properties (e.g. Uppercase, White_Space, etc.)
	'addons/unicode/unicode-scripts'			//adds support for all Unicode scripts (e.g. Gujarati, Cyrillic, etc.)
];