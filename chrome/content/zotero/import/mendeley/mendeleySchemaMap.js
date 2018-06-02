var map = {
	83: {
		itemTypes: {
			Bill: "bill",
			Book: "book",
			BookSection: "bookSection",
			Case: "case",
			ComputerProgram: "computerProgram",
			ConferenceProceedings: "conferencePaper",
			EncyclopediaArticle: "encyclopediaArticle",
			Film: "film",
			Generic: "document",
			JournalArticle: "journalArticle",
			MagazineArticle: "magazineArticle",
			NewspaperArticle: "newspaperArticle",
			Patent: "patent",
			Report: "report",
			Statute: "statute",
			TelevisionBroadcast: "tvBroadcast",
			Thesis: "thesis",
			WebPage: "webpage",
			WorkingPaper: "report"
		},
		fields: {
			id: "",
			uuid: "",
			reviewedArticle: "",
			revisionNumber: "",
			publisher: "publisher",
			reprintEdition: "",
			series: "seriesTitle",
			seriesNumber: "seriesNumber",
			sections: "section",
			seriesEditor: "creator[seriesEditor]", // falls back to editor if necessary
			owner: "",
			pages: "func[pages]",
			month: "", // handled explicitly
			originalPublication: "",
			publication: "publicationTitle",
			publicLawNumber: "publicLawNumber",
			pmid: "extra[PMID]",
			sourceType: "",
			session: "session",
			shortTitle: "shortTitle",
			volume: "volume",
			year: "", // handled explicitly
			userType: "type",
			country: "place[country]",
			dateAccessed: "accessDate",
			committee: "committee",
			counsel: "creator[counsel]",
			doi: "DOI",
			edition: "edition",
			day: "", // handled explicitly
			department: "",
			citationKey: "citationKey", // put in Extra
			city: "place[city]",
			chapter: "",
			codeSection: "section",
			codeVolume: "codeVolume",
			code: "code",
			codeNumber: "codeNumber",
			issue: "issue",
			language: "language",
			isbn: "ISBN",
			issn: "ISSN",
			length: "",
			medium: "medium",
			lastUpdate: "",
			legalStatus: "legalStatus",
			hideFromMendeleyWebIndex: "",
			institution: "publisher",
			genre: "genre",
			internationalTitle: "",
			internationalUserType: "",
			internationalAuthor: "",
			internationalNumber: "",
			deletionPending: "",
			favourite: "", // tag?
			confirmed: "", // tag?
			deduplicated: "",
			read: "", // tag?
			type: "", // item type handled separately
			title: "title",
			privacy: "",
			applicationNumber: "applicationNumber",
			arxivId: "extra[arXiv]",
			advisor: "",
			articleColumn: "",
			modified: "func[fromUnixtime:dateModified]",
			abstract: "abstractNote",
			added: "func[fromUnixtime:dateAdded]",
			note: "func[note]",
			importer: ""
		},
		creatorTypes: {
			DocumentAuthor: "author",
			DocumentEditor: "editor",
			DocumentTranslator: "translator"
		}
	}
};
