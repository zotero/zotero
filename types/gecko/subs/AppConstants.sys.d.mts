/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * AppConstants is a set of immutable constants that are defined at build time.
 * These should not depend on any other JavaScript module.
 */
export const AppConstants: Readonly<{
  // See this wiki page for more details about channel specific build
  // defines: https://wiki.mozilla.org/Platform/Channel-specific_build_defines
  NIGHTLY_BUILD: boolean;

  ENABLE_EXPLICIT_RESOURCE_MANAGEMENT: boolean;

  RELEASE_OR_BETA: boolean;

  EARLY_BETA_OR_EARLIER: boolean;

  IS_ESR: boolean;

  ACCESSIBILITY: boolean;

  // Official corresponds, roughly, to whether this build is performed
  // on Mozilla's continuous integration infrastructure. You should
  // disable developer-only functionality when this flag is set.
  MOZILLA_OFFICIAL: boolean;

  MOZ_OFFICIAL_BRANDING: boolean;

  MOZ_DEV_EDITION: boolean;

  MOZ_SERVICES_SYNC: boolean;

  MOZ_DATA_REPORTING: boolean;

  MOZ_SANDBOX: boolean;

  // #ifdef MOZ_TELEMETRY_REPORTING
  MOZ_TELEMETRY_REPORTING: boolean;

  MOZ_UPDATER: boolean;

  MOZ_WEBRTC: boolean;

  // #ifdef MOZ_WIDGET_GTK
  MOZ_WIDGET_GTK: boolean;

  MOZ_WMF_CDM: boolean;

  // #ifdef XP_UNIX
  XP_UNIX: boolean;

  // NOTE! XP_LINUX has to go after MOZ_WIDGET_ANDROID otherwise Android
  // builds will be misidentified as linux.

  // #ifdef MOZ_WIDGET_GTK, XP_WIN, XP_MACOSX, XP_IOS, MOZ_WIDGET_ANDROID, !XP_LINUX
  readonly platform: Platform;

  // Most of our frontend code assumes that any desktop Unix platform
  // is "linux". Add the distinction for code that needs it.

  // #ifdef XP_LINUX, XP_OPENBSD, XP_NETBSD, XP_FREEBSD, XP_SOLARIS
  unixstyle: "linux" | "openbsd" | "netbsd" | "freebsd" | "solaris" | "other";

  isPlatformAndVersionAtLeast(platform: Platform, version: string): boolean;
  isPlatformAndVersionAtMost(platform: Platform, version: string): boolean;

  MOZ_CRASHREPORTER: boolean;

  MOZ_NORMANDY: boolean;

  MOZ_MAINTENANCE_SERVICE: boolean;

  MOZ_BACKGROUNDTASKS: boolean;

  MOZ_UPDATE_AGENT: boolean;

  MOZ_BITS_DOWNLOAD: boolean;

  DEBUG: boolean;

  ASAN: boolean;

  ASAN_REPORTER: boolean;

  TSAN: boolean;

  MOZ_SYSTEM_NSS: boolean;

  MOZ_PLACES: boolean;

  MOZ_REQUIRE_SIGNING: boolean;

  MOZ_UNSIGNED_APP_SCOPE: boolean;

  MOZ_UNSIGNED_SYSTEM_SCOPE: boolean;

  MOZ_ALLOW_ADDON_SIDELOAD: boolean;

  MOZ_WEBEXT_WEBIDL_ENABLED: boolean;

  MENUBAR_CAN_AUTOHIDE: boolean;

  MOZ_GECKOVIEW_HISTORY: boolean;

  MOZ_GECKO_PROFILER: boolean;

  DLL_PREFIX: string;
  DLL_SUFFIX: ".dll" | ".so";

  MOZ_APP_NAME: "firefox" | "thunderbird";
  MOZ_APP_BASENAME: "Firefox";

  // N.b.: you almost certainly want brandShortName/brand-short-name:
  // MOZ_APP_DISPLAYNAME should only be used for static user-visible
  // fields (e.g., DLL properties, Mac Bundle name, or similar).
  MOZ_APP_DISPLAYNAME_DO_NOT_USE: "Firefox";
  MOZ_APP_VERSION: string;
  MOZ_APP_VERSION_DISPLAY: string;
  MOZ_BUILDID: string;
  MOZ_BUILD_APP: "browser";
  MOZ_MACBUNDLE_ID: "org.mozilla.firefox";
  MOZ_MACBUNDLE_NAME: "Firefox.app";
  MOZ_UPDATE_CHANNEL: "nightly" | "beta" | "release" | "esr" | "default" | "unofficial";
  MOZ_WIDGET_TOOLKIT: "android" | "cocoa" | "gtk" | "windows" | "uikit";

  DEBUG_JS_MODULES: string;

  MOZ_BING_API_CLIENTID: "no-bing-api-clientid";
  MOZ_BING_API_KEY: "no-bing-api-key";
  MOZ_GOOGLE_LOCATION_SERVICE_API_KEY: string;
  MOZ_GOOGLE_SAFEBROWSING_API_KEY: string;
  MOZ_MOZILLA_API_KEY: string;

  BROWSER_CHROME_URL: "chrome://browser/content/browser.xhtml";

  OMNIJAR_NAME: "omni.ja";

  // URL to the hg revision this was built from (e.g.
  // "https://hg.mozilla.org/mozilla-central/rev/6256ec9113c1")
  // On unofficial builds, this is an empty string.
  SOURCE_REVISION_URL: string;

  // #ifdef HAVE_USR_LIB64_DIR
  HAVE_USR_LIB64_DIR: boolean;

  HAVE_SHELL_SERVICE: boolean;

  MOZ_CODE_COVERAGE: boolean;

  TELEMETRY_PING_FORMAT_VERSION: number;

  ENABLE_WEBDRIVER: boolean;

  // #ifdef !MOZ_THUNDERBIRD
  REMOTE_SETTINGS_SERVER_URL: "https://firefox.settings.services.mozilla.com/v1";

  // #ifdef !MOZ_THUNDERBIRD
  REMOTE_SETTINGS_VERIFY_SIGNATURE: boolean;

  // #ifdef !MOZ_THUNDERBIRD
  REMOTE_SETTINGS_DEFAULT_BUCKET: "main" | "thunderbird";

  MOZ_GLEAN_ANDROID: false;

  MOZ_JXL: boolean;

  MOZ_SYSTEM_POLICIES: boolean;

  MOZ_SELECTABLE_PROFILES: boolean;

  SQLITE_LIBRARY_FILENAME: string;

  // #ifdef MOZ_GECKOVIEW
  MOZ_GECKOVIEW: boolean;

  // Returns true for CN region build when distibution id set as 'MozillaOnline'
  isChinaRepack(): boolean;
}>;

type Platform = "linux" | "win" | "macosx" | "ios" | "android" | "other";
