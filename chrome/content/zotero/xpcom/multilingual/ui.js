// Implement UI language switching
// Based on sample application at https://developer.mozilla.org/En/How_to_enable_locale_switching_in_a_XULRunner_application

Zotero.LANGUAGE_NAMES = {
	"af-ZA": "Afrikaans",
	"ar": "Arabic",
	"bg-BG": "Bulgarian",
	"ca-AD": "Catalan",
	"cs-CZ": "Czech",
	"da-DK": "Danish",
	"de-AT": "Austrian",
	"de-CH": "Swiss German",
	"de": "German",
	"el-GR": "Greek",
	"en-US": "English (US)",
	"es-ES": "Spanish",
	"et-EE": "Estonian",
	"eu-ES": "Basque",
	"fa": "Farsi",
	"fi-FI": "Finnish",
	"fr-FR": "French",
	"gl-ES": "Galician",
	"he-IL": "Hebrew",
	"hu-HU": "Magyar",
	"hr-HR": "Croatian",
	"is-IS": "Icelandic",
	"it-IT": "Italian",
	"ja-JP": "Japanese",
	"km": "Khmer",
	"ko-KR": "Korean",
	"mn-MN": "Mongolian",
	"nb-NO": "Norwegian Bokmål",
	"nl-NL": "Dutch",
	"nn-NO": "Norwegian Nynorsk",
	"pl-PL": "Polish",
	"pt-BR": "Brazilian Portuguese",
	"pt-PT": "Portuguese",
	"ro-RO": "Romanian",
	"ru-RU": "Russian",
	"sk-SK": "Slovak",
	"sl-SI": "Slovene",
	"sr-RS": "Serbian",
	"sv-SE": "Swedish",
	"th-TH": "Thai",
	"tr-TR": "Turkish",
	"uk-UA": "Ukranian",
	"vi-VN": "Vietnamese",
	"zh-CN": "Chinese (Mainland)",
	"zh-TW": "Chinese (Taiwan)"
}

Zotero.DOCUMENT_MULTI_PREFERENCES = [
    "citationTranslation",
    "citationTransliteration",
    "citationSort",
    "citationLangPrefsPersons",
    "citationLangPrefsInstitutions",
    "citationLangPrefsTitles",
    "citationLangPrefsPublishers",
    "citationLangPrefsPlaces"
];

Zotero.LANGUAGE_INDEX = {}

Zotero.setupLocale = function(document) {

	try {
		// Query available and selected locales
	
		var chromeRegService = Components.classes["@mozilla.org/chrome/chrome-registry;1"].getService();
		var xulChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIXULChromeRegistry);
		var toolkitChromeReg = chromeRegService.QueryInterface(Components.interfaces.nsIToolkitChromeRegistry);
		
		var selectedLocale = xulChromeReg.getSelectedLocale("zotero");

		var availableLocales = toolkitChromeReg.getLocalesForPackage("zotero");
		
		
		// Render locale menulist
		const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

/////		

		var localeMenulist = document.getElementById("ui-menulist");
		// Wipe out any existing menupopup
		if (localeMenulist.firstChild) {
			localeMenulist.removeChild(firstChild);
		}
		// Set empty popup
		var menupopup = document.createElement('menupopup');
		localeMenulist.appendChild(menupopup);
		
		var selectedItem = null;

		// Get the list of locales and assign names to each item
		var locales = [];
		while(availableLocales.hasMore()) {
			var locale = availableLocales.getNext();
			locales.push({value: locale, label: Zotero.LANGUAGE_NAMES[locale]});
			if (locale == selectedLocale) {
				// Is this the current locale?
				localeMenulist.setAttribute('label', Zotero.LANGUAGE_NAMES[locale]);
				localeMenulist.setAttribute('value', locale);
			}
		}
		// Sort the list by name
		locales.sort( function(a,b){return a.label.localeCompare(b.label)} );
        for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
            Zotero.LANGUAGE_INDEX[locales[i].value] = i;
        }
		// Render the list
		for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
			var locale = locales[i];
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", locale.value);
			menuitem.setAttribute("label", locale.label);	
			menupopup.appendChild(menuitem);
		}

