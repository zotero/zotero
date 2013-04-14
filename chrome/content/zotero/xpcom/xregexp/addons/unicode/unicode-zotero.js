/**
 * Adds support for various character categories used by Zotero.
 * Token names are case insensitive, and any spaces, hyphens, and underscores are ignored.
 * @requires XRegExp, Unicode Base
 */
(function(XRegExp) {
    'use strict';

    if (!XRegExp.addUnicodeData) {
        throw new ReferenceError('Unicode Base must be loaded before Unicode Zotero');
    }

    XRegExp.addUnicodeData([
        {
            name: 'WSpace',
            alias: 'White_Space',
            bmp: '\x09-\x0D\x20\x85\xA0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000'
        },
        {
            name: 'Hex',
            alias: 'Hex_Digit',
            bmp: '0-9A-Fa-f\uFF10-\uFF19\uFF21-\uFF26\uFF41-\uFF46'
        },
        {
            name: 'Dash',
            bmp: '\x2D\u058A\u05BE\u1806\u2010-\u2015\u2053\u207B\u208B\u2212\u2E17\u2E1A\u301C\u3030\u30A0\uFE31-\uFE32\uFE58\uFE63\uFF0D'
        },
        {
            name: 'Hyphen',
            bmp: '\x2D\xAD\u058A\u1806\u2010-\u2011\u2E17\u30FB\uFE63\uFF0D\uFF65'
        },
        {
            name: 'QMark',
            alias: 'Quotation_Mark',
            bmp: '\x22\x27\xAB\xBB\u2018\u2019\u201A\u201B-\u201C\u201D\u201E\u201F\u2039\u203A\u300C\u300D\u300E\u300F\u301D\u301E-\u301F\uFE41\uFE42\uFE43\uFE44\uFF02\uFF07\uFF62\uFF63'
        },
        {
            name: 'Term',
            alias: 'Terminal_Punctuation',
            bmp: '\x21\x2C\x2E\x3A-\x3B\x3F\u037E\u0387\u0589\u05C3\u060C\u061B\u061F\u06D4\u0700-\u070A\u070C\u07F8-\u07F9\u0964-\u0965\u0E5A-\u0E5B\u0F08\u0F0D-\u0F12\u104A-\u104B\u1361-\u1368\u166D-\u166E\u16EB-\u16ED\u17D4-\u17D6\u17DA\u1802-\u1805\u1808-\u1809\u1944-\u1945\u1B5A-\u1B5B\u1B5D-\u1B5F\u1C3B-\u1C3F\u1C7E-\u1C7F\u203C-\u203D\u2047-\u2049\u2E2E\u3001-\u3002\uA60D-\uA60F\uA876-\uA877\uA8CE-\uA8CF\uA92F\uAA5D-\uAA5F\uFE50-\uFE52\uFE54-\uFE57\uFF01\uFF0C\uFF0E\uFF1A-\uFF1B\uFF1F\uFF61\uFF64\u1039F\u103D0\u1091F\u12470-\u12473'
        }
    ]);

}(XRegExp));
