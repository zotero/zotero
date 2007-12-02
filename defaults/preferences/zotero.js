// These are DEFAULT prefs for the INSTALL. You will have to reinstall the extension to see differences!

pref("extensions.zotero.firstRun", true);
pref("extensions.zotero@chnm.gmu.edu.description", "chrome://zotero/locale/zotero.properties");

pref("extensions.zotero.useDataDir", false);
pref("extensions.zotero.dataDir", '');
pref("extensions.zotero.lastDataDir", '');
pref("extensions.zotero.debug.log",false);
pref("extensions.zotero.debug.level",5);
pref("extensions.zotero.debug.time", false);
pref("extensions.zotero.automaticScraperUpdates",true);
pref("extensions.zotero.cacheTranslatorData",true);
pref("extensions.zotero.zoteroPaneOnTop",false);
pref("extensions.zotero.statusBarIcon", 2);
pref("extensions.zotero.browserContentContextMenu", true);
pref("extensions.zotero.openURL.resolver","http://athene.gmu.edu:8888/lfp/LinkFinderPlus/Display");
pref("extensions.zotero.openURL.version","0.1");
pref("extensions.zotero.parseEndNoteMIMETypes",true);
pref("extensions.zotero.automaticSnapshots",true);
pref("extensions.zotero.downloadAssociatedFiles",false);
pref("extensions.zotero.reportTranslationFailure",true);
pref("extensions.zotero.automaticTags",true);
pref("extensions.zotero.fontSize", "1.0");
pref("extensions.zotero.recursiveCollections", false);
pref("extensions.zotero.attachmentRenameFormatString", '{%c - }{%y - }{%t{50}}');
pref("extensions.zotero.capitalizeTitles", true);
pref("extensions.zotero.launchNonNativeFiles", false);
pref("extensions.zotero.sortNotesChronologically", false);

pref("extensions.zotero.lastCreatorFieldMode",0);
pref("extensions.zotero.lastAbstractExpand",0);
pref("extensions.zotero.lastRenameAssociatedFile", false);
pref("extensions.zotero.lastViewedFolder", 'L');

// Keyboard shortcuts
pref("extensions.zotero.keys.overrideGlobal", false);
pref("extensions.zotero.keys.openZotero", 'Z');
pref("extensions.zotero.keys.toggleFullscreen", 'F');
pref("extensions.zotero.keys.library", 'L');
pref("extensions.zotero.keys.quicksearch", 'K');
pref("extensions.zotero.keys.newItem", 'N');
pref("extensions.zotero.keys.newNote", 'O');
pref("extensions.zotero.keys.toggleTagSelector", 'T');
pref("extensions.zotero.keys.copySelectedItemCitationsToClipboard", 'A');
pref("extensions.zotero.keys.copySelectedItemsToClipboard", 'C');

// Fulltext indexing
pref("extensions.zotero.fulltext.textMaxLength", 500000);
pref("extensions.zotero.fulltext.pdfMaxPages", 100);
pref("extensions.zotero.search.useLeftBound", true);

// Reports
pref("extensions.zotero.report.includeAllChildItems", true);
pref("extensions.zotero.report.combineChildItems", true);

// Export and citation settings
pref("extensions.zotero.export.lastTranslator", '14763d24-8ba0-45df-8f52-b8d1108e7ac9');
pref("extensions.zotero.export.translatorSettings", 'true,false');
pref("extensions.zotero.export.lastStyle", 'http://www.zotero.org/styles/chicago-note.csl');
pref("extensions.zotero.export.bibliographySettings", 'save-as-rtf');
pref("extensions.zotero.export.bibliographyLocale", '');
pref("extensions.zotero.export.citePaperJournalArticleURL", false);

pref("extensions.zotero.export.quickCopy.setting", 'bibliography=http://www.zotero.org/styles/chicago-note.csl');

// Integration settings
pref("extensions.zotero.integration.autoRegenerate", -1);	// -1 = ask; 0 = no; 1 = yes

// Annotation settings
pref("extensions.zotero.annotations.warnOnClose", true);