// These are DEFAULT prefs for the install.
//
// Add new user-adjustable hidden preferences to
// http://www.zotero.org/documentation/hidden_prefs

pref("extensions.zotero.firstRun2", true);

pref("extensions.zotero.saveRelativeAttachmentPath", false);
pref("extensions.zotero.baseAttachmentPath", "");
pref("extensions.zotero.useDataDir", false);
pref("extensions.zotero.dataDir", "");
pref("extensions.zotero.warnOnUnsafeDataDir", true);
pref("extensions.zotero.debug.log",false);
pref("extensions.zotero.debug.log.slowTime", 250);
pref("extensions.zotero.debug.stackTrace", false);
pref("extensions.zotero.debug.store",false);
pref("extensions.zotero.debug.store.limit",500000);
pref("extensions.zotero.debug.store.submitSize",10000000);
pref("extensions.zotero.debug.store.submitLineLength",10000);
pref("extensions.zotero.debug.level",5);
pref("extensions.zotero.automaticScraperUpdates",true);
pref("extensions.zotero.triggerProxyAuthentication", true);
// Proxy auth URLs should respond successfully to HEAD requests over HTTP and HTTPS (in case of forced HTTPS requests)
pref("extensions.zotero.proxyAuthenticationURLs", "https://www.acm.org,https://www.ebscohost.com,https://www.sciencedirect.com,https://ieeexplore.ieee.org,https://www.jstor.org,http://www.ovid.com,https://link.springer.com,https://www.tandfonline.com");
pref("extensions.zotero.openURL.resolver","");
pref("extensions.zotero.automaticSnapshots",true);
pref("extensions.zotero.downloadAssociatedFiles",true);
pref("extensions.zotero.findPDFs.resolvers", '[]');
pref("extensions.zotero.reportTranslationFailure",true);
pref("extensions.zotero.automaticTags",true);
pref("extensions.zotero.fontSize", "1.00");
pref("extensions.zotero.layout", "standard");
pref("extensions.zotero.recursiveCollections", false);
pref("extensions.zotero.autoRecognizeFiles", true);
pref("extensions.zotero.autoRenameFiles", true);
pref("extensions.zotero.autoRenameFiles.linked", false);
pref("extensions.zotero.autoRenameFiles.fileTypes", "application/pdf,application/epub+zip");
pref("extensions.zotero.attachmentRenameTemplate", "{{ firstCreator suffix=\" - \" }}{{ year suffix=\" - \" }}{{ title truncate=\"100\" }}");
pref("extensions.zotero.capitalizeTitles", false);
pref("extensions.zotero.launchNonNativeFiles", false);
pref("extensions.zotero.sortNotesChronologically", false);
pref("extensions.zotero.sortNotesChronologically.reader", true);
pref("extensions.zotero.sortAttachmentsChronologically", false);
pref("extensions.zotero.showTrashWhenEmpty", true);
pref("extensions.zotero.trashAutoEmptyDays", 30);
pref("extensions.zotero.viewOnDoubleClick", true);
pref("extensions.zotero.firstRunGuidance", true);
pref("extensions.zotero.firstRunGuidanceShown.z7Banner", true);
pref("extensions.zotero.showConnectorVersionWarning", true);
pref("extensions.zotero.reopenPanesOnRestart", true);

pref("extensions.zotero.groups.copyChildLinks", true);
pref("extensions.zotero.groups.copyChildFileAttachments", true);
pref("extensions.zotero.groups.copyAnnotations", true);
pref("extensions.zotero.groups.copyChildNotes", true);
pref("extensions.zotero.groups.copyTags", true);

pref("extensions.zotero.feeds.sortAscending", false);
pref("extensions.zotero.feeds.defaultTTL", 1);
pref("extensions.zotero.feeds.defaultCleanupReadAfter", 3);
pref("extensions.zotero.feeds.defaultCleanupUnreadAfter", 30);

pref("extensions.zotero.backup.numBackups", 2);
pref("extensions.zotero.backup.interval", 1440);

pref("extensions.zotero.lastCreatorFieldMode",0);
pref("extensions.zotero.lastAbstractExpand", true);
pref("extensions.zotero.lastRenameAssociatedFile", false);
pref("extensions.zotero.lastLongTagMode", 0);
pref("extensions.zotero.lastLongTagDelimiter", ";");

