const Cc = Components.classes;
const Ci = Components.interfaces;

const OPTIONS_AC_CLASS_ID = Components.ID('{882f1f42-c1ff-458c-9157-06a4a55d32e8}');
const OPTIONS_AC_NAME = "zotero-options";
const OPTIONS_AC_CONTRACT_ID = `@mozilla.org/autocomplete/search;1?name=${OPTIONS_AC_NAME}`;

function makeResult(searchString, matches) {
	const r = Cc["@mozilla.org/autocomplete/simple-result;1"]
		.createInstance(Ci.nsIAutoCompleteSimpleResult);

	r.setSearchString(searchString);

	if (matches.length === 0) {
		r.setSearchResult(Ci.nsIAutoCompleteResult.RESULT_NOMATCH);
		r.setDefaultIndex(-1);
		return r;
	}

	r.setSearchResult(Ci.nsIAutoCompleteResult.RESULT_SUCCESS);
	r.setDefaultIndex(0);

	for (const m of matches) {
		r.appendMatch(m, "");
	}
	return r;
}

export class OptionsAutoComplete {
	static init() {
		const registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
		if (registrar.isCIDRegistered(OPTIONS_AC_CLASS_ID)) {
			return;
		}
		registrar.registerFactory(
			OPTIONS_AC_CLASS_ID, "", OPTIONS_AC_CONTRACT_ID, new OptionsAutoComplete()
		);
	}

	// nsIAutoCompleteSearch
	startSearch(searchString, searchParams, previousResult, listener) {
		searchParams = JSON.parse(searchParams);
		if (!searchParams) {
			throw new Error("Invalid JSON passed to autocomplete");
		}

		const matches = (searchParams?.options ?? [])
			.filter(w => w.toLowerCase().startsWith((searchString || "").toLowerCase()))
			.slice(0, 10);
		const result = makeResult(searchString, matches);
		listener.onSearchResult(this, result);
	}

	// nsIAutoCompleteSearch
	stopSearch() {
	}

	// nsIFactory
	createInstance(iid) {
		return this.QueryInterface(iid);
	}
}

OptionsAutoComplete.prototype.classID = OPTIONS_AC_CLASS_ID;
OptionsAutoComplete.prototype.QueryInterface = ChromeUtils.generateQI([
	"nsIFactory",
	"nsIAutoCompleteSearch",
]);