/////

		var availableLocales = toolkitChromeReg.getLocalesForPackage("zotero");
		var selectedLocale = Zotero.Prefs.get('csl.locale');
		if (!selectedLocale) {
			Zotero.Prefs.set('csl.locale', 'en-US');
		}

		var localeMenulist = document.getElementById("locale-menulist");
		// Wipe out any existing menupopup
		if (localeMenulist.firstChild) {
			localeMenulist.removeChild(firstChild);
		}
		// Set empty popup
		var menupopup = document.createElement('menupopup');
		localeMenulist.appendChild(menupopup);
		
		var selectedItem = null;

		// Get the list of locales and assign names to each item
		var locales = [];
		while(availableLocales.hasMore()) {
			var locale = availableLocales.getNext();
			locales.push({value: locale, label: Zotero.LANGUAGE_NAMES[locale]});
			if (locale == selectedLocale) {
				// Is this the current locale?
				localeMenulist.setAttribute('label', Zotero.LANGUAGE_NAMES[locale]);
				localeMenulist.setAttribute('value', locale);
			}
		}
		// Sort the list by name
		locales.sort( function(a,b){return a.label.localeCompare(b.label)} );
        for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
            Zotero.LANGUAGE_INDEX[locales[i].value] = i;
        }
		// Render the list
		for (var i = 0, ilen = locales.length; i < ilen; i += 1) {
			var locale = locales[i];
			var menuitem = document.createElement("menuitem");
			menuitem.setAttribute("value", locale.value);
			menuitem.setAttribute("label", locale.label);	
			menupopup.appendChild(menuitem);
		}
	} catch (err) {
		Zotero.debug ("XXX Failed to render locale menulist: " + err);	
	}	
}


Zotero.switchLocale = function(document) {

	try {
		// Which locale did the user select?
		var localeMenulist = document.getElementById("ui-menulist");
		var newLocale = localeMenulist.getAttribute('value');
		
		// Write preferred locale to local user config
		var prefs = Components.classes["@mozilla.org/preferences-service;1"].
                    getService(Components.interfaces.nsIPrefBranch);
		prefs.setCharPref("general.useragent.locale", newLocale);
		
		// Ignore the locale suggested by the OS
		prefs.setBoolPref("intl.locale.matchOS", false);

		// Restart application
		var appStartup = Components.classes["@mozilla.org/toolkit/app-startup;1"]
                     .getService(Components.interfaces.nsIAppStartup);

		appStartup.quit(Components.interfaces.nsIAppStartup.eRestart |
         		        Components.interfaces.nsIAppStartup.eAttemptQuit);
		
	} catch(err) {
	
		Zotero.debug("XXX Couldn't change locale: " + err);
	}
};


Zotero.setCitationLanguages = function (obj, citeproc) {
	var segments = ['Persons', 'Institutions', 'Titles', 'Publishers', 'Places'];
	for (var i = 0, ilen = segments.length; i < ilen; i += 1) {
        var settings = Zotero.Prefs.get("csl.citation" + segments[i]);
        if (settings) {
            settings = settings.split(",");
        } else {
            settings = ['orig']
        }
		obj['citationLangPrefs'+segments[i]] = settings;
	}
    obj.citationAffixes = null;
    var affixes = Zotero.Prefs.get("csl.citationAffixes");
    if (affixes) {
        affixes = affixes.split("|");
        if (affixes.length === 30) {
            obj.citationAffixes = affixes;
        }
    }
    if (!obj.citationAffixes) {
        obj.citationAffixes = [,,,,,,,,,,,,,,,,,,,,,,,,,,,,,];
    }
	obj.citationTransliteration = [];
	obj.citationTranslation = [];
	obj.citationSort = [];
	var sql = 'SELECT param, tag FROM zlsPreferences '
		+ 'WHERE profile=? AND '
		+ 'param IN (?,?,?)';
	var res = Zotero.DB.query(sql,['default','citationTransliteration','citationTranslation','citationSort']);
	
	if (res) {
		for (var i = 0, ilen = res.length; i < ilen; i += 1) {
			obj[res[i].param].push(res[i].tag);
		}
	}
	if (citeproc) {
		citeproc.setLangPrefsForCites(obj);

		citeproc.setLangTagsForCslTransliteration(obj.citationTransliteration);
		citeproc.setLangTagsForCslTranslation(obj.citationTranslation);
		citeproc.setLangTagsForCslSort(obj.citationSort);

		citeproc.setLangPrefsForCiteAffixes(obj.citationAffixes);

		citeproc.setAutoVietnameseNamesOption(Zotero.Prefs.get('csl.autoVietnameseNames'));
	}
}

Zotero.setRTL = function(node, langs) {
    rtl = false;
    for (var i = langs.length - 1; i > -1; i += -1) {
        var langTag = langs[i];
        if (langTag) {
            langTag = langTag.replace(/^([-a-zA-Z0-9]+).*/,"$1");
        }
        if (langTag) {
            var taglst = langTag.split("-");
            if (["ar", "he", "fa", "ur", "yi", "ps", "syr"].indexOf(taglst[0]) > -1) {
                rtl = true;
                for (var i = 1, ilen = taglst.length; i < ilen; i += 1) {
                    if (taglst[i].length > 3) {
                        rtl = false;
                    }
                }
            }
            // If there is something that looks like a language tag
            // set on the field, it had better be valid. Should always
            // be so, since string input is not allowed.
            break;
        }
    }
    if (rtl) {
        node.setAttribute("style", "direction:rtl !important;");
    } else {
        node.setAttribute("style", "direction:ltr !important;");
    }
};