pref("extensions.zotero.fallbackSort", "firstCreator,date,title,dateAdded");
pref("extensions.zotero.sortCreatorAsString", false);

pref("extensions.zotero.uiDensity", "comfortable");

pref("extensions.zotero.itemPaneHeader", "title");
pref("extensions.zotero.itemPaneHeader.bibEntry.style", "http://www.zotero.org/styles/apa");
pref("extensions.zotero.itemPaneHeader.bibEntry.locale", "");

//Tag Selector
pref("extensions.zotero.tagSelector.showAutomatic", true);
pref("extensions.zotero.tagSelector.displayAllTags", false);

pref("extensions.zotero.downloadPDFViaBrowser.onLoadTimeout", 3000);
pref("extensions.zotero.downloadPDFViaBrowser.downloadTimeout", 60000);

// Keyboard shortcuts
pref("extensions.zotero.keys.saveToZotero", "S");
pref("extensions.zotero.keys.newItem", "N");
pref("extensions.zotero.keys.newNote", "O");
pref("extensions.zotero.keys.library", "L");
pref("extensions.zotero.keys.quicksearch", "K");
pref("extensions.zotero.keys.copySelectedItemCitationsToClipboard", "A");
pref("extensions.zotero.keys.copySelectedItemsToClipboard", "C");
pref("extensions.zotero.keys.sync", "Y");
pref("extensions.zotero.keys.toggleAllRead", "R");
pref("extensions.zotero.keys.toggleRead", "`");

pref("extensions.zotero.search.quicksearch-mode", "fields");

// Fulltext indexing
pref("extensions.zotero.fulltext.textMaxLength", 500000);
pref("extensions.zotero.fulltext.pdfMaxPages", 100);
pref("extensions.zotero.search.useLeftBound", true);

// Notes
pref("extensions.zotero.note.fontFamily", "-apple-system, BlinkMacSystemFont, \"Segoe UI\", \"Helvetica Neue\", Helvetica, Arial, sans-serif");
pref("extensions.zotero.note.fontSize", "14");
pref("extensions.zotero.note.css", "");
pref("extensions.zotero.note.smartQuotes", true);

// Reports
pref("extensions.zotero.report.includeAllChildItems", true);
pref("extensions.zotero.report.combineChildItems", true);

// Export and citation settings
pref("extensions.zotero.export.lastTranslator", "14763d24-8ba0-45df-8f52-b8d1108e7ac9");
pref("extensions.zotero.export.translatorSettings", "true,false");
pref("extensions.zotero.export.lastNoteTranslator", "1412e9e2-51e1-42ec-aa35-e036a895534b");
pref("extensions.zotero.export.noteTranslatorSettings", "");
pref("extensions.zotero.export.lastStyle", "http://www.zotero.org/styles/chicago-note-bibliography");
pref("extensions.zotero.export.bibliographySettings", "save-as-rtf");
pref("extensions.zotero.export.displayCharsetOption", true);
pref("extensions.zotero.export.citePaperJournalArticleURL", false);
pref("extensions.zotero.cite.automaticJournalAbbreviations", true);
pref("extensions.zotero.cite.useCiteprocRs", false);
pref("extensions.zotero.import.createNewCollection.fromFileOpenHandler", true);
pref("extensions.zotero.rtfScan.lastInputFile", "");
pref("extensions.zotero.rtfScan.lastOutputFile", "");

pref("extensions.zotero.export.quickCopy.setting", "bibliography=http://www.zotero.org/styles/chicago-note-bibliography");
pref("extensions.zotero.export.quickCopy.dragLimit", 50);

pref("extensions.zotero.export.noteQuickCopy.setting", '{"mode":"export","id":"a45eca67-1ee8-45e5-b4c6-23fb8a852873","markdownOptions":{"includeAppLinks":true},"htmlOptions":{"includeAppLinks":false}}');

// Integration settings
pref("extensions.zotero.integration.port", 50001);
pref("extensions.zotero.integration.autoRegenerate", -1);	// -1 = ask; 0 = no; 1 = yes
pref("extensions.zotero.integration.useClassicAddCitationDialog", false);
pref("extensions.zotero.integration.keepAddCitationDialogRaised", false);
pref("extensions.zotero.integration.upgradeTemplateDelayedOn", 0);
pref("extensions.zotero.integration.dontPromptMendeleyImport", false);

