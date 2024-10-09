// We only want a single window, I think
pref("toolkit.singletonWindowType", "navigator:browser");

// For debugging purposes, show errors in console by default
pref("javascript.options.showInConsole", true);

// Don't retrieve unrequested links when performing standalone translation
pref("network.prefetch-next", false);

// Let operations run as long as necessary
pref("dom.max_chrome_script_run_time", 0);

pref("intl.locale.requested", '');
pref("intl.regional_prefs.use_os_locales", false);

// Fix error initializing login manager after this was changed in Firefox 57
// Could also disable this with MOZ_LOADER_SHARE_GLOBAL, supposedly
pref("jsloader.shareGlobal", false);

// Needed due to https://bugzilla.mozilla.org/show_bug.cgi?id=1181977
pref("browser.hiddenWindowChromeURL", "chrome://zotero/content/standalone/hiddenWindow.xhtml");
// Use basicViewer for opening new DOM windows from content (for TinyMCE)
pref("browser.chromeURL", "chrome://zotero/content/standalone/basicViewer.xhtml");
// We need these to get the save dialog working with contentAreaUtils.js
pref("browser.download.useDownloadDir", false);
pref("browser.download.manager.showWhenStarting", false);
pref("browser.download.folderList", 1);

// Don't show add-on selection dialog
pref("extensions.shownSelectionUI", true);
pref("extensions.autoDisableScope", 11);

pref("network.protocol-handler.expose-all", false);
pref("network.protocol-handler.expose.zotero", true);
pref("network.protocol-handler.expose.http", true);
pref("network.protocol-handler.expose.https", true);

// Never go offline
pref("offline.autoDetect", false);
pref("network.manage-offline-status", false);

// Without this, we will throw up dialogs if asked to translate strange pages
pref("browser.xul.error_pages.enabled", true);

// Without this, scripts may decide to open popups
pref("dom.disable_open_during_load", true);

// Don't show security warning. The "warn_viewing_mixed" warning just lets the user know that some
// page elements were loaded over an insecure connection. This doesn't matter if all we're doing is
// scraping the page, since we don't provide any information to the site.
pref("security.warn_viewing_mixed", false);

// Preferences for add-on discovery
pref("extensions.getAddons.cache.enabled", false);
//pref("extensions.getAddons.maxResults", 15);
//pref("extensions.getAddons.get.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/guid:%IDS%?src=thunderbird&appOS=%OS%&appVersion=%VERSION%&tMain=%TIME_MAIN%&tFirstPaint=%TIME_FIRST_PAINT%&tSessionRestored=%TIME_SESSION_RESTORED%");
//pref("extensions.getAddons.search.browseURL", "https://addons.mozilla.org/%LOCALE%/%APP%/search?q=%TERMS%");
//pref("extensions.getAddons.search.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/%TERMS%/all/%MAX_RESULTS%/%OS%/%VERSION%?src=thunderbird");
//pref("extensions.webservice.discoverURL", "https://www.zotero.org/support/plugins");

// Check Windows certificate store for custom CAs
pref("security.enterprise_roots.enabled", true);

// Disable add-on signature checking with unbranded Firefox build
pref("xpinstall.signatures.required", false);
// Allow legacy extensions (though this might not be necessary)
pref("extensions.legacy.enabled", true);
// Allow installing XPIs from any host
pref("xpinstall.whitelist.required", false);
// Allow installing XPIs when using a custom CA
pref("extensions.install.requireBuiltInCerts", false);
pref("extensions.update.requireBuiltInCerts", false);

// Don't connect to the Mozilla extensions blocklist
pref("extensions.blocklist.enabled", false);
// Avoid warning in console when opening Tools -> Add-ons
pref("extensions.getAddons.link.url", "");

// Disable places
pref("places.history.enabled", false);

// Probably not used, but prevent an error in the console
pref("app.support.baseURL", "https://www.zotero.org/support/");

// Disable Telemetry, Health Report, error reporting, and remote settings
pref("toolkit.telemetry.unified", false);
pref("toolkit.telemetry.enabled", false);
pref("datareporting.policy.dataSubmissionEnabled", false);
pref("toolkit.crashreporter.enabled", false);
pref("extensions.remoteSettings.disabled", true);

pref("extensions.update.url", "");

// Don't try to load the "Get Add-ons" tab on first load of Add-ons window
pref("extensions.ui.lastCategory", "addons://list/extension");

// Don't show "Using experimental APIs requires a privileged add-on" warning
pref("extensions.experiments.enabled", true);

// Not set on Windows in Firefox anymore since it's a per-installation pref,
// but we override that in fetch_xulrunner
pref("app.update.auto", true);

// URL user can browse to manually if for some reason all update installation
// attempts fail.
pref("app.update.url.manual", "https://www.zotero.org/download");

// A default value for the "More information about this update" link
// supplied in the "An update is available" page of the update wizard.
pref("app.update.url.details", "https://www.zotero.org/support/changelog");

// Interval: Time between checks for a new version (in seconds)
//           default=1 day
pref("app.update.interval", 86400);

// The minimum delay in seconds for the timer to fire.
// default=2 minutes
pref("app.update.timerMinimumDelay", 120);

// Whether or not we show a dialog box informing the user that the update was
// successfully applied. This is off in Firefox by default since we show a
// upgrade start page instead! Other apps may wish to show this UI, and supply
// a whatsNewURL field in their brand.properties that contains a link to a page
// which tells users what's new in this new update.

// update channel for this build
pref("app.update.channel", "default");

// This should probably not be a preference that's used in toolkit....
pref("browser.preferences.instantApply", false);

// Allow elements to be displayed full-screen
pref("full-screen-api.enabled", true);

// Allow chrome access in DevTools
// This enables the input field in the Browser Console tool
pref("devtools.chrome.enabled", true);

// Default mousewheel action with Alt/Option is History Back/Forward in Firefox
// We don't have History navigation and users want to scroll the tree with Option
// key held down
pref("mousewheel.with_alt.action", 1);

// Use the system print dialog instead of the new tab-based print dialog in Firefox
pref("print.prefer_system_dialog", true);

// Disable libvpx decoding/encoding
pref("media.webm.enabled", false);
pref("media.encoder.webm.enabled", false);
pref("media.mediasource.webm.enabled", false);
pref("media.mediasource.webm.audio.enabled", false);
pref("media.mediasource.vp9.enabled", false);
pref("media.ffvpx.enabled", false);
pref("media.ffvpx.mp3.enabled", false);
pref("media.rdd-vpx.enabled", false);
pref("media.rdd-ffvpx.enabled", false);
pref("media.utility-ffvpx.enabled", false);

// Allow collectionTree scrolling when Control is highlighting collections on win
pref("mousewheel.with_control.action", 1);
