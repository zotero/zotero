/*!
  Copyright (c) 2025 Abdullah Atta.
  Licensed under the MIT License (MIT), see
  https://github.com/thecodrr/alfaaz
  Build on commit a132fdb
*/

var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// dist/languages/burmese.js
var require_burmese = __commonJS({
	"dist/languages/burmese.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.BURMESE_UNICODE_RANGE = void 0;
		exports.BURMESE_UNICODE_RANGE = [[4096, 4255]];
	}
});

// dist/languages/cjk.js
var require_cjk = __commonJS({
	"dist/languages/cjk.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.CJK_UNICODE_RANGES = void 0;
		exports.CJK_UNICODE_RANGES = [
			[19968, 40959],
			[13312, 19903],
			[131072, 173791],
			[173824, 177983],
			[177984, 178207],
			[178208, 183983],
			[183984, 191471],
			[196608, 201551],
			[201552, 205743],
			[63744, 64255],
			[194560, 195103],
			[12032, 12255],
			[11904, 12031],
			[12288, 12351],
			[13056, 13311],
			[65072, 65103]
			// CJK Compatibility Forms                     FE30-FE4F
		];
	}
});

// dist/languages/javanese.js
var require_javanese = __commonJS({
	"dist/languages/javanese.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.JAVANESE_UNICODE_RANGE = void 0;
		exports.JAVANESE_UNICODE_RANGE = [[43392, 43487]];
	}
});

// dist/languages/khmer.js
var require_khmer = __commonJS({
	"dist/languages/khmer.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.KHMER_UNICODE_RANGE = void 0;
		exports.KHMER_UNICODE_RANGE = [[6016, 6143]];
	}
});

// dist/languages/lao.js
var require_lao = __commonJS({
	"dist/languages/lao.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.LAO_UNICODE_RANGE = void 0;
		exports.LAO_UNICODE_RANGE = [[3712, 3839]];
	}
});

// dist/languages/thai.js
var require_thai = __commonJS({
	"dist/languages/thai.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.THAI_UNICODE_RANGE = void 0;
		exports.THAI_UNICODE_RANGE = [[3584, 3711]];
	}
});

// dist/languages/vai.js
var require_vai = __commonJS({
	"dist/languages/vai.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.VAI_UNICODE_RANGE = void 0;
		exports.VAI_UNICODE_RANGE = [[42240, 42559]];
	}
});

// dist/languages/index.js
var require_languages = __commonJS({
	"dist/languages/index.js"(exports) {
		"use strict";

		Object.defineProperty(exports, "__esModule", { value: true });
		exports.UNICODE_RANGES = void 0;
		var burmese_1 = require_burmese();
		var cjk_1 = require_cjk();
		var javanese_1 = require_javanese();
		var khmer_1 = require_khmer();
		var lao_1 = require_lao();
		var thai_1 = require_thai();
		var vai_1 = require_vai();
		exports.UNICODE_RANGES = [
			...thai_1.THAI_UNICODE_RANGE,
			...lao_1.LAO_UNICODE_RANGE,
			...burmese_1.BURMESE_UNICODE_RANGE,
			...khmer_1.KHMER_UNICODE_RANGE,
			...javanese_1.JAVANESE_UNICODE_RANGE,
			...vai_1.VAI_UNICODE_RANGE,
			...cjk_1.CJK_UNICODE_RANGES
		];
	}
});

// dist/index.js
var require_index = __commonJS({
	"dist/index.js"(exports) {
		Object.defineProperty(exports, "__esModule", { value: true });
		exports.countLines = exports.countWords = void 0;
		var languages_1 = require_languages();
		var CHINESE_MAX_CODE_POINT = 205743;
		var BYTE_SIZE = 8;
		var BITMAP = new Uint8Array(CHINESE_MAX_CODE_POINT / BYTE_SIZE + 1);
		function insertCharsIntoMap(...chars) {
			for (const char of chars) {
				const charCode = char.charCodeAt(0);
				const byteIndex = Math.floor(charCode / BYTE_SIZE);
				const bitIndex = charCode % BYTE_SIZE;
				BITMAP[byteIndex] = BITMAP[byteIndex] ^ 1 << bitIndex;
			}
		}
		function insertRangeIntoMap(from, to) {
			for (let i = from / BYTE_SIZE; i < Math.ceil(to / BYTE_SIZE); i++) {
				BITMAP[i] = 255;
			}
		}
		var NEWLINE = "\n";
		insertCharsIntoMap(
			" ",
			"\n",
			"	",
			"\v",
			"*",
			"/",
			"&",
			":",
			";",
			".",
			",",
			"?",
			"=",
			"\u0F0B",
			// Tibetan uses [U+0F0B TIBETAN MARK INTERSYLLABIC TSHEG] (pronounced tsek) to signal the end of a syllable.
			"\u1361",
			// Ethiopic text uses the traditional wordspace character [U+1361 ETHIOPIC WORDSPACE] to indicate word boundaries
			"\u200B"
			// ZERO-WIDTH-SPACE can also be considered a word boundary
		);
		for (const range of languages_1.UNICODE_RANGES) {
			insertRangeIntoMap(range[0], range[1]);
		}
		function countWords(str) {
			let count = 0;
			let shouldCount = false;
			for (let i = 0; i < str.length; i++) {
				const charCode = str.charCodeAt(i);
				const byteIndex = charCode / BYTE_SIZE | 0;
				const bitIndex = charCode % BYTE_SIZE;
				const byteAtIndex = BITMAP[byteIndex];
				const isMatch = (byteAtIndex >> bitIndex & 1) === 1;
				if (isMatch && (shouldCount || byteAtIndex === 255)) count++;
				shouldCount = !isMatch;
			}
			if (shouldCount) count++;
			return count;
		}
		exports.countWords = countWords;
		function countLines(str) {
			let count = 0;
			for (let i = -1; (i = str.indexOf(NEWLINE, ++i)) !== -1 && i < str.length; count++) ;
			count++;
			return count;
		}
		exports.countLines = countLines;
	}
});
export default require_index();
