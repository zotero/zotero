// These are DEFAULT prefs for the install.
//
// Add new user-adjustable hidden preferences to
// http://www.zotero.org/documentation/hidden_prefs

pref("extensions.zotero.firstRun", true);
pref("extensions.zotero@chnm.gmu.edu.description", "chrome://zotero/locale/zotero.properties");

pref("extensions.zotero.useDataDir", false);
pref("extensions.zotero.dataDir", '');
pref("extensions.zotero.lastDataDir", '');
pref("extensions.zotero.dbLockExclusive", true);
pref("extensions.zotero.debug.log",false);
pref("extensions.zotero.debug.store",false);
pref("extensions.zotero.debug.store.limit",750000);
pref("extensions.zotero.debug.level",5);
pref("extensions.zotero.debug.time", false);
pref("extensions.zotero.automaticScraperUpdates",true);
pref("extensions.zotero.zoteroDotOrgVersionHeader", true);
pref("extensions.zotero.cacheTranslatorData",true);
pref("extensions.zotero.statusBarIcon", 2);
pref("extensions.zotero.browserContentContextMenu", true);
pref("extensions.zotero.openURL.resolver","http://worldcatlibraries.org/registry/gateway");
pref("extensions.zotero.openURL.version","1.0");
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
pref("extensions.zotero.sortAttachmentsChronologically", false);
pref("extensions.zotero.showTrashWhenEmpty", true);
pref("extensions.zotero.viewOnDoubleClick", true);

pref("extensions.zotero.groups.copyChildLinks", true);
pref("extensions.zotero.groups.copyChildFileAttachments", true);
pref("extensions.zotero.groups.copyChildNotes", true);

pref("extensions.zotero.backup.numBackups", 2);
pref("extensions.zotero.backup.interval", 1440);

pref("extensions.zotero.lastCreatorFieldMode",0);
pref("extensions.zotero.lastAbstractExpand",0);
pref("extensions.zotero.lastRenameAssociatedFile", false);
pref("extensions.zotero.lastViewedFolder", 'L');
pref("extensions.zotero.lastLongTagMode", 0);
pref("extensions.zotero.lastLongTagDelimiter", ";");

//Tag Cloud
pref("extensions.zotero.tagCloud", false);

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
pref("extensions.zotero.keys.importFromClipboard", 'V');

// Fulltext indexing
pref("extensions.zotero.fulltext.textMaxLength", 500000);
pref("extensions.zotero.fulltext.pdfMaxPages", 100);
pref("extensions.zotero.search.useLeftBound", true);

// Notes
pref("extensions.zotero.note.fontFamily", "Lucida Grande, Tahoma, Verdana, Helvetica, sans-serif");
pref("extensions.zotero.note.fontSize", "11");
pref("extensions.zotero.note.css", "");

// Reports
pref("extensions.zotero.report.includeAllChildItems", true);
pref("extensions.zotero.report.combineChildItems", true);

// Export and citation settings
pref("extensions.zotero.export.lastTranslator", '14763d24-8ba0-45df-8f52-b8d1108e7ac9');
pref("extensions.zotero.export.translatorSettings", 'true,false');
pref("extensions.zotero.export.lastStyle", 'http://www.zotero.org/styles/chicago-note');
pref("extensions.zotero.export.bibliographySettings", 'save-as-rtf');
pref("extensions.zotero.export.bibliographyLocale", '');
pref("extensions.zotero.export.citePaperJournalArticleURL", false);
pref("extensions.zotero.export.displayCharsetOption", false);
pref("extensions.zotero.import.charset", "auto");
pref("extensions.zotero.rtfScan.lastInputFile", "");
pref("extensions.zotero.rtfScan.lastOutputFile", "");

pref("extensions.zotero.export.quickCopy.setting", 'bibliography=http://www.zotero.org/styles/chicago-note');
pref("extensions.zotero.export.quickCopy.dragLimit", 50);
pref("extensions.zotero.export.quickCopy.quoteBlockquotes.plainText", true);
pref("extensions.zotero.export.quickCopy.quoteBlockquotes.richText", true);
pref("extensions.zotero.export.quickCopy.compatibility.indentBlockquotes", true);
pref("extensions.zotero.export.quickCopy.compatibility.word", false);

// Integration settings
pref("extensions.zotero.integration.port", 50001);
pref("extensions.zotero.integration.autoRegenerate", -1);	// -1 = ask; 0 = no; 1 = yes
pref("extensions.zotero.integration.realWindow", false);

// Zeroconf
pref("extensions.zotero.zeroconf.server.enabled", false);

// Zotero Commons
pref("extensions.zotero.commons.enabled", false);
pref("extensions.zotero.commons.buckets", '');
pref("extensions.zotero.commons.accessKey", '');
pref("extensions.zotero.commons.secretKey", '');

// Annotation settings
pref("extensions.zotero.annotations.warnOnClose", true);

// Sync
pref("extensions.zotero.sync.autoSync", true);
pref("extensions.zotero.sync.server.username", '');
pref("extensions.zotero.sync.server.compressData", true);
pref("extensions.zotero.sync.storage.enabled", true);
pref("extensions.zotero.sync.storage.protocol", "zotero");
pref("extensions.zotero.sync.storage.verified", false);
pref("extensions.zotero.sync.storage.scheme", 'https');
pref("extensions.zotero.sync.storage.url", '');
pref("extensions.zotero.sync.storage.username", '');
pref("extensions.zotero.sync.storage.maxDownloads", 4);
pref("extensions.zotero.sync.storage.maxUploads", 4);
pref("extensions.zotero.sync.storage.deleteDelayDays", 30);
pref("extensions.zotero.sync.storage.groups.enabled", true);

// Proxy
pref("extensions.zotero.proxies.transparent", true);

// Data layer purging
pref("extensions.zotero.purge.creators", false);
pref("extensions.zotero.purge.fulltext", false);
pref("extensions.zotero.purge.items", false);
pref("extensions.zotero.purge.tags", false);
