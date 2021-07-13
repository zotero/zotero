/* eslint-disable camelcase, no-unused-vars */

var mendeleyOnlineMappings = {
	// lookup to normalise from item type presented by API to item type as stored in DB
	apiTypeToDBType: {
		bill: 'Bill',
		book: 'Book',
		book_section: 'BookSection',
		case: 'Case',
		computer_program: 'ComputerProgram',
		conference_proceedings: 'ConferenceProceedings',
		encyclopedia_article: 'EncyclopediaArticle',
		film: 'Film',
		generic: 'Generic',
		hearing: 'Hearing',
		journal: 'JournalArticle',
		magazine_article: 'MagazineArticle',
		newspaper_article: 'NewspaperArticle',
		patent: 'Patent',
		report: 'Report',
		statute: 'Statute',
		television_broadcast: 'TelevisionBroadcast',
		thesis: 'Thesis',
		web_page: 'WebPage',
		working_paper: 'WorkingPaper'
	},
	apiFieldToDBField: {
		accessed: 'dateAccessed',
		authors: false, // all author types handled separately
		citation_key: 'citationKey',
		created: 'added',
		edition: 'edition',
		editors: false, // all author types handled separately
		file_attached: false,
		folder_uuids: false, // collections handled separately
		group_id: 'groupID',
		identifiers: false, // identifiers are separately copied directly into document
		keywords: false, // tags handled separately
		last_modified: 'modified',
		notes: 'note',
		patent_application_number: 'patentApplicationNumber',
		patent_legal_status: 'patentLegalStatus',
		patent_owner: 'patentOwner',
		private_publication: 'privatePublication',
		profile_id: 'profileID',
		reprint_edition: 'reprintEdition',
		revision: 'revisionNumber',
		series_editor: 'seriesEditor',
		series_number: 'seriesNumber',
		short_title: 'shortTitle',
		source: 'publication',
		source_type: 'sourceType',
		starred: 'favourite',
		tags: false, // tags handled separately
		translators: false, // all author types handled separately
		user_context: 'userContext',
		websites: false // URLs handled separately
	}
};
