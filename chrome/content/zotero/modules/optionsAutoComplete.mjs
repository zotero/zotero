const Cc = Components.classes;
const Ci = Components.interfaces;

const OPTIONS_AC_CLASS_ID = Components.ID('{882f1f42-c1ff-458c-9157-06a4a55d32e8}');
const OPTIONS_AC_NAME = "zotero-options";
const OPTIONS_AC_CONTRACT_ID = `@mozilla.org/autocomplete/search;1?name=${OPTIONS_AC_NAME}`;

function makeResult(searchString, matches, { noValueLabel, values } = {}) {
	const r = Cc["@mozilla.org/autocomplete/simple-result;1"]
		.createInstance(Ci.nsIAutoCompleteSimpleResult);

	r.setSearchString(searchString);

	if (matches.length === 0 && !noValueLabel) {
		r.setSearchResult(Ci.nsIAutoCompleteResult.RESULT_NOMATCH);
		r.setDefaultIndex(-1);
		return r;
	}

	r.setSearchResult(Ci.nsIAutoCompleteResult.RESULT_SUCCESS);
	r.setDefaultIndex(0);

	for (let i = 0; i < matches.length; i++) {
		let label = matches[i];
		let value = values?.[i] ?? label;
		r.appendMatch(label, "", null, "options-ac-value", value, label);
	}
	if (noValueLabel) {
		r.appendMatch("", noValueLabel, null, "options-ac-no-value", "", noValueLabel);
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

		let allOptions = searchParams?.options ?? [];
		let allValues = searchParams?.optionValues ?? allOptions;
		let search = (searchString || "").toLowerCase();
		let filtered = allOptions
			.map((label, i) => ({ label, value: allValues[i] ?? label }))
			.filter(({ value }) => value.toLowerCase().startsWith(search))
			.slice(0, 10);
		let matches = filtered.map(({ label }) => label);
		let values = filtered.map(({ value }) => value);
		let noValueLabel = searchParams?.includeNoValue && !searchString
			? Zotero.getString('item-pane-batch-editing-no-value')
			: null;
		const result = makeResult(searchString, matches, { noValueLabel, values });
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