// Connector settings
pref("extensions.zotero.httpServer.enabled", true);
pref("extensions.zotero.httpServer.port", 23119);	// ascii "ZO"
pref("extensions.zotero.httpServer.localAPI.enabled", false);

// Zeroconf
pref("extensions.zotero.zeroconf.server.enabled", false);

// Streaming server
pref("extensions.zotero.streaming.enabled", true);

// Sync
pref("extensions.zotero.sync.autoSync", true);
pref("extensions.zotero.sync.server.username", "");
pref("extensions.zotero.sync.server.compressData", true);
pref("extensions.zotero.sync.storage.enabled", true);
pref("extensions.zotero.sync.storage.protocol", "zotero");
pref("extensions.zotero.sync.storage.verified", false);
pref("extensions.zotero.sync.storage.scheme", "https");
pref("extensions.zotero.sync.storage.url", "");
pref("extensions.zotero.sync.storage.username", "");
pref("extensions.zotero.sync.storage.maxDownloads", 4);
pref("extensions.zotero.sync.storage.maxUploads", 2);
pref("extensions.zotero.sync.storage.deleteDelayDays", 30);
pref("extensions.zotero.sync.storage.groups.enabled", true);
pref("extensions.zotero.sync.storage.downloadMode.personal", "on-sync");
pref("extensions.zotero.sync.storage.downloadMode.groups", "on-sync");
pref("extensions.zotero.sync.fulltext.enabled", true);
pref("extensions.zotero.sync.reminder.setUp.enabled", true);
pref("extensions.zotero.sync.reminder.setUp.lastDisplayed", 0);
pref("extensions.zotero.sync.reminder.autoSync.enabled", true);
pref("extensions.zotero.sync.reminder.autoSync.lastDisplayed", 0);

// Proxy
pref("extensions.zotero.proxies.autoRecognize", true);
pref("extensions.zotero.proxies.transparent", true);
pref("extensions.zotero.proxies.disableByDomain", false);
pref("extensions.zotero.proxies.disableByDomainString", ".edu");
pref("extensions.zotero.proxies.showRedirectNotification", true);

// Data layer purging
pref("extensions.zotero.purge.creators", false);
pref("extensions.zotero.purge.fulltext", false);
pref("extensions.zotero.purge.items", false);
pref("extensions.zotero.purge.tags", false);

// Zotero pane persistent data
pref("extensions.zotero.pane.persist", "");
pref("extensions.zotero.showAttachmentPreview", true);

pref("extensions.zotero.fileHandler.pdf", "");
pref("extensions.zotero.fileHandler.epub", "");
pref("extensions.zotero.fileHandler.snapshot", "");
pref("extensions.zotero.openReaderInNewWindow", false);

// File/URL opening executable if launch() fails
pref("extensions.zotero.fallbackLauncher.unix", "/usr/bin/xdg-open");
pref("extensions.zotero.fallbackLauncher.windows", "");

//Translators
pref("extensions.zotero.translators.attachSupplementary", false);
pref("extensions.zotero.translators.supplementaryAsLink", false);
pref("extensions.zotero.translators.RIS.import.ignoreUnknown", true);
pref("extensions.zotero.translators.RIS.import.keepID", false);

// Retracted Items
pref("extensions.zotero.retractions.enabled", true);
pref("extensions.zotero.retractions.recentItems", "[]");

// Annotations
pref("extensions.zotero.annotations.noteTemplates.title", "<h1>{{title}}<br/>({{date}})</h1>");
pref("extensions.zotero.annotations.noteTemplates.highlight", "<p>{{highlight}} {{citation}} {{comment}}</p>");
pref("extensions.zotero.annotations.noteTemplates.note", "<p>{{citation}} {{comment}}</p>");

// Scaffold
pref("extensions.zotero.scaffold.eslint.enabled", true);

// Tabs
pref("extensions.zotero.tabs.title.reader", "titleCreatorYear");

// Reader
pref("extensions.zotero.reader.textSelectionAnnotationMode", "highlight");
pref("extensions.zotero.reader.contentDarkMode", true);
pref("extensions.zotero.reader.ebookFontFamily", "Georgia, serif");
pref("extensions.zotero.reader.ebookHyphenate", true);
pref("extensions.zotero.reader.autoDisableTool.note", true);
pref("extensions.zotero.reader.autoDisableTool.text", true);
pref("extensions.zotero.reader.autoDisableTool.image", true);

// Set color scheme to auto by default
pref("browser.theme.toolbar-theme", 2);
