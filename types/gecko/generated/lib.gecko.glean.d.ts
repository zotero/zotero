/**
 * NOTE: Do not modify this file by hand.
 * Content was generated from source glean .yaml files.
 * If you're updating some of the sources, see README for instructions.
 */

interface GleanImpl {

  a11y: {
    alwaysUnderlineLinks: GleanBoolean;
    useSystemColors: GleanBoolean;
    hcmBackground: GleanQuantity;
    hcmForeground: GleanQuantity;
    backplate: GleanBoolean;
    instantiators: GleanString;
    invertColors: GleanBoolean;
    theme: Record<string, GleanBoolean>;
    consumers: GleanCustomDistribution;
    treeUpdateTiming: GleanTimingDistribution;
  }

  fullscreen: {
    change: GleanTimingDistribution;
  }

  securityUiProtectionspopup: {
    openProtectionsPopup: GleanEvent;
    closeProtectionsPopup: GleanEvent;
    openProtectionspopupCfr: GleanEvent;
    clickEtpToggleOn: GleanEvent;
    clickEtpToggleOff: GleanEvent;
    clickSocial: GleanEvent;
    clickCookies: GleanEvent;
    clickTrackers: GleanEvent;
    clickFingerprinters: GleanEvent;
    clickCryptominers: GleanEvent;
    clickSubviewSettings: GleanEvent;
    clickSettings: GleanEvent;
    clickFullReport: GleanEvent;
    clickMilestoneMessage: GleanEvent;
    clickCookiebToggleOn: GleanEvent;
    clickCookiebToggleOff: GleanEvent;
    clickProtectionspopupCfr: GleanEvent;
    clickSmartblockembedsToggle: GleanEvent;
    smartblockembedsShown: GleanCounter;
  }

  browserEngagement: {
    bookmarksToolbarBookmarkAdded: GleanCounter;
    bookmarksToolbarBookmarkOpened: GleanCounter;
    totalTopVisits: Record<string, GleanCounter>;
    sessionrestoreInterstitial: Record<string, GleanCounter>;
    tabUnloadCount: GleanCounter;
    tabReloadCount: GleanCounter;
    tabExplicitUnload: GleanEvent;
    tabUnloadToReload: GleanTimingDistribution;
    activeTicks: GleanCounter;
    uriCount: GleanCounter;
    uriCountNormalMode: GleanCounter;
    profileCount: GleanQuantity;
    maxConcurrentTabCount: GleanQuantity;
    maxConcurrentVerticalTabCount: GleanQuantity;
    maxConcurrentWindowCount: GleanQuantity;
    maxConcurrentTabPinnedCount: GleanQuantity;
    maxConcurrentVerticalTabPinnedCount: GleanQuantity;
    tabOpenEventCount: GleanCounter;
    verticalTabOpenEventCount: GleanCounter;
    windowOpenEventCount: GleanCounter;
    tabPinnedEventCount: GleanCounter;
    verticalTabPinnedEventCount: GleanCounter;
    unfilteredUriCount: GleanCounter;
    uniqueDomainsCount: GleanQuantity;
    tabCount: GleanCustomDistribution;
    loadedTabCount: GleanCustomDistribution;
    sessionTimeIncludingSuspend: GleanQuantity;
    sessionTimeExcludingSuspend: GleanQuantity;
  }

  networking: {
    captivePortalBannerDisplayed: GleanCounter;
    captivePortalBannerDisplayTime: Record<string, GleanCounter>;
    speculativeConnectOutcome: Record<string, GleanCounter>;
    cookieTimestampFixedCount: Record<string, GleanCounter>;
    cookieCreationFixupDiff: GleanCustomDistribution;
    cookieAccessFixupDiff: GleanCustomDistribution;
    cookieCountTotal: GleanCustomDistribution;
    cookieCountPartitioned: GleanCustomDistribution;
    cookieCountUnpartitioned: GleanCustomDistribution;
    cookieCountPartByKey: GleanCustomDistribution;
    cookieCountUnpartByKey: GleanCustomDistribution;
    cookieCountInvalidFirstPartyPartitionedInDb: GleanCounter;
    setInvalidFirstPartyPartitionedCookie: GleanCounter;
    cookiePurgeMax: GleanCustomDistribution;
    cookiePurgeEntryMax: GleanCustomDistribution;
    cookieChipsPartitionLimitOverflow: GleanCustomDistribution;
    sqliteCookiesBlockMainThread: GleanTimingDistribution;
    sqliteCookiesTimeToBlockMainThread: GleanTimingDistribution;
    setCookie: GleanCounter;
    setCookieForeign: GleanRate;
    setCookiePartitioned: GleanRate;
    setCookieForeignPartitioned: GleanRate;
    dnsLookupTime: GleanTimingDistribution;
    trrFetchDuration: Record<string, GleanTimingDistribution>;
    trrDnsStart: Record<string, GleanTimingDistribution>;
    trrDnsEnd: Record<string, GleanTimingDistribution>;
    trrTcpConnection: Record<string, GleanTimingDistribution>;
    trrTlsHandshake: Record<string, GleanTimingDistribution>;
    trrOpenToFirstSent: Record<string, GleanTimingDistribution>;
    trrFirstSentToLastReceived: Record<string, GleanTimingDistribution>;
    trrOpenToFirstReceived: Record<string, GleanTimingDistribution>;
    trrCompleteLoad: Record<string, GleanTimingDistribution>;
    trrResponseSize: Record<string, GleanMemoryDistribution>;
    trrRequestSize: Record<string, GleanMemoryDistribution>;
    dnsRenewalTime: GleanTimingDistribution;
    dnsRenewalTimeForTtl: GleanTimingDistribution;
    dnsFailedLookupTime: GleanTimingDistribution;
    dnsNativeHttpsCallTime: GleanTimingDistribution;
    dnsNativeCount: Record<string, GleanCounter>;
    fetchKeepaliveDiscardCount: Record<string, GleanCounter>;
    fetchKeepaliveRequestCount: Record<string, GleanCounter>;
    httpContentOnstartDelay: GleanTimingDistribution;
    httpContentOnstopDelay: GleanTimingDistribution;
    httpContentOndatafinishedDelay: GleanTimingDistribution;
    httpContentOndatafinishedDelay2: GleanTimingDistribution;
    httpContentOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpContentHtml5parserOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpContentCssloaderOndatafinishedToOnstopDelay: GleanTimingDistribution;
    httpIpAddrAnyCount: Record<string, GleanCounter>;
    httpIpAddrAnyHostnames: Record<string, GleanCounter>;
    httpOnstartSuspendTotalTime: GleanTimingDistribution;
    http1DownloadThroughput: GleanCustomDistribution;
    http1DownloadThroughput1050: GleanCustomDistribution;
    http1DownloadThroughput50100: GleanCustomDistribution;
    http1DownloadThroughput100: GleanCustomDistribution;
    http2DownloadThroughput: GleanCustomDistribution;
    http2DownloadThroughput1050: GleanCustomDistribution;
    http2DownloadThroughput50100: GleanCustomDistribution;
    http2DownloadThroughput100: GleanCustomDistribution;
    http3DownloadThroughput: GleanCustomDistribution;
    http3DownloadThroughput1050: GleanCustomDistribution;
    http3DownloadThroughput50100: GleanCustomDistribution;
    http3DownloadThroughput100: GleanCustomDistribution;
    http1UploadThroughput: GleanCustomDistribution;
    http2UploadThroughput: GleanCustomDistribution;
    http3UploadThroughput: GleanCustomDistribution;
    http1UploadThroughput1050: GleanCustomDistribution;
    http1UploadThroughput50100: GleanCustomDistribution;
    http1UploadThroughput100: GleanCustomDistribution;
    http2UploadThroughput1050: GleanCustomDistribution;
    http2UploadThroughput50100: GleanCustomDistribution;
    http2UploadThroughput100: GleanCustomDistribution;
    http3UploadThroughput1050: GleanCustomDistribution;
    http3UploadThroughput50100: GleanCustomDistribution;
    http3UploadThroughput100: GleanCustomDistribution;
    http3EcnCeEct0RatioSent: GleanCustomDistribution;
    http3EcnCeEct0RatioReceived: GleanCustomDistribution;
    http3EcnPathCapability: Record<string, GleanCounter>;
    http3LossRatio: GleanCustomDistribution;
    http3ConnectionCloseReason: Record<string, GleanCounter>;
    http3QuicFrameCount: Record<string, GleanCounter>;
    cacheMetadataFirstReadTime: GleanTimingDistribution;
    cacheMetadataSecondReadTime: GleanTimingDistribution;
    cacheMetadataSize: GleanMemoryDistribution;
    residualCacheFolderCount: GleanCounter;
    residualCacheFolderRemoval: Record<string, GleanCounter>;
    cachePurgeDueToMemoryLimit: Record<string, GleanCounter>;
    trrRequestCount: Record<string, GleanCounter>;
    trrRequestCountPerConn: Record<string, GleanCounter>;
    httpRedirectToSchemeTopLevel: Record<string, GleanCounter>;
    httpRedirectToSchemeSubresource: Record<string, GleanCounter>;
    httpResponseVersion: Record<string, GleanCounter>;
    httpResponseStatusCode: Record<string, GleanCounter>;
    httpsRrPresented: Record<string, GleanCounter>;
    httpChannelOnstartSuccessHttpsRr: Record<string, GleanCounter>;
    httpChannelDisposition: Record<string, GleanCounter>;
    httpChannelDispositionEnabledUpgrade: Record<string, GleanCounter>;
    httpChannelDispositionEnabledNoReason: Record<string, GleanCounter>;
    httpChannelDispositionEnabledWont: Record<string, GleanCounter>;
    httpChannelDispositionDisabledUpgrade: Record<string, GleanCounter>;
    httpChannelDispositionDisabledNoReason: Record<string, GleanCounter>;
    httpChannelDispositionDisabledWont: Record<string, GleanCounter>;
    httpChannelOnstartStatus: Record<string, GleanCounter>;
    httpChannelPageOpenToFirstSent: GleanTimingDistribution;
    httpChannelSubOpenToFirstSent: GleanTimingDistribution;
    httpChannelPageOpenToFirstSentHttpsRr: GleanTimingDistribution;
    httpToHttpsUpgradeReason: Record<string, GleanCounter>;
    httpsHttpOrLocal: Record<string, GleanCounter>;
    localNetworkAccess: Record<string, GleanCounter>;
    localNetworkAccessPort: GleanCustomDistribution;
    httpChannelSubOpenToFirstSentHttpsRr: GleanTimingDistribution;
    transactionWaitTimeHttpsRr: GleanTimingDistribution;
    proxyInfoType: Record<string, GleanCounter>;
    transactionWaitTime: GleanTimingDistribution;
    osSocketLimitReached: GleanCounter;
    http3UdpDatagramSegmentSizeSent: GleanMemoryDistribution;
    http3UdpDatagramSegmentSizeReceived: GleanMemoryDistribution;
    http3UdpDatagramSizeReceived: GleanMemoryDistribution;
    http3UdpDatagramSegmentsReceived: GleanCustomDistribution;
    prconnectBlockingTimeNormal: GleanTimingDistribution;
    prconnectBlockingTimeShutdown: GleanTimingDistribution;
    prconnectBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectBlockingTimeOffline: GleanTimingDistribution;
    prconnectFailBlockingTimeNormal: GleanTimingDistribution;
    prconnectFailBlockingTimeShutdown: GleanTimingDistribution;
    prconnectFailBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectFailBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectFailBlockingTimeOffline: GleanTimingDistribution;
    prconnectcontinueBlockingTimeNormal: GleanTimingDistribution;
    prconnectcontinueBlockingTimeShutdown: GleanTimingDistribution;
    prconnectcontinueBlockingTimeConnectivityChange: GleanTimingDistribution;
    prconnectcontinueBlockingTimeLinkChange: GleanTimingDistribution;
    prconnectcontinueBlockingTimeOffline: GleanTimingDistribution;
    prcloseTcpBlockingTimeNormal: GleanTimingDistribution;
    prcloseTcpBlockingTimeShutdown: GleanTimingDistribution;
    prcloseTcpBlockingTimeConnectivityChange: GleanTimingDistribution;
    prcloseTcpBlockingTimeLinkChange: GleanTimingDistribution;
    prcloseTcpBlockingTimeOffline: GleanTimingDistribution;
    prcloseUdpBlockingTimeNormal: GleanTimingDistribution;
    prcloseUdpBlockingTimeShutdown: GleanTimingDistribution;
    prcloseUdpBlockingTimeConnectivityChange: GleanTimingDistribution;
    prcloseUdpBlockingTimeLinkChange: GleanTimingDistribution;
    prcloseUdpBlockingTimeOffline: GleanTimingDistribution;
    http3Enabled: GleanBoolean;
    httpsRrPrefsUsage: GleanQuantity;
    trrConnectionCycleCount: Record<string, GleanCounter>;
    dataTransferredV3Kb: Record<string, GleanCounter>;
    httpsRecordState: Record<string, GleanCounter>;
    nssInitialization: GleanQuantity;
    loadingCertsTask: GleanQuantity;
    dohHeuristicsAttempts: GleanCounter;
    dohHeuristicsPassCount: GleanCounter;
    dohHeuristicsResult: GleanQuantity;
    dohHeuristicEverTripped: Record<string, GleanBoolean>;
  }

  browserTimings: {
    tabClick: GleanTimingDistribution;
    newWindow: GleanTimingDistribution;
    pageLoad: GleanTimingDistribution;
    pageReloadNormal: GleanTimingDistribution;
    pageReloadSkipCache: GleanTimingDistribution;
    lastShutdown: GleanQuantity;
  }

  messagingSystem: {
    eventContextParseError: GleanCounter;
    eventReason: GleanString;
    eventPage: GleanString;
    eventSource: GleanString;
    eventContext: GleanText;
    eventScreenFamily: GleanText;
    eventScreenId: GleanText;
    eventScreenInitials: GleanText;
    eventScreenIndex: GleanQuantity;
    messageId: GleanText;
    event: GleanString;
    pingType: GleanString;
    source: GleanString;
    clientId: GleanUuid;
    locale: GleanString;
    browserSessionId: GleanUuid;
    impressionId: GleanUuid;
    bucketId: GleanString;
    addonVersion: GleanString;
    unknownKeyCount: GleanCounter;
    unknownKeys: Record<string, GleanCounter>;
    gleanPingForPingFailures: GleanCounter;
    invalidNestedData: Record<string, GleanCounter>;
    messageRequestTime: GleanTimingDistribution;
  }

  messagingSystemAttribution: {
    source: GleanString;
    medium: GleanString;
    campaign: GleanString;
    content: GleanString;
    experiment: GleanString;
    variation: GleanString;
    ua: GleanString;
    dltoken: GleanString;
    msstoresignedin: GleanString;
    dlsource: GleanString;
    unknownKeys: Record<string, GleanCounter>;
  }

  gleanAttribution: {
    ext: GleanObject;
  }

  gleanDistribution: {
    ext: GleanObject;
  }

  browserBackup: {
    enabled: GleanBoolean;
    schedulerEnabled: GleanBoolean;
    pswdEncrypted: GleanBoolean;
    locationOnDevice: GleanQuantity;
    profDDiskSpace: GleanQuantity;
    totalBackupSize: GleanMemoryDistribution;
    compressedArchiveSize: GleanMemoryDistribution;
    totalBackupTime: GleanTimingDistribution;
    placesSize: GleanQuantity;
    placesTime: GleanTimingDistribution;
    faviconsSize: GleanQuantity;
    faviconsTime: GleanTimingDistribution;
    credentialsDataSize: GleanQuantity;
    securityDataSize: GleanQuantity;
    preferencesSize: GleanQuantity;
    miscDataSize: GleanQuantity;
    cookiesSize: GleanQuantity;
    formHistorySize: GleanQuantity;
    sessionStoreBackupsDirectorySize: GleanQuantity;
    sessionStoreSize: GleanQuantity;
    extensionsJsonSize: GleanQuantity;
    extensionStorePermissionsDataSize: GleanQuantity;
    storageSyncSize: GleanQuantity;
    browserExtensionDataSize: GleanQuantity;
    extensionsXpiDirectorySize: GleanQuantity;
    extensionsStorageSize: GleanQuantity;
    toggleOn: GleanEvent;
    toggleOff: GleanEvent;
    created: GleanEvent;
    changeLocation: GleanEvent;
    passwordChanged: GleanEvent;
    passwordAdded: GleanEvent;
    passwordRemoved: GleanEvent;
    error: GleanEvent;
  }

  downloads: {
    panelShown: GleanCounter;
    addedFileExtension: GleanEvent;
    fileOpened: GleanCounter;
    userActionOnBlockedDownload: Record<string, GleanCustomDistribution>;
  }

  glamExperiment: {
    panelShown: GleanCounter;
    activeTicks: GleanCounter;
    protectTime: GleanTimingDistribution;
    largestContentfulPaint: GleanTimingDistribution;
    httpContentHtml5parserOndatafinishedToOnstopDelay: GleanTimingDistribution;
    osSocketLimitReached: GleanCounter;
    subCompleteLoadNet: GleanTimingDistribution;
    used: GleanCounter;
    cpuTimeBogusValues: GleanCounter;
    totalCpuTimeMs: GleanCounter;
  }

  firefoxviewNext: {
    recentlyClosedTabs: GleanEvent;
    dismissClosedTabTabs: GleanEvent;
    cardCollapsedCardContainer: GleanEvent;
    cardExpandedCardContainer: GleanEvent;
    changePageNavigation: GleanEvent;
    contextMenuTabs: GleanEvent;
    closeOpenTabTabs: GleanEvent;
    browserContextMenuTabs: GleanEvent;
    enteredFirefoxview: GleanEvent;
    fxaContinueSync: GleanEvent;
    fxaMobileSync: GleanEvent;
    syncedTabsTabs: GleanEvent;
    historyVisits: GleanEvent;
    sortHistoryTabs: GleanEvent;
    showAllHistoryTabs: GleanEvent;
    openTabTabs: GleanEvent;
    tabSelectedToolbarbutton: GleanEvent;
    searchInitiatedSearch: GleanEvent;
    searchShowAllShowallbutton: GleanEvent;
  }

  firefoxview: {
    cumulativeSearches: Record<string, GleanCustomDistribution>;
  }

  genaiChatbot: {
    enabled: GleanBoolean;
    provider: GleanString;
    shortcuts: GleanBoolean;
    shortcutsCustom: GleanBoolean;
    sidebar: GleanBoolean;
    contextmenuPromptClick: GleanEvent;
    contextmenuRemove: GleanEvent;
    experimentCheckboxClick: GleanEvent;
    keyboardShortcut: GleanEvent;
    onboardingClose: GleanEvent;
    onboardingContinue: GleanEvent;
    onboardingFinish: GleanEvent;
    onboardingLearnMore: GleanEvent;
    onboardingProviderChoiceDisplayed: GleanEvent;
    onboardingProviderLearn: GleanEvent;
    onboardingProviderSelection: GleanEvent;
    onboardingProviderTerms: GleanEvent;
    onboardingTextHighlightDisplayed: GleanEvent;
    providerChange: GleanEvent;
    shortcutsCheckboxClick: GleanEvent;
    shortcutsDisplayed: GleanEvent;
    shortcutsExpanded: GleanEvent;
    shortcutsHideClick: GleanEvent;
    shortcutsPromptClick: GleanEvent;
    sidebarCloseClick: GleanEvent;
    sidebarMoreMenuClick: GleanEvent;
    sidebarMoreMenuDisplay: GleanEvent;
    sidebarProviderMenuClick: GleanEvent;
    sidebarToggle: GleanEvent;
  }

  genaiLinkpreview: {
    enabled: GleanBoolean;
    cardAiConsent: GleanEvent;
    cardClose: GleanEvent;
    cardLink: GleanEvent;
    fetch: GleanEvent;
    generate: GleanEvent;
    keyPointsToggle: GleanEvent;
    labsCheckbox: GleanEvent;
    start: GleanEvent;
  }

  browserLaunchedToHandle: {
    systemNotification: GleanEvent;
  }

  backgroundUpdate: {
    reasonsToNotUpdate: GleanStringList;
    timeLastUpdateScheduled: GleanDatetime;
    automaticRestartAttempted: GleanBoolean;
    automaticRestartSuccess: GleanBoolean;
    clientId: GleanUuid;
    exitCodeException: GleanBoolean;
    exitCodeSuccess: GleanBoolean;
    finalState: GleanString;
    reasons: GleanStringList;
    states: GleanStringList;
    targetingEnvCurrentDate: GleanDatetime;
    targetingEnvFirefoxVersion: GleanQuantity;
    targetingEnvProfileAge: GleanDatetime;
    targetingException: GleanBoolean;
    targetingExists: GleanBoolean;
    targetingVersion: GleanQuantity;
  }

  startMenu: {
    manuallyUnpinnedSinceLastLaunch: GleanEvent;
  }

  sslkeylogging: {
    enabled: GleanBoolean;
  }

  launchOnLogin: {
    lastProfileDisableStartup: GleanEvent;
  }

  upgradeDialog: {
    triggerReason: GleanEvent;
  }

  browserStartup: {
    abouthomeCacheResult: GleanQuantity;
    abouthomeCacheShutdownwrite: GleanBoolean;
    kioskMode: GleanBoolean;
  }

  datasanitization: {
    privacySanitizeSanitizeOnShutdown: GleanBoolean;
    privacyClearOnShutdownCookies: GleanBoolean;
    privacyClearOnShutdownHistory: GleanBoolean;
    privacyClearOnShutdownFormdata: GleanBoolean;
    privacyClearOnShutdownDownloads: GleanBoolean;
    privacyClearOnShutdownCache: GleanBoolean;
    privacyClearOnShutdownSessions: GleanBoolean;
    privacyClearOnShutdownOfflineApps: GleanBoolean;
    privacyClearOnShutdownSiteSettings: GleanBoolean;
    privacyClearOnShutdownOpenWindows: GleanBoolean;
    sessionPermissionExceptions: GleanQuantity;
  }

  startup: {
    isCold: GleanBoolean;
    secondsSinceLastOsRestart: GleanQuantity;
    profileSelectionReason: GleanString;
    profileDatabaseVersion: GleanString;
    profileCount: GleanQuantity;
  }

  osEnvironment: {
    launchMethod: GleanString;
    launchedToHandle: Record<string, GleanCounter>;
    invokedToHandle: Record<string, GleanCounter>;
    isDefaultHandler: Record<string, GleanBoolean>;
    isKeptInDock: GleanBoolean;
    isTaskbarPinned: GleanBoolean;
    isTaskbarPinnedPrivate: GleanBoolean;
    allowedAppSources: GleanString;
    isAdminWithoutUac: GleanBoolean;
  }

  security: {
    httpsOnlyModeEnabled: GleanQuantity;
    httpsOnlyModeEnabledPbm: GleanQuantity;
    globalPrivacyControlEnabled: GleanQuantity;
    fissionPrincipals: GleanEvent;
    shadowedHtmlDocumentPropertyAccess: GleanEvent;
    unexpectedLoad: GleanEvent;
    evalUsageSystemContext: GleanEvent;
    cspViolationInternalPage: GleanEvent;
    evalUsageParentProcess: GleanEvent;
    javascriptLoadParentProcess: GleanEvent;
    httpsOnlyModeUpgradeTime: Record<string, GleanTimingDistribution>;
    referrerPolicyCount: GleanCustomDistribution;
    prefUsageContentProcess: GleanEvent;
    clientAuthCertUsage: Record<string, GleanCounter>;
    addonSignatureVerificationStatus: GleanCustomDistribution;
    contentSignatureVerificationStatus: GleanCustomDistribution;
    ntlmModuleUsed: GleanCustomDistribution;
  }

  primaryPassword: {
    enabled: GleanBoolean;
  }

  browser: {
    isUserDefault: Record<string, GleanCounter>;
    isUserDefaultError: Record<string, GleanCounter>;
    setDefaultDialogPromptRawcount: GleanCustomDistribution;
    setDefaultAlwaysCheck: Record<string, GleanCounter>;
    setDefaultResult: GleanCustomDistribution;
    setDefaultError: Record<string, GleanCounter>;
    setDefaultPdfHandlerUserChoiceResult: Record<string, GleanCounter>;
    setDefaultUserChoiceResult: Record<string, GleanCounter>;
    attributionErrors: Record<string, GleanCounter>;
    defaultAtLaunch: GleanBoolean;
  }

  browserMigration: {
    matchedExtensions: GleanStringList;
    unmatchedExtensions: GleanStringList;
    openedWizard: GleanEvent;
    noBrowsersFoundWizard: GleanEvent;
    browserSelectedWizard: GleanEvent;
    profileSelectedWizard: GleanEvent;
    resourcesSelectedWizard: GleanEvent;
    linuxPermsWizard: GleanEvent;
    safariPermsWizard: GleanEvent;
    safariPasswordFileWizard: GleanEvent;
    chromePasswordFileWizard: GleanEvent;
    migrationStartedWizard: GleanEvent;
    migrationFinishedWizard: GleanEvent;
    entryPointCategorical: Record<string, GleanCounter>;
    sourceBrowser: GleanCustomDistribution;
    errors: Record<string, GleanCustomDistribution>;
    usage: Record<string, GleanCustomDistribution>;
    bookmarksQuantity: Record<string, GleanCustomDistribution>;
    historyQuantity: Record<string, GleanCustomDistribution>;
    loginsQuantity: Record<string, GleanCustomDistribution>;
    cardsQuantity: Record<string, GleanCustomDistribution>;
    extensionsQuantity: Record<string, GleanCustomDistribution>;
  }

  migration: {
    uninstallerProfileRefresh: GleanBoolean;
    discoveredMigrators: Record<string, GleanCounter>;
    timeToProduceMigratorList: GleanTimespan;
  }

  newtab: {
    locale: GleanString;
    newtabCategory: GleanString;
    homepageCategory: GleanString;
    opened: GleanEvent;
    closed: GleanEvent;
    blockedSponsors: GleanStringList;
    sovAllocation: GleanStringList;
    tooltipClick: GleanEvent;
    topicSelectionOpen: GleanEvent;
    topicSelectionDismiss: GleanEvent;
    topicSelectionTopicsSaved: GleanEvent;
    selectedTopics: GleanStringList;
    wallpaperClick: GleanEvent;
    wallpaperHighlightCtaClick: GleanEvent;
    wallpaperHighlightDismissed: GleanEvent;
    wallpaperCategoryClick: GleanEvent;
    weatherChangeDisplay: GleanEvent;
    weatherEnabled: GleanBoolean;
    weatherOpenProviderUrl: GleanEvent;
    weatherImpression: GleanEvent;
    weatherLoadError: GleanEvent;
    weatherLocationSelected: GleanEvent;
    fakespotDismiss: GleanEvent;
    fakespotAboutClick: GleanEvent;
    fakespotClick: GleanEvent;
    fakespotProductImpression: GleanEvent;
    fakespotCtaClick: GleanEvent;
    fakespotCategory: GleanEvent;
    sectionsImpression: GleanEvent;
    sectionsFollowSection: GleanEvent;
    sectionsUnfollowSection: GleanEvent;
    sectionsBlockSection: GleanEvent;
    sectionsUnblockSection: GleanEvent;
    inlineSelectionImpression: GleanEvent;
    inlineSelectionClick: GleanEvent;
    abouthomeCacheConstruction: GleanTimingDistribution;
    reportContentOpen: GleanEvent;
    reportContentSubmit: GleanEvent;
    metricRegistered: Record<string, GleanBoolean>;
    pingRegistered: Record<string, GleanBoolean>;
    activityStreamCtorSuccess: GleanBoolean;
    addonReadySuccess: GleanBoolean;
  }

  newtabSearch: {
    enabled: GleanBoolean;
    issued: GleanEvent;
  }

  newtabHandoffPreference: {
    enabled: GleanBoolean;
  }

  topsites: {
    enabled: GleanBoolean;
    sponsoredEnabled: GleanBoolean;
    impression: GleanEvent;
    click: GleanEvent;
    showPrivacyClick: GleanEvent;
    dismiss: GleanEvent;
    prefChanged: GleanEvent;
    rows: GleanQuantity;
    sponsoredTilesConfigured: GleanQuantity;
    sponsoredTilesReceived: GleanText;
  }

  pocket: {
    isSignedIn: GleanBoolean;
    enabled: GleanBoolean;
    sponsoredStoriesEnabled: GleanBoolean;
    impression: GleanEvent;
    click: GleanEvent;
    dismiss: GleanEvent;
    save: GleanEvent;
    topicClick: GleanEvent;
    shim: GleanText;
    fetchTimestamp: GleanDatetime;
    newtabCreationTimestamp: GleanDatetime;
    thumbVotingInteraction: GleanEvent;
  }

  newtabContent: {
    experimentName: GleanString;
    experimentBranch: GleanString;
    inferredInterests: GleanString;
    coarseOs: GleanString;
    utcOffset: GleanQuantity;
    country: GleanString;
    surfaceId: GleanString;
    followedSections: GleanStringList;
    impression: GleanEvent;
    click: GleanEvent;
    dismiss: GleanEvent;
    thumbVotingInteraction: GleanEvent;
    sectionsImpression: GleanEvent;
    sectionsFollowSection: GleanEvent;
    sectionsUnfollowSection: GleanEvent;
    sectionsBlockSection: GleanEvent;
    sectionsUnblockSection: GleanEvent;
  }

  topSites: {
    pingType: GleanString;
    position: GleanQuantity;
    source: GleanString;
    tileId: GleanString;
    reportingUrl: GleanUrl;
    advertiser: GleanString;
    contextId: GleanUuid;
  }

  activityStream: {
    endSession: GleanEvent;
    eventArchiveFromPocket: GleanEvent;
    eventBlock: GleanEvent;
    eventBookmarkAdd: GleanEvent;
    eventBookmarkDelete: GleanEvent;
    eventClick: GleanEvent;
    eventClickPrivacyInfo: GleanEvent;
    eventCloseNewtabPrefs: GleanEvent;
    eventShowPersonalize: GleanEvent;
    eventHidePersonalize: GleanEvent;
    eventDelete: GleanEvent;
    eventDeleteFromPocket: GleanEvent;
    eventDeleteConfirm: GleanEvent;
    eventDialogCancel: GleanEvent;
    eventDialogOpen: GleanEvent;
    eventDrag: GleanEvent;
    eventDrop: GleanEvent;
    eventImpression: GleanEvent;
    eventMigrationCancel: GleanEvent;
    eventMigrationStart: GleanEvent;
    eventOpenNewtabPrefs: GleanEvent;
    eventOpenNewWindow: GleanEvent;
    eventOpenPrivateWindow: GleanEvent;
    eventPin: GleanEvent;
    eventPocketThumbsDown: GleanEvent;
    eventPocketThumbsUp: GleanEvent;
    eventFakespotClick: GleanEvent;
    eventFakespotCategory: GleanEvent;
    eventPrefChanged: GleanEvent;
    eventPreviewRequest: GleanEvent;
    eventSaveToPocket: GleanEvent;
    eventSearch: GleanEvent;
    eventSearchEditAdd: GleanEvent;
    eventSearchEditClose: GleanEvent;
    eventSearchEditDelete: GleanEvent;
    eventSearchHandoff: GleanEvent;
    eventShowPrivacyInfo: GleanEvent;
    eventSkippedSignin: GleanEvent;
    eventSubmitEmail: GleanEvent;
    eventDisclaimerAcked: GleanEvent;
    eventMenuAddSearch: GleanEvent;
    eventMenuAddTopsite: GleanEvent;
    eventMenuCollapse: GleanEvent;
    eventMenuExpand: GleanEvent;
    eventMenuManage: GleanEvent;
    eventMenuMoveDown: GleanEvent;
    eventMenuMoveUp: GleanEvent;
    eventMenuPrivacyNotice: GleanEvent;
    eventMenuRemove: GleanEvent;
    eventTopSitesEdit: GleanEvent;
    eventTopSitesEditClose: GleanEvent;
    eventTopsiteSponsorInfo: GleanEvent;
    eventUnpin: GleanEvent;
  }

  deletionRequest: {
    impressionId: GleanString;
    contextId: GleanString;
    syncDeviceId: GleanString;
  }

  contextualServicesTopsites: {
    impression: Record<string, GleanCounter>;
    click: Record<string, GleanCounter>;
  }

  library: {
    link: Record<string, GleanCounter>;
    opened: Record<string, GleanCounter>;
    search: Record<string, GleanCounter>;
    historySearchTime: GleanTimingDistribution;
    cumulativeHistorySearches: GleanCustomDistribution;
    cumulativeBookmarkSearches: GleanCustomDistribution;
  }

  historySidebar: {
    filterType: Record<string, GleanCounter>;
    cumulativeSearches: GleanCustomDistribution;
    cumulativeFilterCount: GleanCustomDistribution;
    lastvisitedTreeQueryTime: GleanTimingDistribution;
  }

  bookmarksSidebar: {
    cumulativeSearches: GleanCustomDistribution;
  }

  bookmarksToolbar: {
    init: GleanTimingDistribution;
  }

  pocketButton: {
    impressionId: GleanUuid;
    pocketLoggedInStatus: GleanBoolean;
    profileCreationDate: GleanQuantity;
    eventAction: GleanString;
    eventSource: GleanString;
    eventPosition: GleanQuantity;
    model: GleanString;
  }

  privacyUiFppClick: {
    checkbox: GleanEvent;
    menu: GleanEvent;
  }

  networkProxySettings: {
    proxyTypePreference: GleanEvent;
  }

  securityDohSettings: {
    modeChangedButton: GleanEvent;
    providerChoiceValue: GleanEvent;
  }

  intlUiBrowserLanguage: {
    manageMain: GleanEvent;
    searchDialog: GleanEvent;
    searchMain: GleanEvent;
    addDialog: GleanEvent;
    removeDialog: GleanEvent;
    reorderDialog: GleanEvent;
    reorderMain: GleanEvent;
    applyMain: GleanEvent;
    acceptDialog: GleanEvent;
    cancelDialog: GleanEvent;
    setFallbackDialog: GleanEvent;
  }

  aboutpreferences: {
    showInitial: GleanEvent;
    showClick: GleanEvent;
    showHash: GleanEvent;
  }

  privateBrowsingResetPbm: {
    confirmPanel: GleanEvent;
    resetAction: GleanEvent;
  }

  aboutprivatebrowsing: {
    clickInfoLink: GleanEvent;
    clickPromoLink: GleanEvent;
    clickDismissButton: GleanEvent;
  }

  profilesDefault: {
    updated: GleanEvent;
  }

  profilesDelete: {
    cancel: GleanEvent;
    confirm: GleanEvent;
    displayed: GleanEvent;
  }

  profilesExisting: {
    alert: GleanEvent;
    avatar: GleanEvent;
    closed: GleanEvent;
    deleted: GleanEvent;
    displayed: GleanEvent;
    learnMore: GleanEvent;
    name: GleanEvent;
    theme: GleanEvent;
  }

  profilesNew: {
    alert: GleanEvent;
    avatar: GleanEvent;
    closed: GleanEvent;
    deleted: GleanEvent;
    displayed: GleanEvent;
    learnMore: GleanEvent;
    name: GleanEvent;
    theme: GleanEvent;
  }

  profilesSelectorWindow: {
    launch: GleanEvent;
    showAtStartup: GleanEvent;
  }

  securityUiProtections: {
    showProtectionReport: GleanEvent;
    showVpnBanner: GleanEvent;
    closeProtectionReport: GleanEvent;
    clickLwOpenButton: GleanEvent;
    clickLwSyncLink: GleanEvent;
    clickLwAboutLink: GleanEvent;
    clickMtrAboutLink: GleanEvent;
    clickMtrReportLink: GleanEvent;
    clickMtrSignupButton: GleanEvent;
    clickTrackersAboutLink: GleanEvent;
    clickMobileAppLink: GleanEvent;
    clickSettingsLink: GleanEvent;
    clickVpnBannerLink: GleanEvent;
    clickVpnBannerClose: GleanEvent;
    clickVpnCardLink: GleanEvent;
    clickVpnAppLinkAndroid: GleanEvent;
    clickVpnAppLinkIos: GleanEvent;
  }

  protocolhandlerMailto: {
    promptClicked: Record<string, GleanCounter>;
    handlerPromptShown: Record<string, GleanCounter>;
    visit: GleanEvent;
  }

  screenshots: {
    downloadOverlayDownload: GleanEvent;
    downloadPreviewDownload: GleanEvent;
    copyOverlayCopy: GleanEvent;
    copyPreviewCopy: GleanEvent;
    selectedElement: GleanEvent;
    selectedRegionSelection: GleanEvent;
    selectedVisible: GleanEvent;
    selectedFullPage: GleanEvent;
    startedToolbarButton: GleanEvent;
    startedShortcut: GleanEvent;
    startedContextMenu: GleanEvent;
    startedQuickActions: GleanEvent;
    startedPreviewRetry: GleanEvent;
    startedOverlayRetry: GleanEvent;
    canceledToolbarButton: GleanEvent;
    canceledShortcut: GleanEvent;
    canceledContextMenu: GleanEvent;
    canceledQuickActions: GleanEvent;
    canceledPreviewCancel: GleanEvent;
    canceledOverlayCancel: GleanEvent;
    canceledEscape: GleanEvent;
    canceledNavigation: GleanEvent;
    failedScreenshotTooLarge: GleanEvent;
  }

  newtabSearchAd: {
    impression: GleanEvent;
    click: GleanEvent;
  }

  sap: {
    counts: GleanEvent;
    deprecatedCounts: Record<string, GleanCounter>;
    searchFormCounts: GleanEvent;
  }

  serp: {
    impression: GleanEvent;
    engagement: GleanEvent;
    adImpression: GleanEvent;
    abandonment: GleanEvent;
    categorizationDuration: GleanTimingDistribution;
    categorization: GleanEvent;
    adsBlockedCount: Record<string, GleanCounter>;
    experimentInfo: GleanObject;
    categorizationNoMapFound: GleanCounter;
  }

  searchWith: {
    reportingUrl: GleanUrl;
    contextId: GleanUuid;
  }

  browserEngagementNavigation: {
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
  }

  browserSearchContent: {
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
  }

  browserSearchWithads: {
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
  }

  browserSearchAdclicks: {
    urlbar: Record<string, GleanCounter>;
    urlbarHandoff: Record<string, GleanCounter>;
    urlbarPersisted: Record<string, GleanCounter>;
    urlbarSearchmode: Record<string, GleanCounter>;
    searchbar: Record<string, GleanCounter>;
    aboutHome: Record<string, GleanCounter>;
    aboutNewtab: Record<string, GleanCounter>;
    contextmenu: Record<string, GleanCounter>;
    webextension: Record<string, GleanCounter>;
    system: Record<string, GleanCounter>;
    tabhistory: Record<string, GleanCounter>;
    reload: Record<string, GleanCounter>;
    unknown: Record<string, GleanCounter>;
  }

  urlbarSearchmode: {
    bookmarkmenu: Record<string, GleanCounter>;
    handoff: Record<string, GleanCounter>;
    keywordoffer: Record<string, GleanCounter>;
    oneoff: Record<string, GleanCounter>;
    searchbutton: Record<string, GleanCounter>;
    shortcut: Record<string, GleanCounter>;
    tabmenu: Record<string, GleanCounter>;
    tabtosearch: Record<string, GleanCounter>;
    tabtosearchOnboard: Record<string, GleanCounter>;
    topsitesNewtab: Record<string, GleanCounter>;
    topsitesUrlbar: Record<string, GleanCounter>;
    touchbar: Record<string, GleanCounter>;
    typed: Record<string, GleanCounter>;
    historymenu: Record<string, GleanCounter>;
    other: Record<string, GleanCounter>;
  }

  searchbar: {
    selectedResultMethod: Record<string, GleanCounter>;
  }

  sessionRestore: {
    backupCanBeLoadedSessionFile: GleanEvent;
    shutdownSuccessSessionStartup: GleanEvent;
    startupInitSession: GleanTimingDistribution;
    startupOnloadInitialWindow: GleanTimingDistribution;
    collectAllWindowsData: GleanTimingDistribution;
    collectData: GleanTimingDistribution;
    collectSessionHistory: GleanTimingDistribution;
    readFile: GleanTimingDistribution;
    writeFile: GleanTimingDistribution;
    fileSizeBytes: GleanMemoryDistribution;
    corruptFile: Record<string, GleanCounter>;
    allFilesCorrupt: Record<string, GleanCounter>;
    restoreWindow: GleanTimingDistribution;
    autoRestoreDurationUntilEagerTabsRestored: GleanTimingDistribution;
    manualRestoreDurationUntilEagerTabsRestored: GleanTimingDistribution;
    numberOfTabsRestored: GleanCustomDistribution;
    numberOfWindowsRestored: GleanCustomDistribution;
    numberOfEagerTabsRestored: GleanCustomDistribution;
    shutdownOk: Record<string, GleanCounter>;
  }

  sidebar: {
    expand: GleanEvent;
    resize: GleanEvent;
    displaySettings: GleanString;
    positionSettings: GleanString;
    tabsLayout: GleanString;
    width: GleanQuantity;
    search: Record<string, GleanCounter>;
    link: Record<string, GleanCounter>;
    chatbotIconClick: GleanEvent;
    historyIconClick: GleanEvent;
    syncedTabsIconClick: GleanEvent;
    bookmarksIconClick: GleanEvent;
    addonIconClick: GleanEvent;
    keyboardShortcut: GleanEvent;
  }

  history: {
    sidebarToggle: GleanEvent;
  }

  syncedTabs: {
    sidebarToggle: GleanEvent;
    clickFxaAvatarMenu: GleanEvent;
    clickFxaAppMenu: GleanEvent;
    clickSyncedTabsSidebar: GleanEvent;
  }

  bookmarks: {
    sidebarToggle: GleanEvent;
  }

  extension: {
    sidebarToggle: GleanEvent;
  }

  sidebarCustomize: {
    panelToggle: GleanEvent;
    iconClick: GleanEvent;
    chatbotEnabled: GleanEvent;
    syncedTabsEnabled: GleanEvent;
    historyEnabled: GleanEvent;
    bookmarksEnabled: GleanEvent;
    extensionsClicked: GleanEvent;
    sidebarDisplay: GleanEvent;
    sidebarPosition: GleanEvent;
    tabsLayout: GleanEvent;
    tabsDisplay: GleanEvent;
    firefoxSettingsClicked: GleanEvent;
    expandOnHoverEnabled: GleanEvent;
  }

  contextualManager: {
    sidebarToggle: GleanEvent;
    passwordsEnabled: GleanEvent;
    toolbarAction: GleanEvent;
    recordsUpdate: GleanEvent;
    recordsInteraction: GleanEvent;
    notificationShown: GleanEvent;
    notificationInteraction: GleanEvent;
  }

  browserUiInteraction: {
    allTabsPanelDragstartTabEventCount: GleanCounter;
    allTabsPanelEntrypoint: Record<string, GleanCounter>;
    textrecognitionError: GleanCounter;
    menuBar: Record<string, GleanCounter>;
    tabsBar: Record<string, GleanCounter>;
    verticalTabsContainer: Record<string, GleanCounter>;
    navBar: Record<string, GleanCounter>;
    bookmarksBar: Record<string, GleanCounter>;
    appMenu: Record<string, GleanCounter>;
    tabsContext: Record<string, GleanCounter>;
    tabsContextEntrypoint: Record<string, GleanCounter>;
    contentContext: Record<string, GleanCounter>;
    overflowMenu: Record<string, GleanCounter>;
    unifiedExtensionsArea: Record<string, GleanCounter>;
    pinnedOverflowMenu: Record<string, GleanCounter>;
    pageactionUrlbar: Record<string, GleanCounter>;
    pageactionPanel: Record<string, GleanCounter>;
    preferencesPaneHome: Record<string, GleanCounter>;
    preferencesPaneGeneral: Record<string, GleanCounter>;
    preferencesPanePrivacy: Record<string, GleanCounter>;
    preferencesPaneSearch: Record<string, GleanCounter>;
    preferencesPaneSearchResults: Record<string, GleanCounter>;
    preferencesPaneSync: Record<string, GleanCounter>;
    preferencesPaneContainers: Record<string, GleanCounter>;
    preferencesPaneExperimental: Record<string, GleanCounter>;
    preferencesPaneMoreFromMozilla: Record<string, GleanCounter>;
    preferencesPaneUnknown: Record<string, GleanCounter>;
    keyboard: Record<string, GleanCounter>;
  }

  tabgroup: {
    createGroup: GleanEvent;
    reopen: GleanEvent;
    addTab: GleanEvent;
    activeGroups: Record<string, GleanQuantity>;
    tabsPerActiveGroup: Record<string, GleanQuantity>;
    savedGroups: GleanQuantity;
    tabsPerSavedGroup: Record<string, GleanQuantity>;
    tabCountInGroups: Record<string, GleanQuantity>;
    save: GleanEvent;
    delete: GleanEvent;
    ungroup: GleanEvent;
    tabInteractions: Record<string, GleanCounter>;
    groupInteractions: Record<string, GleanCounter>;
    smartTabOptin: GleanEvent;
    smartTabTopic: GleanEvent;
    smartTabSuggest: GleanEvent;
    smartTab: GleanEvent;
    smartTabEnabled: GleanBoolean;
  }

  browserTabswitch: {
    update: GleanTimingDistribution;
    total: GleanTimingDistribution;
    spinnerVisible: GleanTimingDistribution;
    spinnerVisibleTrigger: Record<string, GleanCounter>;
  }

  browserTabclose: {
    timeAnim: GleanTimingDistribution;
    timeNoAnim: GleanTimingDistribution;
    permitUnloadTime: GleanTimingDistribution;
  }

  textRecognition: {
    apiPerformance: GleanTimingDistribution;
    interactionTiming: GleanTimingDistribution;
    textLength: GleanCustomDistribution;
  }

  urlbar: {
    abandonment: GleanEvent;
    disable: GleanEvent;
    engagement: GleanEvent;
    fakespotEngagement: GleanEvent;
    exposure: GleanEvent;
    keywordExposure: GleanEvent;
    quickSuggestContextualOptIn: GleanEvent;
    prefMaxResults: GleanQuantity;
    prefSuggestDataCollection: GleanBoolean;
    prefSuggestNonsponsored: GleanBoolean;
    prefSuggestSponsored: GleanBoolean;
    prefSuggestTopsites: GleanBoolean;
    autofillDeletion: GleanCounter;
    autocompleteFirstResultTime: GleanTimingDistribution;
    autocompleteSixthResultTime: GleanTimingDistribution;
  }

  quickSuggest: {
    pingType: GleanString;
    position: GleanQuantity;
    suggestedIndex: GleanString;
    suggestedIndexRelativeToGroup: GleanBoolean;
    source: GleanString;
    matchType: GleanString;
    blockId: GleanString;
    improveSuggestExperience: GleanBoolean;
    advertiser: GleanString;
    requestId: GleanString;
    isClicked: GleanBoolean;
    reportingUrl: GleanUrl;
    contextId: GleanUuid;
    iabCategory: GleanString;
  }

  suggest: {
    ingestTime: Record<string, GleanTimingDistribution>;
    ingestDownloadTime: Record<string, GleanTimingDistribution>;
    queryTime: Record<string, GleanTimingDistribution>;
  }

  suggestRelevance: {
    status: Record<string, GleanCounter>;
    outcome: Record<string, GleanCounter>;
  }

  urlbarTrending: {
    block: GleanCounter;
  }

  urlbarPersistedsearchterms: {
    revertByPopupCount: GleanCounter;
    viewCount: GleanCounter;
  }

  urlbarZeroprefix: {
    abandonment: GleanCounter;
    engagement: GleanCounter;
    exposure: GleanCounter;
  }

  urlbarQuickaction: {
    picked: Record<string, GleanCounter>;
  }

  urlbarUnifiedsearchbutton: {
    opened: GleanCounter;
    picked: Record<string, GleanCounter>;
  }

  addonsSearchDetection: {
    etldChangeWebrequest: GleanEvent;
    etldChangeOther: GleanEvent;
  }

  installationFirstSeen: {
    failureReason: GleanString;
    installerType: GleanString;
    version: GleanString;
    adminUser: GleanBoolean;
    installExisted: GleanBoolean;
    profdirExisted: GleanBoolean;
    otherInst: GleanBoolean;
    otherMsixInst: GleanBoolean;
    silent: GleanBoolean;
    fromMsi: GleanBoolean;
    defaultPath: GleanBoolean;
  }

  performanceInteraction: {
    tabSwitchComposite: GleanTimingDistribution;
    keypressPresentLatency: GleanTimingDistribution;
    mouseupClickPresentLatency: GleanTimingDistribution;
  }

  browserUsage: {
    interaction: GleanEvent;
  }

  browserUi: {
    toolbarWidgets: GleanObject;
    mirrorForToolbarWidgets: Record<string, GleanBoolean>;
    customizedWidgets: Record<string, GleanCounter>;
  }

  homepage: {
    preferenceIgnore: GleanEvent;
  }

  installation: {
    firstSeenFull: GleanEvent;
    firstSeenStub: GleanEvent;
    firstSeenMsix: GleanEvent;
  }

  partnerLink: {
    clickNewtab: GleanEvent;
    clickUrlbar: GleanEvent;
    attributionSuccess: GleanEvent;
    attributionFailure: GleanEvent;
    attributionAbort: GleanEvent;
  }

  timestamps: {
    aboutHomeTopsitesFirstPaint: GleanQuantity;
    firstPaint: GleanQuantity;
    firstPaintTwo: GleanQuantity;
  }

  browserSanitizer: {
    total: GleanTimingDistribution;
    cache: GleanTimingDistribution;
    cookies: GleanTimingDistribution;
    history: GleanTimingDistribution;
    formdata: GleanTimingDistribution;
    downloads: GleanTimingDistribution;
    sessions: GleanTimingDistribution;
    sitesettings: GleanTimingDistribution;
    openwindows: GleanTimingDistribution;
  }

  browserContentCrash: {
    dumpUnavailable: GleanCounter;
    notSubmitted: GleanCounter;
  }

  linkIconSizesAttr: {
    usage: GleanCustomDistribution;
    dimension: GleanCustomDistribution;
  }

  contextualServices: {
    contextId: GleanUuid;
  }

  devtoolsAccessibility: {
    nodeInspectedCount: GleanCounter;
    selectAccessibleForNode: Record<string, GleanCounter>;
    accessibleContextMenuOpened: GleanCounter;
    accessibleContextMenuItemActivated: Record<string, GleanCounter>;
    auditActivated: Record<string, GleanCounter>;
    simulationActivated: Record<string, GleanCounter>;
    openedCount: GleanCounter;
    pickerUsedCount: GleanCounter;
  }

  devtools: {
    currentTheme: Record<string, GleanCounter>;
    coldToolboxOpenDelay: Record<string, GleanTimingDistribution>;
    warmToolboxOpenDelay: Record<string, GleanTimingDistribution>;
    toolboxPageReloadDelay: Record<string, GleanTimingDistribution>;
    toolboxHost: GleanCustomDistribution;
    toolboxOpenedCount: GleanCounter;
    optionsOpenedCount: GleanCounter;
    webconsoleOpenedCount: GleanCounter;
    browserconsoleOpenedCount: GleanCounter;
    inspectorOpenedCount: GleanCounter;
    ruleviewOpenedCount: GleanCounter;
    computedviewOpenedCount: GleanCounter;
    layoutviewOpenedCount: GleanCounter;
    fontinspectorOpenedCount: GleanCounter;
    animationinspectorOpenedCount: GleanCounter;
    jsdebuggerOpenedCount: GleanCounter;
    jsbrowserdebuggerOpenedCount: GleanCounter;
    styleeditorOpenedCount: GleanCounter;
    jsprofilerOpenedCount: GleanCounter;
    memoryOpenedCount: GleanCounter;
    netmonitorOpenedCount: GleanCounter;
    storageOpenedCount: GleanCounter;
    domOpenedCount: GleanCounter;
    responsiveOpenedCount: GleanCounter;
    eyedropperOpenedCount: GleanCounter;
    menuEyedropperOpenedCount: GleanCounter;
    pickerEyedropperOpenedCount: GleanCounter;
    aboutdebuggingOpenedCount: GleanCounter;
    compatibilityviewOpenedCount: GleanCounter;
    customOpenedCount: GleanCounter;
    accessibilityTimeActive: GleanTimingDistribution;
    accessibilityPickerTimeActive: GleanTimingDistribution;
    accessibilityServiceTimeActive: GleanTimingDistribution;
    flexboxHighlighterTimeActive: GleanTimingDistribution;
    gridHighlighterTimeActive: GleanTimingDistribution;
    toolboxTimeActive: GleanTimingDistribution;
    optionsTimeActive: GleanTimingDistribution;
    webconsoleTimeActive: GleanTimingDistribution;
    browserconsoleTimeActive: GleanTimingDistribution;
    inspectorTimeActive: GleanTimingDistribution;
    ruleviewTimeActive: GleanTimingDistribution;
    changesviewTimeActive: GleanTimingDistribution;
    computedviewTimeActive: GleanTimingDistribution;
    layoutviewTimeActive: GleanTimingDistribution;
    fontinspectorTimeActive: GleanTimingDistribution;
    animationinspectorTimeActive: GleanTimingDistribution;
    jsdebuggerTimeActive: GleanTimingDistribution;
    jsbrowserdebuggerTimeActive: GleanTimingDistribution;
    styleeditorTimeActive: GleanTimingDistribution;
    jsprofilerTimeActive: GleanTimingDistribution;
    memoryTimeActive: GleanTimingDistribution;
    netmonitorTimeActive: GleanTimingDistribution;
    storageTimeActive: GleanTimingDistribution;
    domTimeActive: GleanTimingDistribution;
    responsiveTimeActive: GleanTimingDistribution;
    aboutdebuggingTimeActive: GleanTimingDistribution;
    compatibilityviewTimeActive: GleanTimingDistribution;
    customTimeActive: GleanTimingDistribution;
    entryPoint: Record<string, GleanCounter>;
    saveHeapSnapshot: GleanTimingDistribution;
    readHeapSnapshot: GleanTimingDistribution;
    heapSnapshotNodeCount: GleanCustomDistribution;
    heapSnapshotEdgeCount: GleanCustomDistribution;
  }

  devtoolsTool: {
    registered: Record<string, GleanBoolean>;
  }

  devtoolsToolbox: {
    tabsReordered: Record<string, GleanCounter>;
  }

  devtoolsInspector: {
    threePaneEnabled: Record<string, GleanCounter>;
    nodeSelectionCount: GleanCounter;
    newRootToReloadDelay: GleanTimingDistribution;
    numberOfCssGridsInAPage: GleanCustomDistribution;
    fonteditorFontTypeDisplayed: Record<string, GleanCounter>;
  }

  devtoolsLayoutFlexboxhighlighter: {
    opened: GleanCounter;
  }

  devtoolsMarkupFlexboxhighlighter: {
    opened: GleanCounter;
  }

  devtoolsRulesFlexboxhighlighter: {
    opened: GleanCounter;
  }

  devtoolsMarkupGridinspector: {
    opened: GleanCounter;
  }

  devtoolsRulesGridinspector: {
    opened: GleanCounter;
  }

  devtoolsGridGridinspector: {
    opened: GleanCounter;
  }

  devtoolsShadowdom: {
    shadowRootDisplayed: GleanBoolean;
    shadowRootExpanded: GleanBoolean;
    revealLinkClicked: GleanBoolean;
  }

  devtoolsTooltip: {
    shown: Record<string, GleanCounter>;
  }

  devtoolsMarkupScrollableBadge: {
    clicked: GleanCounter;
  }

  devtoolsResponsive: {
    openTrigger: Record<string, GleanCounter>;
    toolboxOpenedFirst: GleanCounter;
  }

  devtoolsMain: {
    activateResponsiveDesign: GleanEvent;
    activateSplitConsole: GleanEvent;
    addBreakpointDebugger: GleanEvent;
    blackboxDebugger: GleanEvent;
    closeTools: GleanEvent;
    closeAdbgAboutdebugging: GleanEvent;
    connectionAttemptAboutdebugging: GleanEvent;
    continueDebugger: GleanEvent;
    deactivateResponsiveDesign: GleanEvent;
    deactivateSplitConsole: GleanEvent;
    deviceAddedAboutdebugging: GleanEvent;
    deviceRemovedAboutdebugging: GleanEvent;
    editHtmlInspector: GleanEvent;
    editResendNetmonitor: GleanEvent;
    editRuleRuleview: GleanEvent;
    enterAccessibility: GleanEvent;
    enterApplication: GleanEvent;
    enterDom: GleanEvent;
    enterInspector: GleanEvent;
    enterJsdebugger: GleanEvent;
    enterMemory: GleanEvent;
    enterNetmonitor: GleanEvent;
    enterOptions: GleanEvent;
    enterPerformance: GleanEvent;
    enterStorage: GleanEvent;
    enterStyleeditor: GleanEvent;
    enterWebconsole: GleanEvent;
    enterWhatsnew: GleanEvent;
    enterOther: GleanEvent;
    enterFakeTool4242: GleanEvent;
    enterTestBlankPanel: GleanEvent;
    enterTestTool: GleanEvent;
    enterTesttool1: GleanEvent;
    enterTestTool1072208: GleanEvent;
    enterTesttool2: GleanEvent;
    executeJsWebconsole: GleanEvent;
    reverseSearchWebconsole: GleanEvent;
    exitAccessibility: GleanEvent;
    exitApplication: GleanEvent;
    exitDom: GleanEvent;
    exitInspector: GleanEvent;
    exitJsdebugger: GleanEvent;
    exitMemory: GleanEvent;
    exitNetmonitor: GleanEvent;
    exitOptions: GleanEvent;
    exitPerformance: GleanEvent;
    exitStorage: GleanEvent;
    exitStyleeditor: GleanEvent;
    exitWebconsole: GleanEvent;
    exitWhatsnew: GleanEvent;
    exitOther: GleanEvent;
    exitFakeTool4242: GleanEvent;
    exitTestBlankPanel: GleanEvent;
    exitTestTool: GleanEvent;
    exitTesttool1: GleanEvent;
    exitTestTool1072208: GleanEvent;
    exitTesttool2: GleanEvent;
    filtersChangedNetmonitor: GleanEvent;
    filtersChangedWebconsole: GleanEvent;
    inspectAboutdebugging: GleanEvent;
    jumpToDefinitionWebconsole: GleanEvent;
    jumpToSourceWebconsole: GleanEvent;
    objectExpandedWebconsole: GleanEvent;
    openTools: GleanEvent;
    openAdbgAboutdebugging: GleanEvent;
    pauseOnExceptionsDebugger: GleanEvent;
    pauseDebugger: GleanEvent;
    persistChangedNetmonitor: GleanEvent;
    persistChangedWebconsole: GleanEvent;
    prettyPrintDebugger: GleanEvent;
    removeBreakpointDebugger: GleanEvent;
    runtimeAddedAboutdebugging: GleanEvent;
    runtimeConnectedAboutdebugging: GleanEvent;
    runtimeDisconnectedAboutdebugging: GleanEvent;
    runtimeRemovedAboutdebugging: GleanEvent;
    selectPageAboutdebugging: GleanEvent;
    selectPageApplication: GleanEvent;
    showProfilerAboutdebugging: GleanEvent;
    selectWsFrameNetmonitor: GleanEvent;
    sidepanelChangedInspector: GleanEvent;
    sidepanelChangedNetmonitor: GleanEvent;
    startWorkerApplication: GleanEvent;
    throttleChangedNetmonitor: GleanEvent;
    toolTimerAnimationinspector: GleanEvent;
    toolTimerCompatibilityview: GleanEvent;
    toolTimerComputedview: GleanEvent;
    toolTimerChangesview: GleanEvent;
    toolTimerFontinspector: GleanEvent;
    toolTimerLayoutview: GleanEvent;
    toolTimerRuleview: GleanEvent;
    unregisterWorkerApplication: GleanEvent;
    updateConnPromptAboutdebugging: GleanEvent;
  }

  devtoolsChangesview: {
    openedCount: GleanCounter;
  }

  performancePage: {
    totalContentPageLoad: GleanTimingDistribution;
    nonBlankPaint: GleanTimingDistribution;
  }

  bfcache: {
    combo: Record<string, GleanCounter>;
    pageRestored: Record<string, GleanCounter>;
  }

  useCounter: {
    contentDocumentsDestroyed: GleanCounter;
    topLevelContentDocumentsDestroyed: GleanCounter;
    dedicatedWorkersDestroyed: GleanCounter;
    sharedWorkersDestroyed: GleanCounter;
    serviceWorkersDestroyed: GleanCounter;
  }

  useCounterPage: {
    svgsvgelementGetelementbyid: GleanCounter;
    svgsvgelementCurrentscaleGetter: GleanCounter;
    svgsvgelementCurrentscaleSetter: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    windowSidebarGetter: GleanCounter;
    windowSidebarSetter: GleanCounter;
    datatransferAddelement: GleanCounter;
    datatransferMozitemcountGetter: GleanCounter;
    datatransferMozitemcountSetter: GleanCounter;
    datatransferMozcursorGetter: GleanCounter;
    datatransferMozcursorSetter: GleanCounter;
    datatransferMoztypesat: GleanCounter;
    datatransferMozcleardataat: GleanCounter;
    datatransferMozsetdataat: GleanCounter;
    datatransferMozgetdataat: GleanCounter;
    datatransferMozusercancelledGetter: GleanCounter;
    datatransferMozusercancelledSetter: GleanCounter;
    datatransferMozsourcenodeGetter: GleanCounter;
    datatransferMozsourcenodeSetter: GleanCounter;
    jsAsmjs: GleanCounter;
    jsWasm: GleanCounter;
    jsWasmLegacyExceptions: GleanCounter;
    jsIsHtmlddaFuse: GleanCounter;
    jsOptimizeGetIteratorFuse: GleanCounter;
    jsOptimizeArraySpeciesFuse: GleanCounter;
    jsOptimizePromiseLookupFuse: GleanCounter;
    jsThenable: GleanCounter;
    jsThenableProto: GleanCounter;
    jsThenableStandardProto: GleanCounter;
    jsThenableObjectProto: GleanCounter;
    jsLegacyLangSubtag: GleanCounter;
    jsIcStubTooLarge: GleanCounter;
    jsIcStubOom: GleanCounter;
    jsErrorstackGetter: GleanCounter;
    jsErrorstackGetterNoErrordata: GleanCounter;
    jsErrorstackSetter: GleanCounter;
    jsErrorstackSetterNonstring: GleanCounter;
    jsErrorstackSetterNoErrordata: GleanCounter;
    jsDateparse: GleanCounter;
    jsDateparseImplDef: GleanCounter;
    jsRegexpSymbolProtocolOnPrimitive: GleanCounter;
    jsLargeOomReported: GleanCounter;
    jsSmallOomReported: GleanCounter;
    jsLargeOomRecovered: GleanCounter;
    jsSmallOomRecovered: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleError: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleTable: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleException: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    cookiestoreDelete: GleanCounter;
    documentOpen: GleanCounter;
    htmldocumentNamedGetterHit: GleanCounter;
    filteredCrossOriginIframe: GleanCounter;
    customelementregistryDefine: GleanCounter;
    customizedBuiltin: GleanCounter;
    xslstylesheet: GleanCounter;
    xsltprocessorConstructor: GleanCounter;
    elementAttachshadow: GleanCounter;
    elementSetcapture: GleanCounter;
    elementReleasecapture: GleanCounter;
    elementSetpointercapture: GleanCounter;
    elementReleasepointercapture: GleanCounter;
    mediadevicesEnumeratedevices: GleanCounter;
    enumerateDevicesInsec: GleanCounter;
    enumerateDevicesUnfocused: GleanCounter;
    mediadevicesGetusermedia: GleanCounter;
    navigatorMozgetusermedia: GleanCounter;
    getUserMediaUnfocused: GleanCounter;
    getUserMediaInsec: GleanCounter;
    mediadevicesGetdisplaymedia: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    documentMozsetimageelement: GleanCounter;
    ondommousescroll: GleanCounter;
    onmozmousepixelscroll: GleanCounter;
    percentageStrokeWidthInSvg: GleanCounter;
    percentageStrokeWidthInSvgtext: GleanCounter;
    htmldocumentCaretrangefrompoint: GleanCounter;
    htmldocumentExitpictureinpicture: GleanCounter;
    htmldocumentFeaturepolicy: GleanCounter;
    htmldocumentOnbeforecopy: GleanCounter;
    htmldocumentOnbeforecut: GleanCounter;
    htmldocumentOnbeforepaste: GleanCounter;
    htmldocumentOncancel: GleanCounter;
    htmldocumentOnfreeze: GleanCounter;
    htmldocumentOnmousewheel: GleanCounter;
    htmldocumentOnresume: GleanCounter;
    htmldocumentOnsearch: GleanCounter;
    htmldocumentOnwebkitfullscreenchange: GleanCounter;
    htmldocumentOnwebkitfullscreenerror: GleanCounter;
    htmldocumentPictureinpictureelement: GleanCounter;
    htmldocumentPictureinpictureenabled: GleanCounter;
    htmldocumentRegisterelement: GleanCounter;
    htmldocumentWasdiscarded: GleanCounter;
    htmldocumentWebkitcancelfullscreen: GleanCounter;
    htmldocumentWebkitcurrentfullscreenelement: GleanCounter;
    htmldocumentWebkitexitfullscreen: GleanCounter;
    htmldocumentWebkitfullscreenelement: GleanCounter;
    htmldocumentWebkitfullscreenenabled: GleanCounter;
    htmldocumentWebkithidden: GleanCounter;
    htmldocumentWebkitisfullscreen: GleanCounter;
    htmldocumentWebkitvisibilitystate: GleanCounter;
    htmldocumentXmlencoding: GleanCounter;
    htmldocumentXmlstandalone: GleanCounter;
    htmldocumentXmlversion: GleanCounter;
    locationAncestororigins: GleanCounter;
    windowAbsoluteorientationsensor: GleanCounter;
    windowAccelerometer: GleanCounter;
    windowBackgroundfetchmanager: GleanCounter;
    windowBackgroundfetchrecord: GleanCounter;
    windowBackgroundfetchregistration: GleanCounter;
    windowBeforeinstallpromptevent: GleanCounter;
    windowBluetooth: GleanCounter;
    windowBluetoothcharacteristicproperties: GleanCounter;
    windowBluetoothdevice: GleanCounter;
    windowBluetoothremotegattcharacteristic: GleanCounter;
    windowBluetoothremotegattdescriptor: GleanCounter;
    windowBluetoothremotegattserver: GleanCounter;
    windowBluetoothremotegattservice: GleanCounter;
    windowBluetoothuuid: GleanCounter;
    windowCanvascapturemediastreamtrack: GleanCounter;
    windowChrome: GleanCounter;
    windowClipboarditem: GleanCounter;
    windowCssimagevalue: GleanCounter;
    windowCsskeywordvalue: GleanCounter;
    windowCssmathclamp: GleanCounter;
    windowCssmathinvert: GleanCounter;
    windowCssmathmax: GleanCounter;
    windowCssmathmin: GleanCounter;
    windowCssmathnegate: GleanCounter;
    windowCssmathproduct: GleanCounter;
    windowCssmathsum: GleanCounter;
    windowCssmathvalue: GleanCounter;
    windowCssmatrixcomponent: GleanCounter;
    windowCssnumericarray: GleanCounter;
    windowCssnumericvalue: GleanCounter;
    windowCssperspective: GleanCounter;
    windowCsspositionvalue: GleanCounter;
    windowCsspropertyrule: GleanCounter;
    windowCssrotate: GleanCounter;
    windowCssscale: GleanCounter;
    windowCssskew: GleanCounter;
    windowCssskewx: GleanCounter;
    windowCssskewy: GleanCounter;
    windowCssstylevalue: GleanCounter;
    windowCsstransformcomponent: GleanCounter;
    windowCsstransformvalue: GleanCounter;
    windowCsstranslate: GleanCounter;
    windowCssunitvalue: GleanCounter;
    windowCssunparsedvalue: GleanCounter;
    windowCssvariablereferencevalue: GleanCounter;
    windowDefaultstatus: GleanCounter;
    windowDevicemotioneventacceleration: GleanCounter;
    windowDevicemotioneventrotationrate: GleanCounter;
    windowDomerror: GleanCounter;
    windowEncodedvideochunk: GleanCounter;
    windowEnterpictureinpictureevent: GleanCounter;
    windowExternal: GleanCounter;
    windowFederatedcredential: GleanCounter;
    windowGyroscope: GleanCounter;
    windowHtmlcontentelement: GleanCounter;
    windowHtmlshadowelement: GleanCounter;
    windowImagecapture: GleanCounter;
    windowInputdevicecapabilities: GleanCounter;
    windowInputdeviceinfo: GleanCounter;
    windowKeyboard: GleanCounter;
    windowKeyboardlayoutmap: GleanCounter;
    windowLinearaccelerationsensor: GleanCounter;
    windowMediasettingsrange: GleanCounter;
    windowMidiaccess: GleanCounter;
    windowMidiconnectionevent: GleanCounter;
    windowMidiinput: GleanCounter;
    windowMidiinputmap: GleanCounter;
    windowMidimessageevent: GleanCounter;
    windowMidioutput: GleanCounter;
    windowMidioutputmap: GleanCounter;
    windowMidiport: GleanCounter;
    windowNetworkinformation: GleanCounter;
    windowOffscreenbuffering: GleanCounter;
    windowOnbeforeinstallprompt: GleanCounter;
    windowOncancel: GleanCounter;
    windowOnmousewheel: GleanCounter;
    windowOnorientationchange: GleanCounter;
    windowOnsearch: GleanCounter;
    windowOnselectionchange: GleanCounter;
    windowOpendatabase: GleanCounter;
    windowOrientation: GleanCounter;
    windowOrientationsensor: GleanCounter;
    windowOverconstrainederror: GleanCounter;
    windowPasswordcredential: GleanCounter;
    windowPaymentaddress: GleanCounter;
    windowPaymentinstruments: GleanCounter;
    windowPaymentmanager: GleanCounter;
    windowPaymentmethodchangeevent: GleanCounter;
    windowPaymentrequest: GleanCounter;
    windowPaymentrequestupdateevent: GleanCounter;
    windowPaymentresponse: GleanCounter;
    windowPerformancelongtasktiming: GleanCounter;
    windowPhotocapabilities: GleanCounter;
    windowPictureinpictureevent: GleanCounter;
    windowPictureinpicturewindow: GleanCounter;
    windowPresentation: GleanCounter;
    windowPresentationavailability: GleanCounter;
    windowPresentationconnection: GleanCounter;
    windowPresentationconnectionavailableevent: GleanCounter;
    windowPresentationconnectioncloseevent: GleanCounter;
    windowPresentationconnectionlist: GleanCounter;
    windowPresentationreceiver: GleanCounter;
    windowPresentationrequest: GleanCounter;
    windowRelativeorientationsensor: GleanCounter;
    windowRemoteplayback: GleanCounter;
    windowReport: GleanCounter;
    windowReportbody: GleanCounter;
    windowReportingobserver: GleanCounter;
    windowRtcerror: GleanCounter;
    windowRtcerrorevent: GleanCounter;
    windowRtcicetransport: GleanCounter;
    windowRtcpeerconnectioniceerrorevent: GleanCounter;
    windowSensor: GleanCounter;
    windowSensorerrorevent: GleanCounter;
    windowSpeechrecognitionalternative: GleanCounter;
    windowSpeechrecognitionresult: GleanCounter;
    windowSpeechrecognitionresultlist: GleanCounter;
    windowStylemedia: GleanCounter;
    windowStylepropertymap: GleanCounter;
    windowStylepropertymapreadonly: GleanCounter;
    windowSvgdiscardelement: GleanCounter;
    windowSyncmanager: GleanCounter;
    windowTaskattributiontiming: GleanCounter;
    windowTextevent: GleanCounter;
    windowTouch: GleanCounter;
    windowTouchevent: GleanCounter;
    windowTouchlist: GleanCounter;
    windowUsb: GleanCounter;
    windowUsbalternateinterface: GleanCounter;
    windowUsbconfiguration: GleanCounter;
    windowUsbconnectionevent: GleanCounter;
    windowUsbdevice: GleanCounter;
    windowUsbendpoint: GleanCounter;
    windowUsbinterface: GleanCounter;
    windowUsbintransferresult: GleanCounter;
    windowUsbisochronousintransferpacket: GleanCounter;
    windowUsbisochronousintransferresult: GleanCounter;
    windowUsbisochronousouttransferpacket: GleanCounter;
    windowUsbisochronousouttransferresult: GleanCounter;
    windowUsbouttransferresult: GleanCounter;
    windowUseractivation: GleanCounter;
    windowVideocolorspace: GleanCounter;
    windowVideodecoder: GleanCounter;
    windowVideoencoder: GleanCounter;
    windowVideoframe: GleanCounter;
    windowWakelock: GleanCounter;
    windowWakelocksentinel: GleanCounter;
    windowWebkitcancelanimationframe: GleanCounter;
    windowWebkitmediastream: GleanCounter;
    windowWebkitmutationobserver: GleanCounter;
    windowWebkitrequestanimationframe: GleanCounter;
    windowWebkitrequestfilesystem: GleanCounter;
    windowWebkitresolvelocalfilesystemurl: GleanCounter;
    windowWebkitrtcpeerconnection: GleanCounter;
    windowWebkitspeechgrammar: GleanCounter;
    windowWebkitspeechgrammarlist: GleanCounter;
    windowWebkitspeechrecognition: GleanCounter;
    windowWebkitspeechrecognitionerror: GleanCounter;
    windowWebkitspeechrecognitionevent: GleanCounter;
    windowWebkitstorageinfo: GleanCounter;
    documentExecCommandContentReadOnly: GleanCounter;
    domparserParsefromstring: GleanCounter;
    rangeCreatecontextualfragment: GleanCounter;
    documentQueryCommandStateOrValueContentReadOnly: GleanCounter;
    documentQueryCommandStateOrValueInsertBrOnReturn: GleanCounter;
    documentQueryCommandSupportedOrEnabledContentReadOnly: GleanCounter;
    documentQueryCommandSupportedOrEnabledInsertBrOnReturn: GleanCounter;
    animationCommitstyles: GleanCounter;
    commitStylesNonFillingFinalValue: GleanCounter;
    feBlend: GleanCounter;
    feColorMatrix: GleanCounter;
    feComponentTransfer: GleanCounter;
    feComposite: GleanCounter;
    feConvolveMatrix: GleanCounter;
    feDiffuseLighting: GleanCounter;
    feDisplacementMap: GleanCounter;
    feFlood: GleanCounter;
    feGaussianBlur: GleanCounter;
    feImage: GleanCounter;
    feMerge: GleanCounter;
    feMorphology: GleanCounter;
    feOffset: GleanCounter;
    feSpecularLighting: GleanCounter;
    feTile: GleanCounter;
    feTurbulence: GleanCounter;
    wrFilterFallback: GleanCounter;
    sanitizerConstructor: GleanCounter;
    sanitizerSanitize: GleanCounter;
    elementSethtml: GleanCounter;
    windowOpenEmptyUrl: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingNavigatorServiceWorker: GleanCounter;
    youTubeFlashEmbed: GleanCounter;
    schedulerPosttask: GleanCounter;
    htmldialogelementShow: GleanCounter;
    mixedContentUpgradedImageSuccess: GleanCounter;
    mixedContentUpgradedImageFailure: GleanCounter;
    mixedContentUpgradedVideoSuccess: GleanCounter;
    mixedContentUpgradedVideoFailure: GleanCounter;
    mixedContentUpgradedAudioSuccess: GleanCounter;
    mixedContentUpgradedAudioFailure: GleanCounter;
    mixedContentNotUpgradedImageSuccess: GleanCounter;
    mixedContentNotUpgradedImageFailure: GleanCounter;
    mixedContentNotUpgradedVideoSuccess: GleanCounter;
    mixedContentNotUpgradedVideoFailure: GleanCounter;
    mixedContentNotUpgradedAudioSuccess: GleanCounter;
    mixedContentNotUpgradedAudioFailure: GleanCounter;
    componentsShimResolved: GleanCounter;
    sectioningH1WithNoFontSizeOrMargins: GleanCounter;
    textDirectivePages: GleanCounter;
    invalidTextDirectives: GleanCounter;
    textDirectiveNotCreated: GleanCounter;
    mathMlused: GleanCounter;
  }

  useCounterDoc: {
    svgsvgelementGetelementbyid: GleanCounter;
    svgsvgelementCurrentscaleGetter: GleanCounter;
    svgsvgelementCurrentscaleSetter: GleanCounter;
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    windowSidebarGetter: GleanCounter;
    windowSidebarSetter: GleanCounter;
    datatransferAddelement: GleanCounter;
    datatransferMozitemcountGetter: GleanCounter;
    datatransferMozitemcountSetter: GleanCounter;
    datatransferMozcursorGetter: GleanCounter;
    datatransferMozcursorSetter: GleanCounter;
    datatransferMoztypesat: GleanCounter;
    datatransferMozcleardataat: GleanCounter;
    datatransferMozsetdataat: GleanCounter;
    datatransferMozgetdataat: GleanCounter;
    datatransferMozusercancelledGetter: GleanCounter;
    datatransferMozusercancelledSetter: GleanCounter;
    datatransferMozsourcenodeGetter: GleanCounter;
    datatransferMozsourcenodeSetter: GleanCounter;
    jsAsmjs: GleanCounter;
    jsWasm: GleanCounter;
    jsWasmLegacyExceptions: GleanCounter;
    jsIsHtmlddaFuse: GleanCounter;
    jsOptimizeGetIteratorFuse: GleanCounter;
    jsOptimizeArraySpeciesFuse: GleanCounter;
    jsOptimizePromiseLookupFuse: GleanCounter;
    jsThenable: GleanCounter;
    jsThenableProto: GleanCounter;
    jsThenableStandardProto: GleanCounter;
    jsThenableObjectProto: GleanCounter;
    jsLegacyLangSubtag: GleanCounter;
    jsIcStubTooLarge: GleanCounter;
    jsIcStubOom: GleanCounter;
    jsErrorstackGetter: GleanCounter;
    jsErrorstackGetterNoErrordata: GleanCounter;
    jsErrorstackSetter: GleanCounter;
    jsErrorstackSetterNonstring: GleanCounter;
    jsErrorstackSetterNoErrordata: GleanCounter;
    jsDateparse: GleanCounter;
    jsDateparseImplDef: GleanCounter;
    jsRegexpSymbolProtocolOnPrimitive: GleanCounter;
    jsLargeOomReported: GleanCounter;
    jsSmallOomReported: GleanCounter;
    jsLargeOomRecovered: GleanCounter;
    jsSmallOomRecovered: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleError: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleTable: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleException: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    cookiestoreDelete: GleanCounter;
    documentOpen: GleanCounter;
    htmldocumentNamedGetterHit: GleanCounter;
    filteredCrossOriginIframe: GleanCounter;
    customelementregistryDefine: GleanCounter;
    customizedBuiltin: GleanCounter;
    xslstylesheet: GleanCounter;
    xsltprocessorConstructor: GleanCounter;
    elementAttachshadow: GleanCounter;
    elementSetcapture: GleanCounter;
    elementReleasecapture: GleanCounter;
    elementSetpointercapture: GleanCounter;
    elementReleasepointercapture: GleanCounter;
    mediadevicesEnumeratedevices: GleanCounter;
    enumerateDevicesInsec: GleanCounter;
    enumerateDevicesUnfocused: GleanCounter;
    mediadevicesGetusermedia: GleanCounter;
    navigatorMozgetusermedia: GleanCounter;
    getUserMediaUnfocused: GleanCounter;
    getUserMediaInsec: GleanCounter;
    mediadevicesGetdisplaymedia: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    documentMozsetimageelement: GleanCounter;
    ondommousescroll: GleanCounter;
    onmozmousepixelscroll: GleanCounter;
    percentageStrokeWidthInSvg: GleanCounter;
    percentageStrokeWidthInSvgtext: GleanCounter;
    htmldocumentCaretrangefrompoint: GleanCounter;
    htmldocumentExitpictureinpicture: GleanCounter;
    htmldocumentFeaturepolicy: GleanCounter;
    htmldocumentOnbeforecopy: GleanCounter;
    htmldocumentOnbeforecut: GleanCounter;
    htmldocumentOnbeforepaste: GleanCounter;
    htmldocumentOncancel: GleanCounter;
    htmldocumentOnfreeze: GleanCounter;
    htmldocumentOnmousewheel: GleanCounter;
    htmldocumentOnresume: GleanCounter;
    htmldocumentOnsearch: GleanCounter;
    htmldocumentOnwebkitfullscreenchange: GleanCounter;
    htmldocumentOnwebkitfullscreenerror: GleanCounter;
    htmldocumentPictureinpictureelement: GleanCounter;
    htmldocumentPictureinpictureenabled: GleanCounter;
    htmldocumentRegisterelement: GleanCounter;
    htmldocumentWasdiscarded: GleanCounter;
    htmldocumentWebkitcancelfullscreen: GleanCounter;
    htmldocumentWebkitcurrentfullscreenelement: GleanCounter;
    htmldocumentWebkitexitfullscreen: GleanCounter;
    htmldocumentWebkitfullscreenelement: GleanCounter;
    htmldocumentWebkitfullscreenenabled: GleanCounter;
    htmldocumentWebkithidden: GleanCounter;
    htmldocumentWebkitisfullscreen: GleanCounter;
    htmldocumentWebkitvisibilitystate: GleanCounter;
    htmldocumentXmlencoding: GleanCounter;
    htmldocumentXmlstandalone: GleanCounter;
    htmldocumentXmlversion: GleanCounter;
    locationAncestororigins: GleanCounter;
    windowAbsoluteorientationsensor: GleanCounter;
    windowAccelerometer: GleanCounter;
    windowBackgroundfetchmanager: GleanCounter;
    windowBackgroundfetchrecord: GleanCounter;
    windowBackgroundfetchregistration: GleanCounter;
    windowBeforeinstallpromptevent: GleanCounter;
    windowBluetooth: GleanCounter;
    windowBluetoothcharacteristicproperties: GleanCounter;
    windowBluetoothdevice: GleanCounter;
    windowBluetoothremotegattcharacteristic: GleanCounter;
    windowBluetoothremotegattdescriptor: GleanCounter;
    windowBluetoothremotegattserver: GleanCounter;
    windowBluetoothremotegattservice: GleanCounter;
    windowBluetoothuuid: GleanCounter;
    windowCanvascapturemediastreamtrack: GleanCounter;
    windowChrome: GleanCounter;
    windowClipboarditem: GleanCounter;
    windowCssimagevalue: GleanCounter;
    windowCsskeywordvalue: GleanCounter;
    windowCssmathclamp: GleanCounter;
    windowCssmathinvert: GleanCounter;
    windowCssmathmax: GleanCounter;
    windowCssmathmin: GleanCounter;
    windowCssmathnegate: GleanCounter;
    windowCssmathproduct: GleanCounter;
    windowCssmathsum: GleanCounter;
    windowCssmathvalue: GleanCounter;
    windowCssmatrixcomponent: GleanCounter;
    windowCssnumericarray: GleanCounter;
    windowCssnumericvalue: GleanCounter;
    windowCssperspective: GleanCounter;
    windowCsspositionvalue: GleanCounter;
    windowCsspropertyrule: GleanCounter;
    windowCssrotate: GleanCounter;
    windowCssscale: GleanCounter;
    windowCssskew: GleanCounter;
    windowCssskewx: GleanCounter;
    windowCssskewy: GleanCounter;
    windowCssstylevalue: GleanCounter;
    windowCsstransformcomponent: GleanCounter;
    windowCsstransformvalue: GleanCounter;
    windowCsstranslate: GleanCounter;
    windowCssunitvalue: GleanCounter;
    windowCssunparsedvalue: GleanCounter;
    windowCssvariablereferencevalue: GleanCounter;
    windowDefaultstatus: GleanCounter;
    windowDevicemotioneventacceleration: GleanCounter;
    windowDevicemotioneventrotationrate: GleanCounter;
    windowDomerror: GleanCounter;
    windowEncodedvideochunk: GleanCounter;
    windowEnterpictureinpictureevent: GleanCounter;
    windowExternal: GleanCounter;
    windowFederatedcredential: GleanCounter;
    windowGyroscope: GleanCounter;
    windowHtmlcontentelement: GleanCounter;
    windowHtmlshadowelement: GleanCounter;
    windowImagecapture: GleanCounter;
    windowInputdevicecapabilities: GleanCounter;
    windowInputdeviceinfo: GleanCounter;
    windowKeyboard: GleanCounter;
    windowKeyboardlayoutmap: GleanCounter;
    windowLinearaccelerationsensor: GleanCounter;
    windowMediasettingsrange: GleanCounter;
    windowMidiaccess: GleanCounter;
    windowMidiconnectionevent: GleanCounter;
    windowMidiinput: GleanCounter;
    windowMidiinputmap: GleanCounter;
    windowMidimessageevent: GleanCounter;
    windowMidioutput: GleanCounter;
    windowMidioutputmap: GleanCounter;
    windowMidiport: GleanCounter;
    windowNetworkinformation: GleanCounter;
    windowOffscreenbuffering: GleanCounter;
    windowOnbeforeinstallprompt: GleanCounter;
    windowOncancel: GleanCounter;
    windowOnmousewheel: GleanCounter;
    windowOnorientationchange: GleanCounter;
    windowOnsearch: GleanCounter;
    windowOnselectionchange: GleanCounter;
    windowOpendatabase: GleanCounter;
    windowOrientation: GleanCounter;
    windowOrientationsensor: GleanCounter;
    windowOverconstrainederror: GleanCounter;
    windowPasswordcredential: GleanCounter;
    windowPaymentaddress: GleanCounter;
    windowPaymentinstruments: GleanCounter;
    windowPaymentmanager: GleanCounter;
    windowPaymentmethodchangeevent: GleanCounter;
    windowPaymentrequest: GleanCounter;
    windowPaymentrequestupdateevent: GleanCounter;
    windowPaymentresponse: GleanCounter;
    windowPerformancelongtasktiming: GleanCounter;
    windowPhotocapabilities: GleanCounter;
    windowPictureinpictureevent: GleanCounter;
    windowPictureinpicturewindow: GleanCounter;
    windowPresentation: GleanCounter;
    windowPresentationavailability: GleanCounter;
    windowPresentationconnection: GleanCounter;
    windowPresentationconnectionavailableevent: GleanCounter;
    windowPresentationconnectioncloseevent: GleanCounter;
    windowPresentationconnectionlist: GleanCounter;
    windowPresentationreceiver: GleanCounter;
    windowPresentationrequest: GleanCounter;
    windowRelativeorientationsensor: GleanCounter;
    windowRemoteplayback: GleanCounter;
    windowReport: GleanCounter;
    windowReportbody: GleanCounter;
    windowReportingobserver: GleanCounter;
    windowRtcerror: GleanCounter;
    windowRtcerrorevent: GleanCounter;
    windowRtcicetransport: GleanCounter;
    windowRtcpeerconnectioniceerrorevent: GleanCounter;
    windowSensor: GleanCounter;
    windowSensorerrorevent: GleanCounter;
    windowSpeechrecognitionalternative: GleanCounter;
    windowSpeechrecognitionresult: GleanCounter;
    windowSpeechrecognitionresultlist: GleanCounter;
    windowStylemedia: GleanCounter;
    windowStylepropertymap: GleanCounter;
    windowStylepropertymapreadonly: GleanCounter;
    windowSvgdiscardelement: GleanCounter;
    windowSyncmanager: GleanCounter;
    windowTaskattributiontiming: GleanCounter;
    windowTextevent: GleanCounter;
    windowTouch: GleanCounter;
    windowTouchevent: GleanCounter;
    windowTouchlist: GleanCounter;
    windowUsb: GleanCounter;
    windowUsbalternateinterface: GleanCounter;
    windowUsbconfiguration: GleanCounter;
    windowUsbconnectionevent: GleanCounter;
    windowUsbdevice: GleanCounter;
    windowUsbendpoint: GleanCounter;
    windowUsbinterface: GleanCounter;
    windowUsbintransferresult: GleanCounter;
    windowUsbisochronousintransferpacket: GleanCounter;
    windowUsbisochronousintransferresult: GleanCounter;
    windowUsbisochronousouttransferpacket: GleanCounter;
    windowUsbisochronousouttransferresult: GleanCounter;
    windowUsbouttransferresult: GleanCounter;
    windowUseractivation: GleanCounter;
    windowVideocolorspace: GleanCounter;
    windowVideodecoder: GleanCounter;
    windowVideoencoder: GleanCounter;
    windowVideoframe: GleanCounter;
    windowWakelock: GleanCounter;
    windowWakelocksentinel: GleanCounter;
    windowWebkitcancelanimationframe: GleanCounter;
    windowWebkitmediastream: GleanCounter;
    windowWebkitmutationobserver: GleanCounter;
    windowWebkitrequestanimationframe: GleanCounter;
    windowWebkitrequestfilesystem: GleanCounter;
    windowWebkitresolvelocalfilesystemurl: GleanCounter;
    windowWebkitrtcpeerconnection: GleanCounter;
    windowWebkitspeechgrammar: GleanCounter;
    windowWebkitspeechgrammarlist: GleanCounter;
    windowWebkitspeechrecognition: GleanCounter;
    windowWebkitspeechrecognitionerror: GleanCounter;
    windowWebkitspeechrecognitionevent: GleanCounter;
    windowWebkitstorageinfo: GleanCounter;
    documentExecCommandContentReadOnly: GleanCounter;
    domparserParsefromstring: GleanCounter;
    rangeCreatecontextualfragment: GleanCounter;
    documentQueryCommandStateOrValueContentReadOnly: GleanCounter;
    documentQueryCommandStateOrValueInsertBrOnReturn: GleanCounter;
    documentQueryCommandSupportedOrEnabledContentReadOnly: GleanCounter;
    documentQueryCommandSupportedOrEnabledInsertBrOnReturn: GleanCounter;
    animationCommitstyles: GleanCounter;
    commitStylesNonFillingFinalValue: GleanCounter;
    feBlend: GleanCounter;
    feColorMatrix: GleanCounter;
    feComponentTransfer: GleanCounter;
    feComposite: GleanCounter;
    feConvolveMatrix: GleanCounter;
    feDiffuseLighting: GleanCounter;
    feDisplacementMap: GleanCounter;
    feFlood: GleanCounter;
    feGaussianBlur: GleanCounter;
    feImage: GleanCounter;
    feMerge: GleanCounter;
    feMorphology: GleanCounter;
    feOffset: GleanCounter;
    feSpecularLighting: GleanCounter;
    feTile: GleanCounter;
    feTurbulence: GleanCounter;
    wrFilterFallback: GleanCounter;
    sanitizerConstructor: GleanCounter;
    sanitizerSanitize: GleanCounter;
    elementSethtml: GleanCounter;
    windowOpenEmptyUrl: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    privateBrowsingNavigatorServiceWorker: GleanCounter;
    youTubeFlashEmbed: GleanCounter;
    schedulerPosttask: GleanCounter;
    htmldialogelementShow: GleanCounter;
    mixedContentUpgradedImageSuccess: GleanCounter;
    mixedContentUpgradedImageFailure: GleanCounter;
    mixedContentUpgradedVideoSuccess: GleanCounter;
    mixedContentUpgradedVideoFailure: GleanCounter;
    mixedContentUpgradedAudioSuccess: GleanCounter;
    mixedContentUpgradedAudioFailure: GleanCounter;
    mixedContentNotUpgradedImageSuccess: GleanCounter;
    mixedContentNotUpgradedImageFailure: GleanCounter;
    mixedContentNotUpgradedVideoSuccess: GleanCounter;
    mixedContentNotUpgradedVideoFailure: GleanCounter;
    mixedContentNotUpgradedAudioSuccess: GleanCounter;
    mixedContentNotUpgradedAudioFailure: GleanCounter;
    componentsShimResolved: GleanCounter;
    sectioningH1WithNoFontSizeOrMargins: GleanCounter;
    textDirectivePages: GleanCounter;
    invalidTextDirectives: GleanCounter;
    textDirectiveNotCreated: GleanCounter;
    mathMlused: GleanCounter;
  }

  useCounterWorkerDedicated: {
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleError: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleTable: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleException: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    cookiestoreDelete: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    schedulerPosttask: GleanCounter;
  }

  useCounterWorkerShared: {
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleError: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleTable: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleException: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    cookiestoreDelete: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    schedulerPosttask: GleanCounter;
  }

  useCounterWorkerService: {
    pushmanagerSubscribe: GleanCounter;
    pushsubscriptionUnsubscribe: GleanCounter;
    consoleAssert: GleanCounter;
    consoleClear: GleanCounter;
    consoleCount: GleanCounter;
    consoleCountreset: GleanCounter;
    consoleDebug: GleanCounter;
    consoleError: GleanCounter;
    consoleInfo: GleanCounter;
    consoleLog: GleanCounter;
    consoleTable: GleanCounter;
    consoleTrace: GleanCounter;
    consoleWarn: GleanCounter;
    consoleDir: GleanCounter;
    consoleDirxml: GleanCounter;
    consoleGroup: GleanCounter;
    consoleGroupcollapsed: GleanCounter;
    consoleGroupend: GleanCounter;
    consoleTime: GleanCounter;
    consoleTimelog: GleanCounter;
    consoleTimeend: GleanCounter;
    consoleException: GleanCounter;
    consoleTimestamp: GleanCounter;
    consoleProfile: GleanCounter;
    consoleProfileend: GleanCounter;
    cookiestoreGet: GleanCounter;
    cookiestoreGetall: GleanCounter;
    cookiestoreSet: GleanCounter;
    cookiestoreDelete: GleanCounter;
    mlsStatedelete: GleanCounter;
    mlsStatedeletegroup: GleanCounter;
    mlsGeneratesignaturekeypair: GleanCounter;
    mlsGeneratecredentialbasic: GleanCounter;
    mlsGeneratekeypackage: GleanCounter;
    mlsGroupcreate: GleanCounter;
    mlsGroupjoin: GleanCounter;
    mlsGroupadd: GleanCounter;
    mlsGroupproposeadd: GleanCounter;
    mlsGroupremove: GleanCounter;
    mlsGroupproposeremove: GleanCounter;
    mlsGroupclose: GleanCounter;
    mlsGroupmembers: GleanCounter;
    mlsReceive: GleanCounter;
    mlsSend: GleanCounter;
    mlsDeriveexporter: GleanCounter;
    privateBrowsingIdbfactoryOpen: GleanCounter;
    privateBrowsingIdbfactoryDeleteDatabase: GleanCounter;
    privateBrowsingCachesMatch: GleanCounter;
    privateBrowsingCachesHas: GleanCounter;
    privateBrowsingCachesOpen: GleanCounter;
    privateBrowsingCachesDelete: GleanCounter;
    privateBrowsingCachesKeys: GleanCounter;
    schedulerPosttask: GleanCounter;
  }

  useCounterDeprecatedOpsPage: {
    domsubtreeModified: GleanCounter;
    domnodeInserted: GleanCounter;
    domnodeRemoved: GleanCounter;
    domnodeRemovedFromDocument: GleanCounter;
    domnodeInsertedIntoDocument: GleanCounter;
    domattrModified: GleanCounter;
    domcharacterDataModified: GleanCounter;
    components: GleanCounter;
    nodeIteratorDetach: GleanCounter;
    lenientThis: GleanCounter;
    useOfCaptureEvents: GleanCounter;
    useOfReleaseEvents: GleanCounter;
    syncXmlhttpRequestDeprecated: GleanCounter;
    windowCcOntrollers: GleanCounter;
    importXulintoContent: GleanCounter;
    installTriggerDeprecated: GleanCounter;
    installTriggerInstallDeprecated: GleanCounter;
    navigatorGetUserMedia: GleanCounter;
    webrtcDeprecatedPrefix: GleanCounter;
    rtcpeerConnectionGetStreams: GleanCounter;
    appCache: GleanCounter;
    lenientSetter: GleanCounter;
    imageBitmapRenderingContextTransferImageBitmap: GleanCounter;
    windowContentUntrusted: GleanCounter;
    motionEvent: GleanCounter;
    orientationEvent: GleanCounter;
    proximityEvent: GleanCounter;
    ambientLightEvent: GleanCounter;
    idbopenDboptionsStorageType: GleanCounter;
    domquadBoundsAttr: GleanCounter;
    deprecatedTestingInterface: GleanCounter;
    deprecatedTestingMethod: GleanCounter;
    deprecatedTestingAttribute: GleanCounter;
    createImageBitmapCanvasRenderingContext2D: GleanCounter;
    drawWindowCanvasRenderingContext2D: GleanCounter;
    mozRequestFullScreenDeprecatedPrefix: GleanCounter;
    mozfullscreenchangeDeprecatedPrefix: GleanCounter;
    mozfullscreenerrorDeprecatedPrefix: GleanCounter;
    externalAddSearchProvider: GleanCounter;
    mouseEventMozPressure: GleanCounter;
    mozInputSource: GleanCounter;
    initMouseEvent: GleanCounter;
    initNsmouseEvent: GleanCounter;
    mathMlDeprecatedMathSpaceValue2: GleanCounter;
    mathMlDeprecatedMathVariant: GleanCounter;
    mathMlDeprecatedStixgeneralOperatorStretching: GleanCounter;
    formSubmissionUntrustedEvent: GleanCounter;
    elementSetCapture: GleanCounter;
    elementReleaseCapture: GleanCounter;
    documentReleaseCapture: GleanCounter;
    offscreenCanvasToBlob: GleanCounter;
    svgdeselectAll: GleanCounter;
    svgnearestViewportElement: GleanCounter;
    svgfarthestViewportElement: GleanCounter;
    idbobjectStoreCreateIndexLocale: GleanCounter;
    beforeScriptExecuteEvent: GleanCounter;
    afterScriptExecuteEvent: GleanCounter;
  }

  useCounterDeprecatedOpsDoc: {
    domsubtreeModified: GleanCounter;
    domnodeInserted: GleanCounter;
    domnodeRemoved: GleanCounter;
    domnodeRemovedFromDocument: GleanCounter;
    domnodeInsertedIntoDocument: GleanCounter;
    domattrModified: GleanCounter;
    domcharacterDataModified: GleanCounter;
    components: GleanCounter;
    nodeIteratorDetach: GleanCounter;
    lenientThis: GleanCounter;
    useOfCaptureEvents: GleanCounter;
    useOfReleaseEvents: GleanCounter;
    syncXmlhttpRequestDeprecated: GleanCounter;
    windowCcOntrollers: GleanCounter;
    importXulintoContent: GleanCounter;
    installTriggerDeprecated: GleanCounter;
    installTriggerInstallDeprecated: GleanCounter;
    navigatorGetUserMedia: GleanCounter;
    webrtcDeprecatedPrefix: GleanCounter;
    rtcpeerConnectionGetStreams: GleanCounter;
    appCache: GleanCounter;
    lenientSetter: GleanCounter;
    imageBitmapRenderingContextTransferImageBitmap: GleanCounter;
    windowContentUntrusted: GleanCounter;
    motionEvent: GleanCounter;
    orientationEvent: GleanCounter;
    proximityEvent: GleanCounter;
    ambientLightEvent: GleanCounter;
    idbopenDboptionsStorageType: GleanCounter;
    domquadBoundsAttr: GleanCounter;
    deprecatedTestingInterface: GleanCounter;
    deprecatedTestingMethod: GleanCounter;
    deprecatedTestingAttribute: GleanCounter;
    createImageBitmapCanvasRenderingContext2D: GleanCounter;
    drawWindowCanvasRenderingContext2D: GleanCounter;
    mozRequestFullScreenDeprecatedPrefix: GleanCounter;
    mozfullscreenchangeDeprecatedPrefix: GleanCounter;
    mozfullscreenerrorDeprecatedPrefix: GleanCounter;
    externalAddSearchProvider: GleanCounter;
    mouseEventMozPressure: GleanCounter;
    mozInputSource: GleanCounter;
    initMouseEvent: GleanCounter;
    initNsmouseEvent: GleanCounter;
    mathMlDeprecatedMathSpaceValue2: GleanCounter;
    mathMlDeprecatedMathVariant: GleanCounter;
    mathMlDeprecatedStixgeneralOperatorStretching: GleanCounter;
    formSubmissionUntrustedEvent: GleanCounter;
    elementSetCapture: GleanCounter;
    elementReleaseCapture: GleanCounter;
    documentReleaseCapture: GleanCounter;
    offscreenCanvasToBlob: GleanCounter;
    svgdeselectAll: GleanCounter;
    svgnearestViewportElement: GleanCounter;
    svgfarthestViewportElement: GleanCounter;
    idbobjectStoreCreateIndexLocale: GleanCounter;
    beforeScriptExecuteEvent: GleanCounter;
    afterScriptExecuteEvent: GleanCounter;
  }

  useCounterCssPage: {
    cssAlignContent: GleanCounter;
    cssAlignItems: GleanCounter;
    cssAlignSelf: GleanCounter;
    cssAspectRatio: GleanCounter;
    cssBackfaceVisibility: GleanCounter;
    cssBaselineSource: GleanCounter;
    cssBorderCollapse: GleanCounter;
    cssBorderImageRepeat: GleanCounter;
    cssBoxDecorationBreak: GleanCounter;
    cssBoxSizing: GleanCounter;
    cssBreakInside: GleanCounter;
    cssCaptionSide: GleanCounter;
    cssClear: GleanCounter;
    cssColorInterpolation: GleanCounter;
    cssColorInterpolationFilters: GleanCounter;
    cssColumnCount: GleanCounter;
    cssColumnFill: GleanCounter;
    cssColumnSpan: GleanCounter;
    cssContain: GleanCounter;
    cssContainerType: GleanCounter;
    cssContentVisibility: GleanCounter;
    cssDirection: GleanCounter;
    cssDisplay: GleanCounter;
    cssDominantBaseline: GleanCounter;
    cssEmptyCells: GleanCounter;
    cssFieldSizing: GleanCounter;
    cssFlexDirection: GleanCounter;
    cssFlexWrap: GleanCounter;
    cssFloat: GleanCounter;
    cssFontKerning: GleanCounter;
    cssFontLanguageOverride: GleanCounter;
    cssFontOpticalSizing: GleanCounter;
    cssFontSizeAdjust: GleanCounter;
    cssFontStretch: GleanCounter;
    cssFontStyle: GleanCounter;
    cssFontSynthesisStyle: GleanCounter;
    cssFontVariantCaps: GleanCounter;
    cssFontVariantEastAsian: GleanCounter;
    cssFontVariantEmoji: GleanCounter;
    cssFontVariantLigatures: GleanCounter;
    cssFontVariantNumeric: GleanCounter;
    cssFontVariantPosition: GleanCounter;
    cssFontWeight: GleanCounter;
    cssForcedColorAdjust: GleanCounter;
    cssGridAutoFlow: GleanCounter;
    cssHyphens: GleanCounter;
    cssImageOrientation: GleanCounter;
    cssImageRendering: GleanCounter;
    cssImeMode: GleanCounter;
    cssInitialLetter: GleanCounter;
    cssIsolation: GleanCounter;
    cssJustifyContent: GleanCounter;
    cssJustifyItems: GleanCounter;
    cssJustifySelf: GleanCounter;
    cssLineBreak: GleanCounter;
    cssListStylePosition: GleanCounter;
    cssMaskType: GleanCounter;
    cssMasonryAutoFlow: GleanCounter;
    cssMathDepth: GleanCounter;
    cssMathStyle: GleanCounter;
    cssMixBlendMode: GleanCounter;
    cssMozBoxAlign: GleanCounter;
    cssMozBoxCollapse: GleanCounter;
    cssMozBoxDirection: GleanCounter;
    cssMozBoxOrient: GleanCounter;
    cssMozBoxPack: GleanCounter;
    cssMozControlCharacterVisibility: GleanCounter;
    cssMozFloatEdge: GleanCounter;
    cssMozInert: GleanCounter;
    cssMozMathVariant: GleanCounter;
    cssMozMinFontSizeRatio: GleanCounter;
    cssMozOrient: GleanCounter;
    cssMozOsxFontSmoothing: GleanCounter;
    cssMozTextSizeAdjust: GleanCounter;
    cssMozTheme: GleanCounter;
    cssMozTopLayer: GleanCounter;
    cssMozUserFocus: GleanCounter;
    cssMozUserInput: GleanCounter;
    cssMozWindowDragging: GleanCounter;
    cssMozWindowShadow: GleanCounter;
    cssObjectFit: GleanCounter;
    cssOffsetRotate: GleanCounter;
    cssOutlineStyle: GleanCounter;
    cssOverflowAnchor: GleanCounter;
    cssOverflowWrap: GleanCounter;
    cssPageOrientation: GleanCounter;
    cssPaintOrder: GleanCounter;
    cssPointerEvents: GleanCounter;
    cssPosition: GleanCounter;
    cssPositionArea: GleanCounter;
    cssPositionTryOrder: GleanCounter;
    cssPositionVisibility: GleanCounter;
    cssPrintColorAdjust: GleanCounter;
    cssResize: GleanCounter;
    cssRubyAlign: GleanCounter;
    cssRubyPosition: GleanCounter;
    cssScrollBehavior: GleanCounter;
    cssScrollSnapAlign: GleanCounter;
    cssScrollSnapStop: GleanCounter;
    cssScrollSnapType: GleanCounter;
    cssScrollbarGutter: GleanCounter;
    cssScrollbarWidth: GleanCounter;
    cssShapeRendering: GleanCounter;
    cssStrokeLinecap: GleanCounter;
    cssStrokeLinejoin: GleanCounter;
    cssTableLayout: GleanCounter;
    cssTextAlign: GleanCounter;
    cssTextAlignLast: GleanCounter;
    cssTextAnchor: GleanCounter;
    cssTextCombineUpright: GleanCounter;
    cssTextDecorationLine: GleanCounter;
    cssTextDecorationSkipInk: GleanCounter;
    cssTextDecorationStyle: GleanCounter;
    cssTextEmphasisPosition: GleanCounter;
    cssTextJustify: GleanCounter;
    cssTextOrientation: GleanCounter;
    cssTextRendering: GleanCounter;
    cssTextTransform: GleanCounter;
    cssTextUnderlinePosition: GleanCounter;
    cssTextWrapMode: GleanCounter;
    cssTextWrapStyle: GleanCounter;
    cssTouchAction: GleanCounter;
    cssTransformBox: GleanCounter;
    cssTransformStyle: GleanCounter;
    cssUnicodeBidi: GleanCounter;
    cssUserSelect: GleanCounter;
    cssVectorEffect: GleanCounter;
    cssVisibility: GleanCounter;
    cssWebkitLineClamp: GleanCounter;
    cssWebkitTextSecurity: GleanCounter;
    cssWhiteSpaceCollapse: GleanCounter;
    cssWordBreak: GleanCounter;
    cssWritingMode: GleanCounter;
    cssXTextScale: GleanCounter;
    cssZIndex: GleanCounter;
    cssZoom: GleanCounter;
    cssAppearance: GleanCounter;
    cssMozDefaultAppearance: GleanCounter;
    cssMozForceBrokenImageIcon: GleanCounter;
    cssMozSubtreeHiddenOnlyVisually: GleanCounter;
    cssBreakAfter: GleanCounter;
    cssBreakBefore: GleanCounter;
    cssClipRule: GleanCounter;
    cssFillRule: GleanCounter;
    cssOverflowClipBoxBlock: GleanCounter;
    cssOverflowClipBoxInline: GleanCounter;
    cssFillOpacity: GleanCounter;
    cssStrokeOpacity: GleanCounter;
    cssFontSynthesisPosition: GleanCounter;
    cssFontSynthesisSmallCaps: GleanCounter;
    cssFontSynthesisWeight: GleanCounter;
    cssMozBoxOrdinalGroup: GleanCounter;
    cssOrder: GleanCounter;
    cssXSpan: GleanCounter;
    cssFlexGrow: GleanCounter;
    cssFlexShrink: GleanCounter;
    cssMozBoxFlex: GleanCounter;
    cssStrokeMiterlimit: GleanCounter;
    cssOverflowBlock: GleanCounter;
    cssOverflowInline: GleanCounter;
    cssOverflowX: GleanCounter;
    cssOverflowY: GleanCounter;
    cssOverscrollBehaviorBlock: GleanCounter;
    cssOverscrollBehaviorInline: GleanCounter;
    cssOverscrollBehaviorX: GleanCounter;
    cssOverscrollBehaviorY: GleanCounter;
    cssFloodOpacity: GleanCounter;
    cssMozWindowOpacity: GleanCounter;
    cssOpacity: GleanCounter;
    cssShapeImageThreshold: GleanCounter;
    cssStopOpacity: GleanCounter;
    cssBorderBlockEndStyle: GleanCounter;
    cssBorderBlockStartStyle: GleanCounter;
    cssBorderBottomStyle: GleanCounter;
    cssBorderInlineEndStyle: GleanCounter;
    cssBorderInlineStartStyle: GleanCounter;
    cssBorderLeftStyle: GleanCounter;
    cssBorderRightStyle: GleanCounter;
    cssBorderTopStyle: GleanCounter;
    cssColumnRuleStyle: GleanCounter;
    cssAccentColor: GleanCounter;
    cssAnchorName: GleanCounter;
    cssAnchorScope: GleanCounter;
    cssAnimationComposition: GleanCounter;
    cssAnimationDelay: GleanCounter;
    cssAnimationDirection: GleanCounter;
    cssAnimationDuration: GleanCounter;
    cssAnimationFillMode: GleanCounter;
    cssAnimationIterationCount: GleanCounter;
    cssAnimationName: GleanCounter;
    cssAnimationPlayState: GleanCounter;
    cssAnimationTimeline: GleanCounter;
    cssAnimationTimingFunction: GleanCounter;
    cssBackdropFilter: GleanCounter;
    cssBackgroundAttachment: GleanCounter;
    cssBackgroundBlendMode: GleanCounter;
    cssBackgroundClip: GleanCounter;
    cssBackgroundImage: GleanCounter;
    cssBackgroundOrigin: GleanCounter;
    cssBackgroundPositionX: GleanCounter;
    cssBackgroundPositionY: GleanCounter;
    cssBackgroundRepeat: GleanCounter;
    cssBackgroundSize: GleanCounter;
    cssBorderImageOutset: GleanCounter;
    cssBorderImageSlice: GleanCounter;
    cssBorderImageWidth: GleanCounter;
    cssBorderSpacing: GleanCounter;
    cssBoxShadow: GleanCounter;
    cssCaretColor: GleanCounter;
    cssClip: GleanCounter;
    cssClipPath: GleanCounter;
    cssColor: GleanCounter;
    cssColorScheme: GleanCounter;
    cssColumnWidth: GleanCounter;
    cssContainerName: GleanCounter;
    cssContent: GleanCounter;
    cssCounterIncrement: GleanCounter;
    cssCounterReset: GleanCounter;
    cssCounterSet: GleanCounter;
    cssCursor: GleanCounter;
    cssD: GleanCounter;
    cssFilter: GleanCounter;
    cssFlexBasis: GleanCounter;
    cssFontFamily: GleanCounter;
    cssFontFeatureSettings: GleanCounter;
    cssFontPalette: GleanCounter;
    cssFontSize: GleanCounter;
    cssFontVariantAlternates: GleanCounter;
    cssFontVariationSettings: GleanCounter;
    cssGridTemplateAreas: GleanCounter;
    cssHyphenateCharacter: GleanCounter;
    cssHyphenateLimitChars: GleanCounter;
    cssLetterSpacing: GleanCounter;
    cssLineHeight: GleanCounter;
    cssListStyleType: GleanCounter;
    cssMaskClip: GleanCounter;
    cssMaskComposite: GleanCounter;
    cssMaskImage: GleanCounter;
    cssMaskMode: GleanCounter;
    cssMaskOrigin: GleanCounter;
    cssMaskPositionX: GleanCounter;
    cssMaskPositionY: GleanCounter;
    cssMaskRepeat: GleanCounter;
    cssMaskSize: GleanCounter;
    cssMozContextProperties: GleanCounter;
    cssOffsetAnchor: GleanCounter;
    cssOffsetPath: GleanCounter;
    cssOffsetPosition: GleanCounter;
    cssPage: GleanCounter;
    cssPerspective: GleanCounter;
    cssPositionAnchor: GleanCounter;
    cssPositionTryFallbacks: GleanCounter;
    cssQuotes: GleanCounter;
    cssRotate: GleanCounter;
    cssScale: GleanCounter;
    cssScrollTimelineAxis: GleanCounter;
    cssScrollTimelineName: GleanCounter;
    cssScrollbarColor: GleanCounter;
    cssShapeOutside: GleanCounter;
    cssSize: GleanCounter;
    cssStrokeDasharray: GleanCounter;
    cssStrokeDashoffset: GleanCounter;
    cssStrokeWidth: GleanCounter;
    cssTabSize: GleanCounter;
    cssTextDecorationThickness: GleanCounter;
    cssTextEmphasisStyle: GleanCounter;
    cssTextIndent: GleanCounter;
    cssTextOverflow: GleanCounter;
    cssTextShadow: GleanCounter;
    cssTextUnderlineOffset: GleanCounter;
    cssTransformOrigin: GleanCounter;
    cssTransitionBehavior: GleanCounter;
    cssTransitionDelay: GleanCounter;
    cssTransitionDuration: GleanCounter;
    cssTransitionProperty: GleanCounter;
    cssTransitionTimingFunction: GleanCounter;
    cssTranslate: GleanCounter;
    cssVerticalAlign: GleanCounter;
    cssViewTimelineAxis: GleanCounter;
    cssViewTimelineInset: GleanCounter;
    cssViewTimelineName: GleanCounter;
    cssViewTransitionClass: GleanCounter;
    cssViewTransitionName: GleanCounter;
    cssWebkitTextStrokeWidth: GleanCounter;
    cssWillChange: GleanCounter;
    cssWordSpacing: GleanCounter;
    cssXLang: GleanCounter;
    cssObjectPosition: GleanCounter;
    cssPerspectiveOrigin: GleanCounter;
    cssFill: GleanCounter;
    cssStroke: GleanCounter;
    cssGridTemplateColumns: GleanCounter;
    cssGridTemplateRows: GleanCounter;
    cssBorderImageSource: GleanCounter;
    cssListStyleImage: GleanCounter;
    cssGridAutoColumns: GleanCounter;
    cssGridAutoRows: GleanCounter;
    cssMozWindowTransform: GleanCounter;
    cssTransform: GleanCounter;
    cssColumnGap: GleanCounter;
    cssRowGap: GleanCounter;
    cssMarkerEnd: GleanCounter;
    cssMarkerMid: GleanCounter;
    cssMarkerStart: GleanCounter;
    cssContainIntrinsicBlockSize: GleanCounter;
    cssContainIntrinsicHeight: GleanCounter;
    cssContainIntrinsicInlineSize: GleanCounter;
    cssContainIntrinsicWidth: GleanCounter;
    cssGridColumnEnd: GleanCounter;
    cssGridColumnStart: GleanCounter;
    cssGridRowEnd: GleanCounter;
    cssGridRowStart: GleanCounter;
    cssMaxBlockSize: GleanCounter;
    cssMaxHeight: GleanCounter;
    cssMaxInlineSize: GleanCounter;
    cssMaxWidth: GleanCounter;
    cssCx: GleanCounter;
    cssCy: GleanCounter;
    cssOffsetDistance: GleanCounter;
    cssX: GleanCounter;
    cssY: GleanCounter;
    cssBorderBottomLeftRadius: GleanCounter;
    cssBorderBottomRightRadius: GleanCounter;
    cssBorderEndEndRadius: GleanCounter;
    cssBorderEndStartRadius: GleanCounter;
    cssBorderStartEndRadius: GleanCounter;
    cssBorderStartStartRadius: GleanCounter;
    cssBorderTopLeftRadius: GleanCounter;
    cssBorderTopRightRadius: GleanCounter;
    cssBottom: GleanCounter;
    cssInsetBlockEnd: GleanCounter;
    cssInsetBlockStart: GleanCounter;
    cssInsetInlineEnd: GleanCounter;
    cssInsetInlineStart: GleanCounter;
    cssLeft: GleanCounter;
    cssRight: GleanCounter;
    cssTop: GleanCounter;
    cssMarginBlockEnd: GleanCounter;
    cssMarginBlockStart: GleanCounter;
    cssMarginBottom: GleanCounter;
    cssMarginInlineEnd: GleanCounter;
    cssMarginInlineStart: GleanCounter;
    cssMarginLeft: GleanCounter;
    cssMarginRight: GleanCounter;
    cssMarginTop: GleanCounter;
    cssBlockSize: GleanCounter;
    cssHeight: GleanCounter;
    cssInlineSize: GleanCounter;
    cssMinBlockSize: GleanCounter;
    cssMinHeight: GleanCounter;
    cssMinInlineSize: GleanCounter;
    cssMinWidth: GleanCounter;
    cssWidth: GleanCounter;
    cssBorderBlockEndWidth: GleanCounter;
    cssBorderBlockStartWidth: GleanCounter;
    cssBorderBottomWidth: GleanCounter;
    cssBorderInlineEndWidth: GleanCounter;
    cssBorderInlineStartWidth: GleanCounter;
    cssBorderLeftWidth: GleanCounter;
    cssBorderRightWidth: GleanCounter;
    cssBorderTopWidth: GleanCounter;
    cssColumnRuleWidth: GleanCounter;
    cssOutlineWidth: GleanCounter;
    cssPaddingBlockEnd: GleanCounter;
    cssPaddingBlockStart: GleanCounter;
    cssPaddingBottom: GleanCounter;
    cssPaddingInlineEnd: GleanCounter;
    cssPaddingInlineStart: GleanCounter;
    cssPaddingLeft: GleanCounter;
    cssPaddingRight: GleanCounter;
    cssPaddingTop: GleanCounter;
    cssR: GleanCounter;
    cssShapeMargin: GleanCounter;
    cssRx: GleanCounter;
    cssRy: GleanCounter;
    cssScrollPaddingBlockEnd: GleanCounter;
    cssScrollPaddingBlockStart: GleanCounter;
    cssScrollPaddingBottom: GleanCounter;
    cssScrollPaddingInlineEnd: GleanCounter;
    cssScrollPaddingInlineStart: GleanCounter;
    cssScrollPaddingLeft: GleanCounter;
    cssScrollPaddingRight: GleanCounter;
    cssScrollPaddingTop: GleanCounter;
    cssMozWindowInputRegionMargin: GleanCounter;
    cssOutlineOffset: GleanCounter;
    cssOverflowClipMargin: GleanCounter;
    cssScrollMarginBlockEnd: GleanCounter;
    cssScrollMarginBlockStart: GleanCounter;
    cssScrollMarginBottom: GleanCounter;
    cssScrollMarginInlineEnd: GleanCounter;
    cssScrollMarginInlineStart: GleanCounter;
    cssScrollMarginLeft: GleanCounter;
    cssScrollMarginRight: GleanCounter;
    cssScrollMarginTop: GleanCounter;
    cssBackgroundColor: GleanCounter;
    cssBorderBlockEndColor: GleanCounter;
    cssBorderBlockStartColor: GleanCounter;
    cssBorderBottomColor: GleanCounter;
    cssBorderInlineEndColor: GleanCounter;
    cssBorderInlineStartColor: GleanCounter;
    cssBorderLeftColor: GleanCounter;
    cssBorderRightColor: GleanCounter;
    cssBorderTopColor: GleanCounter;
    cssColumnRuleColor: GleanCounter;
    cssFloodColor: GleanCounter;
    cssLightingColor: GleanCounter;
    cssOutlineColor: GleanCounter;
    cssStopColor: GleanCounter;
    cssTextDecorationColor: GleanCounter;
    cssTextEmphasisColor: GleanCounter;
    cssWebkitTextFillColor: GleanCounter;
    cssWebkitTextStrokeColor: GleanCounter;
    cssBackground: GleanCounter;
    cssBackgroundPosition: GleanCounter;
    cssBorderColor: GleanCounter;
    cssBorderStyle: GleanCounter;
    cssBorderWidth: GleanCounter;
    cssBorderTop: GleanCounter;
    cssBorderRight: GleanCounter;
    cssBorderBottom: GleanCounter;
    cssBorderLeft: GleanCounter;
    cssBorderBlockStart: GleanCounter;
    cssBorderBlockEnd: GleanCounter;
    cssBorderInlineStart: GleanCounter;
    cssBorderInlineEnd: GleanCounter;
    cssBorder: GleanCounter;
    cssBorderRadius: GleanCounter;
    cssBorderImage: GleanCounter;
    cssBorderBlockWidth: GleanCounter;
    cssBorderBlockStyle: GleanCounter;
    cssBorderBlockColor: GleanCounter;
    cssBorderInlineWidth: GleanCounter;
    cssBorderInlineStyle: GleanCounter;
    cssBorderInlineColor: GleanCounter;
    cssBorderBlock: GleanCounter;
    cssBorderInline: GleanCounter;
    cssOverflow: GleanCounter;
    cssOverflowClipBox: GleanCounter;
    cssOverscrollBehavior: GleanCounter;
    cssContainer: GleanCounter;
    cssPageBreakBefore: GleanCounter;
    cssPageBreakAfter: GleanCounter;
    cssPageBreakInside: GleanCounter;
    cssOffset: GleanCounter;
    cssColumns: GleanCounter;
    cssColumnRule: GleanCounter;
    cssFont: GleanCounter;
    cssFontVariant: GleanCounter;
    cssFontSynthesis: GleanCounter;
    cssMarker: GleanCounter;
    cssTextEmphasis: GleanCounter;
    cssTextWrap: GleanCounter;
    cssWhiteSpace: GleanCounter;
    cssWebkitTextStroke: GleanCounter;
    cssListStyle: GleanCounter;
    cssMargin: GleanCounter;
    cssMarginBlock: GleanCounter;
    cssMarginInline: GleanCounter;
    cssScrollMargin: GleanCounter;
    cssScrollMarginBlock: GleanCounter;
    cssScrollMarginInline: GleanCounter;
    cssOutline: GleanCounter;
    cssPadding: GleanCounter;
    cssPaddingBlock: GleanCounter;
    cssPaddingInline: GleanCounter;
    cssScrollPadding: GleanCounter;
    cssScrollPaddingBlock: GleanCounter;
    cssScrollPaddingInline: GleanCounter;
    cssFlexFlow: GleanCounter;
    cssFlex: GleanCounter;
    cssGap: GleanCounter;
    cssGridRow: GleanCounter;
    cssGridColumn: GleanCounter;
    cssGridArea: GleanCounter;
    cssGridTemplate: GleanCounter;
    cssGrid: GleanCounter;
    cssPlaceContent: GleanCounter;
    cssPlaceSelf: GleanCounter;
    cssPlaceItems: GleanCounter;
    cssPositionTry: GleanCounter;
    cssInset: GleanCounter;
    cssInsetBlock: GleanCounter;
    cssInsetInline: GleanCounter;
    cssContainIntrinsicSize: GleanCounter;
    cssMask: GleanCounter;
    cssMaskPosition: GleanCounter;
    cssTextDecoration: GleanCounter;
    cssTransition: GleanCounter;
    cssAnimation: GleanCounter;
    cssScrollTimeline: GleanCounter;
    cssViewTimeline: GleanCounter;
    cssAll: GleanCounter;
    cssWebkitBackgroundClip: GleanCounter;
    cssWebkitBackgroundOrigin: GleanCounter;
    cssWebkitBackgroundSize: GleanCounter;
    cssMozBorderStartColor: GleanCounter;
    cssMozBorderStartStyle: GleanCounter;
    cssMozBorderStartWidth: GleanCounter;
    cssMozBorderEndColor: GleanCounter;
    cssMozBorderEndStyle: GleanCounter;
    cssMozBorderEndWidth: GleanCounter;
    cssWebkitBorderTopLeftRadius: GleanCounter;
    cssWebkitBorderTopRightRadius: GleanCounter;
    cssWebkitBorderBottomRightRadius: GleanCounter;
    cssWebkitBorderBottomLeftRadius: GleanCounter;
    cssMozTransform: GleanCounter;
    cssWebkitTransform: GleanCounter;
    cssMozPerspective: GleanCounter;
    cssWebkitPerspective: GleanCounter;
    cssMozPerspectiveOrigin: GleanCounter;
    cssWebkitPerspectiveOrigin: GleanCounter;
    cssMozBackfaceVisibility: GleanCounter;
    cssWebkitBackfaceVisibility: GleanCounter;
    cssMozTransformStyle: GleanCounter;
    cssWebkitTransformStyle: GleanCounter;
    cssMozTransformOrigin: GleanCounter;
    cssWebkitTransformOrigin: GleanCounter;
    cssMozAppearance: GleanCounter;
    cssWebkitAppearance: GleanCounter;
    cssWebkitBoxShadow: GleanCounter;
    cssWebkitFilter: GleanCounter;
    cssMozFontFeatureSettings: GleanCounter;
    cssWebkitFontFeatureSettings: GleanCounter;
    cssMozFontLanguageOverride: GleanCounter;
    cssWebkitFontSmoothing: GleanCounter;
    cssColorAdjust: GleanCounter;
    cssMozHyphens: GleanCounter;
    cssWebkitTextSizeAdjust: GleanCounter;
    cssWordWrap: GleanCounter;
    cssMozTabSize: GleanCounter;
    cssMozMarginStart: GleanCounter;
    cssMozMarginEnd: GleanCounter;
    cssMozPaddingStart: GleanCounter;
    cssMozPaddingEnd: GleanCounter;
    cssWebkitFlexDirection: GleanCounter;
    cssWebkitFlexWrap: GleanCounter;
    cssWebkitJustifyContent: GleanCounter;
    cssWebkitAlignContent: GleanCounter;
    cssWebkitAlignItems: GleanCounter;
    cssWebkitFlexGrow: GleanCounter;
    cssWebkitFlexShrink: GleanCounter;
    cssWebkitAlignSelf: GleanCounter;
    cssWebkitOrder: GleanCounter;
    cssWebkitFlexBasis: GleanCounter;
    cssMozBoxSizing: GleanCounter;
    cssWebkitBoxSizing: GleanCounter;
    cssGridColumnGap: GleanCounter;
    cssGridRowGap: GleanCounter;
    cssWebkitClipPath: GleanCounter;
    cssWebkitMaskRepeat: GleanCounter;
    cssWebkitMaskPositionX: GleanCounter;
    cssWebkitMaskPositionY: GleanCounter;
    cssWebkitMaskClip: GleanCounter;
    cssWebkitMaskOrigin: GleanCounter;
    cssWebkitMaskSize: GleanCounter;
    cssWebkitMaskComposite: GleanCounter;
    cssWebkitMaskImage: GleanCounter;
    cssMozUserSelect: GleanCounter;
    cssWebkitUserSelect: GleanCounter;
    cssMozTransitionDuration: GleanCounter;
    cssWebkitTransitionDuration: GleanCounter;
    cssMozTransitionTimingFunction: GleanCounter;
    cssWebkitTransitionTimingFunction: GleanCounter;
    cssMozTransitionProperty: GleanCounter;
    cssWebkitTransitionProperty: GleanCounter;
    cssMozTransitionDelay: GleanCounter;
    cssWebkitTransitionDelay: GleanCounter;
    cssMozAnimationName: GleanCounter;
    cssWebkitAnimationName: GleanCounter;
    cssMozAnimationDuration: GleanCounter;
    cssWebkitAnimationDuration: GleanCounter;
    cssMozAnimationTimingFunction: GleanCounter;
    cssWebkitAnimationTimingFunction: GleanCounter;
    cssMozAnimationIterationCount: GleanCounter;
    cssWebkitAnimationIterationCount: GleanCounter;
    cssMozAnimationDirection: GleanCounter;
    cssWebkitAnimationDirection: GleanCounter;
    cssMozAnimationPlayState: GleanCounter;
    cssWebkitAnimationPlayState: GleanCounter;
    cssMozAnimationFillMode: GleanCounter;
    cssWebkitAnimationFillMode: GleanCounter;
    cssMozAnimationDelay: GleanCounter;
    cssWebkitAnimationDelay: GleanCounter;
    cssWebkitBoxAlign: GleanCounter;
    cssWebkitBoxDirection: GleanCounter;
    cssWebkitBoxFlex: GleanCounter;
    cssWebkitBoxOrient: GleanCounter;
    cssWebkitBoxPack: GleanCounter;
    cssWebkitBoxOrdinalGroup: GleanCounter;
    cssMozBorderStart: GleanCounter;
    cssMozBorderEnd: GleanCounter;
    cssWebkitBorderRadius: GleanCounter;
    cssMozBorderImage: GleanCounter;
    cssWebkitBorderImage: GleanCounter;
    cssWebkitFlexFlow: GleanCounter;
    cssWebkitFlex: GleanCounter;
    cssGridGap: GleanCounter;
    cssWebkitMask: GleanCounter;
    cssWebkitMaskPosition: GleanCounter;
    cssMozTransition: GleanCounter;
    cssWebkitTransition: GleanCounter;
    cssMozAnimation: GleanCounter;
    cssWebkitAnimation: GleanCounter;
    webkitTapHighlightColor: GleanCounter;
    speak: GleanCounter;
    textSizeAdjust: GleanCounter;
    webkitUserDrag: GleanCounter;
    orphans: GleanCounter;
    widows: GleanCounter;
    webkitUserModify: GleanCounter;
    webkitMarginBefore: GleanCounter;
    webkitMarginAfter: GleanCounter;
    webkitMarginStart: GleanCounter;
    webkitColumnBreakInside: GleanCounter;
    webkitPaddingStart: GleanCounter;
    webkitMarginEnd: GleanCounter;
    webkitBoxReflect: GleanCounter;
    webkitPrintColorAdjust: GleanCounter;
    webkitMaskBoxImage: GleanCounter;
    webkitLineBreak: GleanCounter;
    alignmentBaseline: GleanCounter;
    webkitWritingMode: GleanCounter;
    baselineShift: GleanCounter;
    webkitHyphenateCharacter: GleanCounter;
    webkitHighlight: GleanCounter;
    backgroundRepeatX: GleanCounter;
    webkitPaddingEnd: GleanCounter;
    backgroundRepeatY: GleanCounter;
    webkitTextEmphasisColor: GleanCounter;
    webkitMarginTopCollapse: GleanCounter;
    webkitRtlOrdering: GleanCounter;
    webkitPaddingBefore: GleanCounter;
    webkitTextDecorationsInEffect: GleanCounter;
    webkitBorderVerticalSpacing: GleanCounter;
    webkitLocale: GleanCounter;
    webkitPaddingAfter: GleanCounter;
    webkitBorderHorizontalSpacing: GleanCounter;
    colorRendering: GleanCounter;
    webkitColumnBreakBefore: GleanCounter;
    webkitTransformOriginX: GleanCounter;
    webkitTransformOriginY: GleanCounter;
    webkitTextEmphasisPosition: GleanCounter;
    bufferedRendering: GleanCounter;
    webkitTextOrientation: GleanCounter;
    webkitTextCombine: GleanCounter;
    webkitTextEmphasisStyle: GleanCounter;
    webkitTextEmphasis: GleanCounter;
    webkitMaskBoxImageWidth: GleanCounter;
    webkitMaskBoxImageSource: GleanCounter;
    webkitMaskBoxImageOutset: GleanCounter;
    webkitMaskBoxImageSlice: GleanCounter;
    webkitMaskBoxImageRepeat: GleanCounter;
    webkitMarginAfterCollapse: GleanCounter;
    webkitBorderBeforeColor: GleanCounter;
    webkitBorderBeforeWidth: GleanCounter;
    webkitPerspectiveOriginX: GleanCounter;
    webkitPerspectiveOriginY: GleanCounter;
    webkitMarginBeforeCollapse: GleanCounter;
    webkitBorderBeforeStyle: GleanCounter;
    webkitMarginBottomCollapse: GleanCounter;
    webkitRubyPosition: GleanCounter;
    webkitColumnBreakAfter: GleanCounter;
    webkitMarginCollapse: GleanCounter;
    webkitBorderBefore: GleanCounter;
    webkitBorderEnd: GleanCounter;
    webkitBorderAfter: GleanCounter;
    webkitBorderStart: GleanCounter;
    webkitMinLogicalWidth: GleanCounter;
    webkitLogicalHeight: GleanCounter;
    webkitTransformOriginZ: GleanCounter;
    webkitFontSizeDelta: GleanCounter;
    webkitLogicalWidth: GleanCounter;
    webkitMaxLogicalWidth: GleanCounter;
    webkitMinLogicalHeight: GleanCounter;
    webkitMaxLogicalHeight: GleanCounter;
    webkitBorderEndColor: GleanCounter;
    webkitBorderEndWidth: GleanCounter;
    webkitBorderStartColor: GleanCounter;
    webkitBorderStartWidth: GleanCounter;
    webkitBorderAfterColor: GleanCounter;
    webkitBorderAfterWidth: GleanCounter;
    webkitBorderEndStyle: GleanCounter;
    webkitBorderAfterStyle: GleanCounter;
    webkitBorderStartStyle: GleanCounter;
    webkitMaskRepeatX: GleanCounter;
    webkitMaskRepeatY: GleanCounter;
    userZoom: GleanCounter;
    minZoom: GleanCounter;
    webkitBoxDecorationBreak: GleanCounter;
    orientation: GleanCounter;
    maxZoom: GleanCounter;
    webkitAppRegion: GleanCounter;
    webkitColumnRule: GleanCounter;
    webkitColumnSpan: GleanCounter;
    webkitColumnGap: GleanCounter;
    webkitShapeOutside: GleanCounter;
    webkitColumnRuleWidth: GleanCounter;
    webkitColumnCount: GleanCounter;
    webkitOpacity: GleanCounter;
    webkitColumnWidth: GleanCounter;
    webkitShapeImageThreshold: GleanCounter;
    webkitColumnRuleStyle: GleanCounter;
    webkitColumns: GleanCounter;
    webkitColumnRuleColor: GleanCounter;
    webkitShapeMargin: GleanCounter;
  }

  useCounterCssDoc: {
    cssAlignContent: GleanCounter;
    cssAlignItems: GleanCounter;
    cssAlignSelf: GleanCounter;
    cssAspectRatio: GleanCounter;
    cssBackfaceVisibility: GleanCounter;
    cssBaselineSource: GleanCounter;
    cssBorderCollapse: GleanCounter;
    cssBorderImageRepeat: GleanCounter;
    cssBoxDecorationBreak: GleanCounter;
    cssBoxSizing: GleanCounter;
    cssBreakInside: GleanCounter;
    cssCaptionSide: GleanCounter;
    cssClear: GleanCounter;
    cssColorInterpolation: GleanCounter;
    cssColorInterpolationFilters: GleanCounter;
    cssColumnCount: GleanCounter;
    cssColumnFill: GleanCounter;
    cssColumnSpan: GleanCounter;
    cssContain: GleanCounter;
    cssContainerType: GleanCounter;
    cssContentVisibility: GleanCounter;
    cssDirection: GleanCounter;
    cssDisplay: GleanCounter;
    cssDominantBaseline: GleanCounter;
    cssEmptyCells: GleanCounter;
    cssFieldSizing: GleanCounter;
    cssFlexDirection: GleanCounter;
    cssFlexWrap: GleanCounter;
    cssFloat: GleanCounter;
    cssFontKerning: GleanCounter;
    cssFontLanguageOverride: GleanCounter;
    cssFontOpticalSizing: GleanCounter;
    cssFontSizeAdjust: GleanCounter;
    cssFontStretch: GleanCounter;
    cssFontStyle: GleanCounter;
    cssFontSynthesisStyle: GleanCounter;
    cssFontVariantCaps: GleanCounter;
    cssFontVariantEastAsian: GleanCounter;
    cssFontVariantEmoji: GleanCounter;
    cssFontVariantLigatures: GleanCounter;
    cssFontVariantNumeric: GleanCounter;
    cssFontVariantPosition: GleanCounter;
    cssFontWeight: GleanCounter;
    cssForcedColorAdjust: GleanCounter;
    cssGridAutoFlow: GleanCounter;
    cssHyphens: GleanCounter;
    cssImageOrientation: GleanCounter;
    cssImageRendering: GleanCounter;
    cssImeMode: GleanCounter;
    cssInitialLetter: GleanCounter;
    cssIsolation: GleanCounter;
    cssJustifyContent: GleanCounter;
    cssJustifyItems: GleanCounter;
    cssJustifySelf: GleanCounter;
    cssLineBreak: GleanCounter;
    cssListStylePosition: GleanCounter;
    cssMaskType: GleanCounter;
    cssMasonryAutoFlow: GleanCounter;
    cssMathDepth: GleanCounter;
    cssMathStyle: GleanCounter;
    cssMixBlendMode: GleanCounter;
    cssMozBoxAlign: GleanCounter;
    cssMozBoxCollapse: GleanCounter;
    cssMozBoxDirection: GleanCounter;
    cssMozBoxOrient: GleanCounter;
    cssMozBoxPack: GleanCounter;
    cssMozControlCharacterVisibility: GleanCounter;
    cssMozFloatEdge: GleanCounter;
    cssMozInert: GleanCounter;
    cssMozMathVariant: GleanCounter;
    cssMozMinFontSizeRatio: GleanCounter;
    cssMozOrient: GleanCounter;
    cssMozOsxFontSmoothing: GleanCounter;
    cssMozTextSizeAdjust: GleanCounter;
    cssMozTheme: GleanCounter;
    cssMozTopLayer: GleanCounter;
    cssMozUserFocus: GleanCounter;
    cssMozUserInput: GleanCounter;
    cssMozWindowDragging: GleanCounter;
    cssMozWindowShadow: GleanCounter;
    cssObjectFit: GleanCounter;
    cssOffsetRotate: GleanCounter;
    cssOutlineStyle: GleanCounter;
    cssOverflowAnchor: GleanCounter;
    cssOverflowWrap: GleanCounter;
    cssPageOrientation: GleanCounter;
    cssPaintOrder: GleanCounter;
    cssPointerEvents: GleanCounter;
    cssPosition: GleanCounter;
    cssPositionArea: GleanCounter;
    cssPositionTryOrder: GleanCounter;
    cssPositionVisibility: GleanCounter;
    cssPrintColorAdjust: GleanCounter;
    cssResize: GleanCounter;
    cssRubyAlign: GleanCounter;
    cssRubyPosition: GleanCounter;
    cssScrollBehavior: GleanCounter;
    cssScrollSnapAlign: GleanCounter;
    cssScrollSnapStop: GleanCounter;
    cssScrollSnapType: GleanCounter;
    cssScrollbarGutter: GleanCounter;
    cssScrollbarWidth: GleanCounter;
    cssShapeRendering: GleanCounter;
    cssStrokeLinecap: GleanCounter;
    cssStrokeLinejoin: GleanCounter;
    cssTableLayout: GleanCounter;
    cssTextAlign: GleanCounter;
    cssTextAlignLast: GleanCounter;
    cssTextAnchor: GleanCounter;
    cssTextCombineUpright: GleanCounter;
    cssTextDecorationLine: GleanCounter;
    cssTextDecorationSkipInk: GleanCounter;
    cssTextDecorationStyle: GleanCounter;
    cssTextEmphasisPosition: GleanCounter;
    cssTextJustify: GleanCounter;
    cssTextOrientation: GleanCounter;
    cssTextRendering: GleanCounter;
    cssTextTransform: GleanCounter;
    cssTextUnderlinePosition: GleanCounter;
    cssTextWrapMode: GleanCounter;
    cssTextWrapStyle: GleanCounter;
    cssTouchAction: GleanCounter;
    cssTransformBox: GleanCounter;
    cssTransformStyle: GleanCounter;
    cssUnicodeBidi: GleanCounter;
    cssUserSelect: GleanCounter;
    cssVectorEffect: GleanCounter;
    cssVisibility: GleanCounter;
    cssWebkitLineClamp: GleanCounter;
    cssWebkitTextSecurity: GleanCounter;
    cssWhiteSpaceCollapse: GleanCounter;
    cssWordBreak: GleanCounter;
    cssWritingMode: GleanCounter;
    cssXTextScale: GleanCounter;
    cssZIndex: GleanCounter;
    cssZoom: GleanCounter;
    cssAppearance: GleanCounter;
    cssMozDefaultAppearance: GleanCounter;
    cssMozForceBrokenImageIcon: GleanCounter;
    cssMozSubtreeHiddenOnlyVisually: GleanCounter;
    cssBreakAfter: GleanCounter;
    cssBreakBefore: GleanCounter;
    cssClipRule: GleanCounter;
    cssFillRule: GleanCounter;
    cssOverflowClipBoxBlock: GleanCounter;
    cssOverflowClipBoxInline: GleanCounter;
    cssFillOpacity: GleanCounter;
    cssStrokeOpacity: GleanCounter;
    cssFontSynthesisPosition: GleanCounter;
    cssFontSynthesisSmallCaps: GleanCounter;
    cssFontSynthesisWeight: GleanCounter;
    cssMozBoxOrdinalGroup: GleanCounter;
    cssOrder: GleanCounter;
    cssXSpan: GleanCounter;
    cssFlexGrow: GleanCounter;
    cssFlexShrink: GleanCounter;
    cssMozBoxFlex: GleanCounter;
    cssStrokeMiterlimit: GleanCounter;
    cssOverflowBlock: GleanCounter;
    cssOverflowInline: GleanCounter;
    cssOverflowX: GleanCounter;
    cssOverflowY: GleanCounter;
    cssOverscrollBehaviorBlock: GleanCounter;
    cssOverscrollBehaviorInline: GleanCounter;
    cssOverscrollBehaviorX: GleanCounter;
    cssOverscrollBehaviorY: GleanCounter;
    cssFloodOpacity: GleanCounter;
    cssMozWindowOpacity: GleanCounter;
    cssOpacity: GleanCounter;
    cssShapeImageThreshold: GleanCounter;
    cssStopOpacity: GleanCounter;
    cssBorderBlockEndStyle: GleanCounter;
    cssBorderBlockStartStyle: GleanCounter;
    cssBorderBottomStyle: GleanCounter;
    cssBorderInlineEndStyle: GleanCounter;
    cssBorderInlineStartStyle: GleanCounter;
    cssBorderLeftStyle: GleanCounter;
    cssBorderRightStyle: GleanCounter;
    cssBorderTopStyle: GleanCounter;
    cssColumnRuleStyle: GleanCounter;
    cssAccentColor: GleanCounter;
    cssAnchorName: GleanCounter;
    cssAnchorScope: GleanCounter;
    cssAnimationComposition: GleanCounter;
    cssAnimationDelay: GleanCounter;
    cssAnimationDirection: GleanCounter;
    cssAnimationDuration: GleanCounter;
    cssAnimationFillMode: GleanCounter;
    cssAnimationIterationCount: GleanCounter;
    cssAnimationName: GleanCounter;
    cssAnimationPlayState: GleanCounter;
    cssAnimationTimeline: GleanCounter;
    cssAnimationTimingFunction: GleanCounter;
    cssBackdropFilter: GleanCounter;
    cssBackgroundAttachment: GleanCounter;
    cssBackgroundBlendMode: GleanCounter;
    cssBackgroundClip: GleanCounter;
    cssBackgroundImage: GleanCounter;
    cssBackgroundOrigin: GleanCounter;
    cssBackgroundPositionX: GleanCounter;
    cssBackgroundPositionY: GleanCounter;
    cssBackgroundRepeat: GleanCounter;
    cssBackgroundSize: GleanCounter;
    cssBorderImageOutset: GleanCounter;
    cssBorderImageSlice: GleanCounter;
    cssBorderImageWidth: GleanCounter;
    cssBorderSpacing: GleanCounter;
    cssBoxShadow: GleanCounter;
    cssCaretColor: GleanCounter;
    cssClip: GleanCounter;
    cssClipPath: GleanCounter;
    cssColor: GleanCounter;
    cssColorScheme: GleanCounter;
    cssColumnWidth: GleanCounter;
    cssContainerName: GleanCounter;
    cssContent: GleanCounter;
    cssCounterIncrement: GleanCounter;
    cssCounterReset: GleanCounter;
    cssCounterSet: GleanCounter;
    cssCursor: GleanCounter;
    cssD: GleanCounter;
    cssFilter: GleanCounter;
    cssFlexBasis: GleanCounter;
    cssFontFamily: GleanCounter;
    cssFontFeatureSettings: GleanCounter;
    cssFontPalette: GleanCounter;
    cssFontSize: GleanCounter;
    cssFontVariantAlternates: GleanCounter;
    cssFontVariationSettings: GleanCounter;
    cssGridTemplateAreas: GleanCounter;
    cssHyphenateCharacter: GleanCounter;
    cssHyphenateLimitChars: GleanCounter;
    cssLetterSpacing: GleanCounter;
    cssLineHeight: GleanCounter;
    cssListStyleType: GleanCounter;
    cssMaskClip: GleanCounter;
    cssMaskComposite: GleanCounter;
    cssMaskImage: GleanCounter;
    cssMaskMode: GleanCounter;
    cssMaskOrigin: GleanCounter;
    cssMaskPositionX: GleanCounter;
    cssMaskPositionY: GleanCounter;
    cssMaskRepeat: GleanCounter;
    cssMaskSize: GleanCounter;
    cssMozContextProperties: GleanCounter;
    cssOffsetAnchor: GleanCounter;
    cssOffsetPath: GleanCounter;
    cssOffsetPosition: GleanCounter;
    cssPage: GleanCounter;
    cssPerspective: GleanCounter;
    cssPositionAnchor: GleanCounter;
    cssPositionTryFallbacks: GleanCounter;
    cssQuotes: GleanCounter;
    cssRotate: GleanCounter;
    cssScale: GleanCounter;
    cssScrollTimelineAxis: GleanCounter;
    cssScrollTimelineName: GleanCounter;
    cssScrollbarColor: GleanCounter;
    cssShapeOutside: GleanCounter;
    cssSize: GleanCounter;
    cssStrokeDasharray: GleanCounter;
    cssStrokeDashoffset: GleanCounter;
    cssStrokeWidth: GleanCounter;
    cssTabSize: GleanCounter;
    cssTextDecorationThickness: GleanCounter;
    cssTextEmphasisStyle: GleanCounter;
    cssTextIndent: GleanCounter;
    cssTextOverflow: GleanCounter;
    cssTextShadow: GleanCounter;
    cssTextUnderlineOffset: GleanCounter;
    cssTransformOrigin: GleanCounter;
    cssTransitionBehavior: GleanCounter;
    cssTransitionDelay: GleanCounter;
    cssTransitionDuration: GleanCounter;
    cssTransitionProperty: GleanCounter;
    cssTransitionTimingFunction: GleanCounter;
    cssTranslate: GleanCounter;
    cssVerticalAlign: GleanCounter;
    cssViewTimelineAxis: GleanCounter;
    cssViewTimelineInset: GleanCounter;
    cssViewTimelineName: GleanCounter;
    cssViewTransitionClass: GleanCounter;
    cssViewTransitionName: GleanCounter;
    cssWebkitTextStrokeWidth: GleanCounter;
    cssWillChange: GleanCounter;
    cssWordSpacing: GleanCounter;
    cssXLang: GleanCounter;
    cssObjectPosition: GleanCounter;
    cssPerspectiveOrigin: GleanCounter;
    cssFill: GleanCounter;
    cssStroke: GleanCounter;
    cssGridTemplateColumns: GleanCounter;
    cssGridTemplateRows: GleanCounter;
    cssBorderImageSource: GleanCounter;
    cssListStyleImage: GleanCounter;
    cssGridAutoColumns: GleanCounter;
    cssGridAutoRows: GleanCounter;
    cssMozWindowTransform: GleanCounter;
    cssTransform: GleanCounter;
    cssColumnGap: GleanCounter;
    cssRowGap: GleanCounter;
    cssMarkerEnd: GleanCounter;
    cssMarkerMid: GleanCounter;
    cssMarkerStart: GleanCounter;
    cssContainIntrinsicBlockSize: GleanCounter;
    cssContainIntrinsicHeight: GleanCounter;
    cssContainIntrinsicInlineSize: GleanCounter;
    cssContainIntrinsicWidth: GleanCounter;
    cssGridColumnEnd: GleanCounter;
    cssGridColumnStart: GleanCounter;
    cssGridRowEnd: GleanCounter;
    cssGridRowStart: GleanCounter;
    cssMaxBlockSize: GleanCounter;
    cssMaxHeight: GleanCounter;
    cssMaxInlineSize: GleanCounter;
    cssMaxWidth: GleanCounter;
    cssCx: GleanCounter;
    cssCy: GleanCounter;
    cssOffsetDistance: GleanCounter;
    cssX: GleanCounter;
    cssY: GleanCounter;
    cssBorderBottomLeftRadius: GleanCounter;
    cssBorderBottomRightRadius: GleanCounter;
    cssBorderEndEndRadius: GleanCounter;
    cssBorderEndStartRadius: GleanCounter;
    cssBorderStartEndRadius: GleanCounter;
    cssBorderStartStartRadius: GleanCounter;
    cssBorderTopLeftRadius: GleanCounter;
    cssBorderTopRightRadius: GleanCounter;
    cssBottom: GleanCounter;
    cssInsetBlockEnd: GleanCounter;
    cssInsetBlockStart: GleanCounter;
    cssInsetInlineEnd: GleanCounter;
    cssInsetInlineStart: GleanCounter;
    cssLeft: GleanCounter;
    cssRight: GleanCounter;
    cssTop: GleanCounter;
    cssMarginBlockEnd: GleanCounter;
    cssMarginBlockStart: GleanCounter;
    cssMarginBottom: GleanCounter;
    cssMarginInlineEnd: GleanCounter;
    cssMarginInlineStart: GleanCounter;
    cssMarginLeft: GleanCounter;
    cssMarginRight: GleanCounter;
    cssMarginTop: GleanCounter;
    cssBlockSize: GleanCounter;
    cssHeight: GleanCounter;
    cssInlineSize: GleanCounter;
    cssMinBlockSize: GleanCounter;
    cssMinHeight: GleanCounter;
    cssMinInlineSize: GleanCounter;
    cssMinWidth: GleanCounter;
    cssWidth: GleanCounter;
    cssBorderBlockEndWidth: GleanCounter;
    cssBorderBlockStartWidth: GleanCounter;
    cssBorderBottomWidth: GleanCounter;
    cssBorderInlineEndWidth: GleanCounter;
    cssBorderInlineStartWidth: GleanCounter;
    cssBorderLeftWidth: GleanCounter;
    cssBorderRightWidth: GleanCounter;
    cssBorderTopWidth: GleanCounter;
    cssColumnRuleWidth: GleanCounter;
    cssOutlineWidth: GleanCounter;
    cssPaddingBlockEnd: GleanCounter;
    cssPaddingBlockStart: GleanCounter;
    cssPaddingBottom: GleanCounter;
    cssPaddingInlineEnd: GleanCounter;
    cssPaddingInlineStart: GleanCounter;
    cssPaddingLeft: GleanCounter;
    cssPaddingRight: GleanCounter;
    cssPaddingTop: GleanCounter;
    cssR: GleanCounter;
    cssShapeMargin: GleanCounter;
    cssRx: GleanCounter;
    cssRy: GleanCounter;
    cssScrollPaddingBlockEnd: GleanCounter;
    cssScrollPaddingBlockStart: GleanCounter;
    cssScrollPaddingBottom: GleanCounter;
    cssScrollPaddingInlineEnd: GleanCounter;
    cssScrollPaddingInlineStart: GleanCounter;
    cssScrollPaddingLeft: GleanCounter;
    cssScrollPaddingRight: GleanCounter;
    cssScrollPaddingTop: GleanCounter;
    cssMozWindowInputRegionMargin: GleanCounter;
    cssOutlineOffset: GleanCounter;
    cssOverflowClipMargin: GleanCounter;
    cssScrollMarginBlockEnd: GleanCounter;
    cssScrollMarginBlockStart: GleanCounter;
    cssScrollMarginBottom: GleanCounter;
    cssScrollMarginInlineEnd: GleanCounter;
    cssScrollMarginInlineStart: GleanCounter;
    cssScrollMarginLeft: GleanCounter;
    cssScrollMarginRight: GleanCounter;
    cssScrollMarginTop: GleanCounter;
    cssBackgroundColor: GleanCounter;
    cssBorderBlockEndColor: GleanCounter;
    cssBorderBlockStartColor: GleanCounter;
    cssBorderBottomColor: GleanCounter;
    cssBorderInlineEndColor: GleanCounter;
    cssBorderInlineStartColor: GleanCounter;
    cssBorderLeftColor: GleanCounter;
    cssBorderRightColor: GleanCounter;
    cssBorderTopColor: GleanCounter;
    cssColumnRuleColor: GleanCounter;
    cssFloodColor: GleanCounter;
    cssLightingColor: GleanCounter;
    cssOutlineColor: GleanCounter;
    cssStopColor: GleanCounter;
    cssTextDecorationColor: GleanCounter;
    cssTextEmphasisColor: GleanCounter;
    cssWebkitTextFillColor: GleanCounter;
    cssWebkitTextStrokeColor: GleanCounter;
    cssBackground: GleanCounter;
    cssBackgroundPosition: GleanCounter;
    cssBorderColor: GleanCounter;
    cssBorderStyle: GleanCounter;
    cssBorderWidth: GleanCounter;
    cssBorderTop: GleanCounter;
    cssBorderRight: GleanCounter;
    cssBorderBottom: GleanCounter;
    cssBorderLeft: GleanCounter;
    cssBorderBlockStart: GleanCounter;
    cssBorderBlockEnd: GleanCounter;
    cssBorderInlineStart: GleanCounter;
    cssBorderInlineEnd: GleanCounter;
    cssBorder: GleanCounter;
    cssBorderRadius: GleanCounter;
    cssBorderImage: GleanCounter;
    cssBorderBlockWidth: GleanCounter;
    cssBorderBlockStyle: GleanCounter;
    cssBorderBlockColor: GleanCounter;
    cssBorderInlineWidth: GleanCounter;
    cssBorderInlineStyle: GleanCounter;
    cssBorderInlineColor: GleanCounter;
    cssBorderBlock: GleanCounter;
    cssBorderInline: GleanCounter;
    cssOverflow: GleanCounter;
    cssOverflowClipBox: GleanCounter;
    cssOverscrollBehavior: GleanCounter;
    cssContainer: GleanCounter;
    cssPageBreakBefore: GleanCounter;
    cssPageBreakAfter: GleanCounter;
    cssPageBreakInside: GleanCounter;
    cssOffset: GleanCounter;
    cssColumns: GleanCounter;
    cssColumnRule: GleanCounter;
    cssFont: GleanCounter;
    cssFontVariant: GleanCounter;
    cssFontSynthesis: GleanCounter;
    cssMarker: GleanCounter;
    cssTextEmphasis: GleanCounter;
    cssTextWrap: GleanCounter;
    cssWhiteSpace: GleanCounter;
    cssWebkitTextStroke: GleanCounter;
    cssListStyle: GleanCounter;
    cssMargin: GleanCounter;
    cssMarginBlock: GleanCounter;
    cssMarginInline: GleanCounter;
    cssScrollMargin: GleanCounter;
    cssScrollMarginBlock: GleanCounter;
    cssScrollMarginInline: GleanCounter;
    cssOutline: GleanCounter;
    cssPadding: GleanCounter;
    cssPaddingBlock: GleanCounter;
    cssPaddingInline: GleanCounter;
    cssScrollPadding: GleanCounter;
    cssScrollPaddingBlock: GleanCounter;
    cssScrollPaddingInline: GleanCounter;
    cssFlexFlow: GleanCounter;
    cssFlex: GleanCounter;
    cssGap: GleanCounter;
    cssGridRow: GleanCounter;
    cssGridColumn: GleanCounter;
    cssGridArea: GleanCounter;
    cssGridTemplate: GleanCounter;
    cssGrid: GleanCounter;
    cssPlaceContent: GleanCounter;
    cssPlaceSelf: GleanCounter;
    cssPlaceItems: GleanCounter;
    cssPositionTry: GleanCounter;
    cssInset: GleanCounter;
    cssInsetBlock: GleanCounter;
    cssInsetInline: GleanCounter;
    cssContainIntrinsicSize: GleanCounter;
    cssMask: GleanCounter;
    cssMaskPosition: GleanCounter;
    cssTextDecoration: GleanCounter;
    cssTransition: GleanCounter;
    cssAnimation: GleanCounter;
    cssScrollTimeline: GleanCounter;
    cssViewTimeline: GleanCounter;
    cssAll: GleanCounter;
    cssWebkitBackgroundClip: GleanCounter;
    cssWebkitBackgroundOrigin: GleanCounter;
    cssWebkitBackgroundSize: GleanCounter;
    cssMozBorderStartColor: GleanCounter;
    cssMozBorderStartStyle: GleanCounter;
    cssMozBorderStartWidth: GleanCounter;
    cssMozBorderEndColor: GleanCounter;
    cssMozBorderEndStyle: GleanCounter;
    cssMozBorderEndWidth: GleanCounter;
    cssWebkitBorderTopLeftRadius: GleanCounter;
    cssWebkitBorderTopRightRadius: GleanCounter;
    cssWebkitBorderBottomRightRadius: GleanCounter;
    cssWebkitBorderBottomLeftRadius: GleanCounter;
    cssMozTransform: GleanCounter;
    cssWebkitTransform: GleanCounter;
    cssMozPerspective: GleanCounter;
    cssWebkitPerspective: GleanCounter;
    cssMozPerspectiveOrigin: GleanCounter;
    cssWebkitPerspectiveOrigin: GleanCounter;
    cssMozBackfaceVisibility: GleanCounter;
    cssWebkitBackfaceVisibility: GleanCounter;
    cssMozTransformStyle: GleanCounter;
    cssWebkitTransformStyle: GleanCounter;
    cssMozTransformOrigin: GleanCounter;
    cssWebkitTransformOrigin: GleanCounter;
    cssMozAppearance: GleanCounter;
    cssWebkitAppearance: GleanCounter;
    cssWebkitBoxShadow: GleanCounter;
    cssWebkitFilter: GleanCounter;
    cssMozFontFeatureSettings: GleanCounter;
    cssWebkitFontFeatureSettings: GleanCounter;
    cssMozFontLanguageOverride: GleanCounter;
    cssWebkitFontSmoothing: GleanCounter;
    cssColorAdjust: GleanCounter;
    cssMozHyphens: GleanCounter;
    cssWebkitTextSizeAdjust: GleanCounter;
    cssWordWrap: GleanCounter;
    cssMozTabSize: GleanCounter;
    cssMozMarginStart: GleanCounter;
    cssMozMarginEnd: GleanCounter;
    cssMozPaddingStart: GleanCounter;
    cssMozPaddingEnd: GleanCounter;
    cssWebkitFlexDirection: GleanCounter;
    cssWebkitFlexWrap: GleanCounter;
    cssWebkitJustifyContent: GleanCounter;
    cssWebkitAlignContent: GleanCounter;
    cssWebkitAlignItems: GleanCounter;
    cssWebkitFlexGrow: GleanCounter;
    cssWebkitFlexShrink: GleanCounter;
    cssWebkitAlignSelf: GleanCounter;
    cssWebkitOrder: GleanCounter;
    cssWebkitFlexBasis: GleanCounter;
    cssMozBoxSizing: GleanCounter;
    cssWebkitBoxSizing: GleanCounter;
    cssGridColumnGap: GleanCounter;
    cssGridRowGap: GleanCounter;
    cssWebkitClipPath: GleanCounter;
    cssWebkitMaskRepeat: GleanCounter;
    cssWebkitMaskPositionX: GleanCounter;
    cssWebkitMaskPositionY: GleanCounter;
    cssWebkitMaskClip: GleanCounter;
    cssWebkitMaskOrigin: GleanCounter;
    cssWebkitMaskSize: GleanCounter;
    cssWebkitMaskComposite: GleanCounter;
    cssWebkitMaskImage: GleanCounter;
    cssMozUserSelect: GleanCounter;
    cssWebkitUserSelect: GleanCounter;
    cssMozTransitionDuration: GleanCounter;
    cssWebkitTransitionDuration: GleanCounter;
    cssMozTransitionTimingFunction: GleanCounter;
    cssWebkitTransitionTimingFunction: GleanCounter;
    cssMozTransitionProperty: GleanCounter;
    cssWebkitTransitionProperty: GleanCounter;
    cssMozTransitionDelay: GleanCounter;
    cssWebkitTransitionDelay: GleanCounter;
    cssMozAnimationName: GleanCounter;
    cssWebkitAnimationName: GleanCounter;
    cssMozAnimationDuration: GleanCounter;
    cssWebkitAnimationDuration: GleanCounter;
    cssMozAnimationTimingFunction: GleanCounter;
    cssWebkitAnimationTimingFunction: GleanCounter;
    cssMozAnimationIterationCount: GleanCounter;
    cssWebkitAnimationIterationCount: GleanCounter;
    cssMozAnimationDirection: GleanCounter;
    cssWebkitAnimationDirection: GleanCounter;
    cssMozAnimationPlayState: GleanCounter;
    cssWebkitAnimationPlayState: GleanCounter;
    cssMozAnimationFillMode: GleanCounter;
    cssWebkitAnimationFillMode: GleanCounter;
    cssMozAnimationDelay: GleanCounter;
    cssWebkitAnimationDelay: GleanCounter;
    cssWebkitBoxAlign: GleanCounter;
    cssWebkitBoxDirection: GleanCounter;
    cssWebkitBoxFlex: GleanCounter;
    cssWebkitBoxOrient: GleanCounter;
    cssWebkitBoxPack: GleanCounter;
    cssWebkitBoxOrdinalGroup: GleanCounter;
    cssMozBorderStart: GleanCounter;
    cssMozBorderEnd: GleanCounter;
    cssWebkitBorderRadius: GleanCounter;
    cssMozBorderImage: GleanCounter;
    cssWebkitBorderImage: GleanCounter;
    cssWebkitFlexFlow: GleanCounter;
    cssWebkitFlex: GleanCounter;
    cssGridGap: GleanCounter;
    cssWebkitMask: GleanCounter;
    cssWebkitMaskPosition: GleanCounter;
    cssMozTransition: GleanCounter;
    cssWebkitTransition: GleanCounter;
    cssMozAnimation: GleanCounter;
    cssWebkitAnimation: GleanCounter;
    webkitTapHighlightColor: GleanCounter;
    speak: GleanCounter;
    textSizeAdjust: GleanCounter;
    webkitUserDrag: GleanCounter;
    orphans: GleanCounter;
    widows: GleanCounter;
    webkitUserModify: GleanCounter;
    webkitMarginBefore: GleanCounter;
    webkitMarginAfter: GleanCounter;
    webkitMarginStart: GleanCounter;
    webkitColumnBreakInside: GleanCounter;
    webkitPaddingStart: GleanCounter;
    webkitMarginEnd: GleanCounter;
    webkitBoxReflect: GleanCounter;
    webkitPrintColorAdjust: GleanCounter;
    webkitMaskBoxImage: GleanCounter;
    webkitLineBreak: GleanCounter;
    alignmentBaseline: GleanCounter;
    webkitWritingMode: GleanCounter;
    baselineShift: GleanCounter;
    webkitHyphenateCharacter: GleanCounter;
    webkitHighlight: GleanCounter;
    backgroundRepeatX: GleanCounter;
    webkitPaddingEnd: GleanCounter;
    backgroundRepeatY: GleanCounter;
    webkitTextEmphasisColor: GleanCounter;
    webkitMarginTopCollapse: GleanCounter;
    webkitRtlOrdering: GleanCounter;
    webkitPaddingBefore: GleanCounter;
    webkitTextDecorationsInEffect: GleanCounter;
    webkitBorderVerticalSpacing: GleanCounter;
    webkitLocale: GleanCounter;
    webkitPaddingAfter: GleanCounter;
    webkitBorderHorizontalSpacing: GleanCounter;
    colorRendering: GleanCounter;
    webkitColumnBreakBefore: GleanCounter;
    webkitTransformOriginX: GleanCounter;
    webkitTransformOriginY: GleanCounter;
    webkitTextEmphasisPosition: GleanCounter;
    bufferedRendering: GleanCounter;
    webkitTextOrientation: GleanCounter;
    webkitTextCombine: GleanCounter;
    webkitTextEmphasisStyle: GleanCounter;
    webkitTextEmphasis: GleanCounter;
    webkitMaskBoxImageWidth: GleanCounter;
    webkitMaskBoxImageSource: GleanCounter;
    webkitMaskBoxImageOutset: GleanCounter;
    webkitMaskBoxImageSlice: GleanCounter;
    webkitMaskBoxImageRepeat: GleanCounter;
    webkitMarginAfterCollapse: GleanCounter;
    webkitBorderBeforeColor: GleanCounter;
    webkitBorderBeforeWidth: GleanCounter;
    webkitPerspectiveOriginX: GleanCounter;
    webkitPerspectiveOriginY: GleanCounter;
    webkitMarginBeforeCollapse: GleanCounter;
    webkitBorderBeforeStyle: GleanCounter;
    webkitMarginBottomCollapse: GleanCounter;
    webkitRubyPosition: GleanCounter;
    webkitColumnBreakAfter: GleanCounter;
    webkitMarginCollapse: GleanCounter;
    webkitBorderBefore: GleanCounter;
    webkitBorderEnd: GleanCounter;
    webkitBorderAfter: GleanCounter;
    webkitBorderStart: GleanCounter;
    webkitMinLogicalWidth: GleanCounter;
    webkitLogicalHeight: GleanCounter;
    webkitTransformOriginZ: GleanCounter;
    webkitFontSizeDelta: GleanCounter;
    webkitLogicalWidth: GleanCounter;
    webkitMaxLogicalWidth: GleanCounter;
    webkitMinLogicalHeight: GleanCounter;
    webkitMaxLogicalHeight: GleanCounter;
    webkitBorderEndColor: GleanCounter;
    webkitBorderEndWidth: GleanCounter;
    webkitBorderStartColor: GleanCounter;
    webkitBorderStartWidth: GleanCounter;
    webkitBorderAfterColor: GleanCounter;
    webkitBorderAfterWidth: GleanCounter;
    webkitBorderEndStyle: GleanCounter;
    webkitBorderAfterStyle: GleanCounter;
    webkitBorderStartStyle: GleanCounter;
    webkitMaskRepeatX: GleanCounter;
    webkitMaskRepeatY: GleanCounter;
    userZoom: GleanCounter;
    minZoom: GleanCounter;
    webkitBoxDecorationBreak: GleanCounter;
    orientation: GleanCounter;
    maxZoom: GleanCounter;
    webkitAppRegion: GleanCounter;
    webkitColumnRule: GleanCounter;
    webkitColumnSpan: GleanCounter;
    webkitColumnGap: GleanCounter;
    webkitShapeOutside: GleanCounter;
    webkitColumnRuleWidth: GleanCounter;
    webkitColumnCount: GleanCounter;
    webkitOpacity: GleanCounter;
    webkitColumnWidth: GleanCounter;
    webkitShapeImageThreshold: GleanCounter;
    webkitColumnRuleStyle: GleanCounter;
    webkitColumns: GleanCounter;
    webkitColumnRuleColor: GleanCounter;
    webkitShapeMargin: GleanCounter;
  }

  canvas: {
    used2d: Record<string, GleanCounter>;
    webglAcclFailureId: Record<string, GleanCounter>;
    webglFailureId: Record<string, GleanCounter>;
    webglSuccess: Record<string, GleanCounter>;
    webglUsed: Record<string, GleanCounter>;
    webgl2Success: Record<string, GleanCounter>;
  }

  webcrypto: {
    extractableImport: Record<string, GleanCounter>;
    extractableGenerate: Record<string, GleanCounter>;
    extractableEnc: Record<string, GleanCounter>;
    extractableSig: Record<string, GleanCounter>;
    resolved: Record<string, GleanCounter>;
    method: GleanCustomDistribution;
    alg: GleanCustomDistribution;
  }

  geolocation: {
    accuracy: GleanCustomDistribution;
    requestResult: Record<string, GleanCounter>;
    fallback: Record<string, GleanCounter>;
    linuxProvider: Record<string, GleanBoolean>;
  }

  localstorageRequest: {
    prepareDatastoreProcessingTime: GleanTimingDistribution;
    sendCancelCounter: GleanCounter;
    recvCancelCounter: GleanCounter;
  }

  localstorageDatabase: {
    newObjectSetupTime: GleanTimingDistribution;
    requestAllowToCloseResponseTime: GleanTimingDistribution;
  }

  mediadrm: {
    emePlayback: GleanEvent;
    decryption: Record<string, GleanBoolean>;
  }

  hls: {
    canplayRequested: GleanCounter;
    canplaySupported: GleanCounter;
    mediaLoad: GleanEvent;
  }

  gmp: {
    updateXmlFetchResult: Record<string, GleanCounter>;
  }

  mediaAudio: {
    initFailure: Record<string, GleanCounter>;
    backend: Record<string, GleanCounter>;
  }

  mediaPlayback: {
    firstFrameLoaded: GleanEvent;
    deviceHardwareDecoderSupport: Record<string, GleanBoolean>;
    notSupportedVideoPerMimeType: Record<string, GleanCounter>;
    decodeError: GleanEvent;
  }

  media: {
    elementInPageCount: GleanCounter;
    videoHardwareDecodingSupport: Record<string, GleanBoolean>;
    videoHdHardwareDecodingSupport: Record<string, GleanBoolean>;
    error: GleanEvent;
    videoPlayTime: GleanTimingDistribution;
    mediaPlayTime: Record<string, GleanTimingDistribution>;
    audiblePlayTimePercent: Record<string, GleanCustomDistribution>;
    mutedPlayTimePercent: Record<string, GleanCustomDistribution>;
    videoVisiblePlayTime: Record<string, GleanTimingDistribution>;
    videoHiddenPlayTime: GleanTimingDistribution;
    videoHiddenPlayTimePercentage: Record<string, GleanCustomDistribution>;
    videoHdrPlayTime: GleanTimingDistribution;
    videoEncryptedPlayTime: GleanTimingDistribution;
    videoClearkeyPlayTime: GleanTimingDistribution;
    videoWidevinePlayTime: GleanTimingDistribution;
    videoDroppedFramesProportion: GleanCustomDistribution;
    videoDroppedFramesProportionExponential: GleanCustomDistribution;
    videoDroppedDecodedFramesProportionExponential: GleanCustomDistribution;
    videoDroppedSinkFramesProportionExponential: GleanCustomDistribution;
    videoDroppedCompositorFramesProportionExponential: GleanCustomDistribution;
    codecUsed: Record<string, GleanCounter>;
    mseSourceBufferType: Record<string, GleanCounter>;
    decoderBackendUsed: GleanCustomDistribution;
  }

  mediaMp4Parse: {
    sampleDescriptionEntriesHaveMultipleCodecs: Record<string, GleanCounter>;
    sampleDescriptionEntriesHaveMultipleCrypto: Record<string, GleanCounter>;
    numSampleDescriptionEntries: GleanCustomDistribution;
  }

  mfcdm: {
    emePlayback: GleanEvent;
    error: GleanEvent;
  }

  rtcrtpsender: {
    count: GleanCounter;
    countSetparametersCompat: GleanCounter;
    usedSendencodings: GleanRate;
  }

  rtcrtpsenderSetparameters: {
    warnNoGetparameters: GleanRate;
    warnLengthChanged: GleanRate;
    warnNoTransactionid: GleanRate;
    failLengthChanged: GleanRate;
    failRidChanged: GleanRate;
    failNoGetparameters: GleanRate;
    failNoTransactionid: GleanRate;
    failStaleTransactionid: GleanRate;
    failNoEncodings: GleanRate;
    failOther: GleanRate;
  }

  codecStats: {
    ulpfecNegotiated: Record<string, GleanCounter>;
    otherFecSignaled: Record<string, GleanCounter>;
    videoPreferredCodec: Record<string, GleanCounter>;
    audioPreferredCodec: Record<string, GleanCounter>;
  }

  webrtcdtls: {
    protocolVersion: Record<string, GleanCounter>;
    cipher: Record<string, GleanCounter>;
    srtpCipher: Record<string, GleanCounter>;
    clientHandshakeResult: Record<string, GleanCounter>;
    serverHandshakeResult: Record<string, GleanCounter>;
    clientHandshakeStartedCounter: GleanCounter;
    serverHandshakeStartedCounter: GleanCounter;
  }

  webrtcSignaling: {
    sdpNegotiated: GleanEvent;
    audioMsectionNegotiated: GleanEvent;
    videoMsectionNegotiated: GleanEvent;
  }

  webrtcVideo: {
    recvCodecUsed: Record<string, GleanCounter>;
    sendCodecUsed: Record<string, GleanCounter>;
  }

  webrtc: {
    videoQualityInboundBandwidthKbits: GleanCustomDistribution;
    audioQualityInboundBandwidthKbits: GleanCustomDistribution;
    videoQualityInboundPacketlossRate: GleanCustomDistribution;
    audioQualityInboundPacketlossRate: GleanCustomDistribution;
    videoQualityOutboundPacketlossRate: GleanCustomDistribution;
    audioQualityOutboundPacketlossRate: GleanCustomDistribution;
    videoQualityInboundJitter: GleanTimingDistribution;
    audioQualityInboundJitter: GleanTimingDistribution;
    videoQualityOutboundJitter: GleanTimingDistribution;
    audioQualityOutboundJitter: GleanTimingDistribution;
    videoQualityOutboundRtt: GleanTimingDistribution;
    audioQualityOutboundRtt: GleanTimingDistribution;
    videoEncoderBitrateAvgPerCallKbps: GleanCustomDistribution;
    videoEncoderBitrateStdDevPerCallKbps: GleanCustomDistribution;
    videoEncoderFramerateAvgPerCall: GleanCustomDistribution;
    videoEncoderFramerate10xStdDevPerCall: GleanCustomDistribution;
    videoDecoderBitrateAvgPerCallKbps: GleanCustomDistribution;
    videoDecoderBitrateStdDevPerCallKbps: GleanCustomDistribution;
    videoDecoderFramerateAvgPerCall: GleanCustomDistribution;
    videoDecoderFramerate10xStdDevPerCall: GleanCustomDistribution;
    videoDecoderDiscardedPacketsPerCallPpm: GleanCustomDistribution;
    callDuration: GleanTimingDistribution;
    avCallDuration: GleanTimingDistribution;
    callCount3: GleanCounter;
    getUserMediaType: GleanCustomDistribution;
    renegotiations: GleanCustomDistribution;
    maxVideoSendTrack: GleanCustomDistribution;
    maxVideoReceiveTrack: GleanCustomDistribution;
    maxAudioSendTrack: GleanCustomDistribution;
    maxAudioReceiveTrack: GleanCustomDistribution;
    datachannelNegotiated: Record<string, GleanCounter>;
    callType: GleanCustomDistribution;
    softwareH264Enabled: Record<string, GleanCounter>;
    hasH264Hardware: Record<string, GleanCounter>;
    hardwareH264Enabled: Record<string, GleanCounter>;
    h264Enabled: Record<string, GleanCounter>;
    gmpInitSuccess: Record<string, GleanCounter>;
  }

  perf: {
    largestContentfulPaint: GleanTimingDistribution;
    largestContentfulPaintFromResponseStart: GleanTimingDistribution;
    pageLoad: GleanEvent;
    http3PageLoadTime: Record<string, GleanTimingDistribution>;
    http3FirstContentfulPaint: Record<string, GleanTimingDistribution>;
    h3pPageLoadTime: Record<string, GleanTimingDistribution>;
    h3pFirstContentfulPaint: Record<string, GleanTimingDistribution>;
    dnsFirstContentfulPaint: Record<string, GleanTimingDistribution>;
    dnsFirstByte: Record<string, GleanTimingDistribution>;
  }

  performancePageload: {
    loadTime: GleanTimingDistribution;
    loadTimeResponsestart: GleanTimingDistribution;
    fcp: GleanTimingDistribution;
    fcpResponsestart: GleanTimingDistribution;
    http3FcpHttp3: GleanTimingDistribution;
    http3FcpSupportsHttp3: GleanTimingDistribution;
    h3pFcpWithPriority: GleanTimingDistribution;
    http3FcpWithoutPriority: GleanTimingDistribution;
  }

  performanceTime: {
    domInteractive: GleanTimingDistribution;
    domContentLoadedStart: GleanTimingDistribution;
    domContentLoadedEnd: GleanTimingDistribution;
    domComplete: GleanTimingDistribution;
    loadEventStart: GleanTimingDistribution;
    loadEventEnd: GleanTimingDistribution;
    toFirstContentfulPaint: GleanTimingDistribution;
    toDomLoading: GleanTimingDistribution;
    responseStart: GleanTimingDistribution;
  }

  javascriptPageload: {
    executionTime: GleanTimingDistribution;
    delazificationTime: GleanTimingDistribution;
    xdrEncodeTime: GleanTimingDistribution;
    baselineCompileTime: GleanTimingDistribution;
    gcTime: GleanTimingDistribution;
    parseTime: GleanTimingDistribution;
    protectTime: GleanTimingDistribution;
  }

  domContentprocess: {
    buildIdMismatch: GleanCounter;
    buildIdMismatchFalsePositive: GleanCounter;
    osPriorityLowered: GleanCounter;
    osPriorityRaised: GleanCounter;
    osPriorityChangeConsidered: GleanCounter;
    launchMainthread: GleanTimingDistribution;
    launchTotal: GleanTimingDistribution;
    syncLaunch: GleanTimingDistribution;
    launchIsSync: Record<string, GleanCounter>;
  }

  domParentprocess: {
    privateWindowUsed: GleanBoolean;
    processLaunchErrors: Record<string, GleanCounter>;
  }

  domTextfragment: {
    findDirectives: GleanTimingDistribution;
    createDirective: GleanTimingDistribution;
  }

  dom: {
    forgetSkippableDuringIdle: GleanCustomDistribution;
    forgetSkippableFrequency: GleanCustomDistribution;
    fullscreenTransitionBlack: GleanTimingDistribution;
    gcInProgress: GleanTimingDistribution;
    gcSliceDuringIdle: GleanCustomDistribution;
    innerwindowsWithMutationListeners: Record<string, GleanCounter>;
    xmlhttprequestAsyncOrSync: Record<string, GleanCounter>;
    storageAccessApiUi: Record<string, GleanCounter>;
    slowScriptNoticeCount: GleanCounter;
    slowScriptPageCount: GleanCounter;
    scriptLoadingSource: Record<string, GleanCounter>;
    blinkFilesystemUsed: Record<string, GleanCounter>;
    webkitDirectoryUsed: Record<string, GleanCounter>;
  }

  webNotification: {
    insecureContextPermissionRequest: GleanCounter;
    showOrigin: Record<string, GleanCounter>;
    permissionOrigin: Record<string, GleanCounter>;
    requestPermissionOrigin: Record<string, GleanCounter>;
    iconUrlEncoding: Record<string, GleanCounter>;
  }

  screenwakelock: {
    heldDuration: GleanTimingDistribution;
    releaseBatteryLevelDischarging: GleanCustomDistribution;
  }

  webPush: {
    detectedDuplicatedMessageIds: GleanCounter;
    errorCode: Record<string, GleanCounter>;
    contentEncoding: Record<string, GleanCounter>;
    unsubscribedByClearingData: GleanCounter;
    apiNotify: GleanCounter;
  }

  domQuotaTry: {
    errorStep: GleanEvent;
  }

  quotamanager: {
    restoreOriginDirectoryMetadataCounter: GleanCounter;
  }

  quotamanagerInitializeRepository: {
    numberOfIterations: Record<string, GleanCustomDistribution>;
  }

  quotamanagerInitializeTemporarystorage: {
    totalTimeExcludingSuspend: GleanTimingDistribution;
  }

  quotamanagerShutdown: {
    totalTimeExcludingSuspend: GleanTimingDistribution;
  }

  domQuota: {
    infoLoadTime: Record<string, GleanTimingDistribution>;
    shutdownTime: Record<string, GleanTimingDistribution>;
  }

  httpsfirst: {
    upgraded: GleanCounter;
    upgradedSchemeless: GleanCounter;
    downgraded: GleanCounter;
    downgradedSchemeless: GleanCounter;
    downgradedOnTimer: GleanRate;
    downgradedOnTimerSchemeless: GleanRate;
    downgradeTime: GleanTimingDistribution;
    downgradeTimeSchemeless: GleanTimingDistribution;
  }

  mixedContent: {
    pageLoad: GleanCustomDistribution;
    unblockCounter: GleanCustomDistribution;
    hsts: GleanCustomDistribution;
    images: Record<string, GleanCounter>;
    video: Record<string, GleanCounter>;
    audio: Record<string, GleanCounter>;
  }

  securityUi: {
    events: GleanCustomDistribution;
  }

  serviceWorker: {
    launchTime: GleanTimingDistribution;
    isolatedLaunchTime: GleanTimingDistribution;
    registrationLoading: GleanTimingDistribution;
    fetchInterceptionDuration: Record<string, GleanTimingDistribution>;
    fetchEventDispatch: Record<string, GleanTimingDistribution>;
    fetchEventFinishSynthesizedResponse: Record<string, GleanTimingDistribution>;
    fetchEventChannelReset: Record<string, GleanTimingDistribution>;
    running: Record<string, GleanCustomDistribution>;
  }

  localdomstorage: {
    shutdownDatabase: GleanTimingDistribution;
    preloadPendingOnFirstAccess: Record<string, GleanCounter>;
  }

  webauthnCreate: {
    success: GleanCounter;
    failure: GleanCounter;
    authenticatorAttachment: Record<string, GleanCounter>;
    passkey: GleanCounter;
  }

  webauthnGet: {
    success: GleanCounter;
    failure: GleanCounter;
    authenticatorAttachment: Record<string, GleanCounter>;
  }

  workers: {
    serviceWorkerSpawnGetsQueued: GleanCounter;
    sharedWorkerSpawnGetsQueued: GleanCounter;
    dedicatedWorkerSpawnGetsQueued: GleanCounter;
    syncWorkerOperation: Record<string, GleanTimingDistribution>;
  }

  htmleditors: {
    withBeforeinputListeners: Record<string, GleanCounter>;
    overriddenByBeforeinputListeners: Record<string, GleanCounter>;
    withMutationListenersWithoutBeforeinputListeners: Record<string, GleanCounter>;
    withMutationObserversWithoutBeforeinputListeners: Record<string, GleanCounter>;
  }

  permissions: {
    sqlCorrupted: GleanCounter;
    defectiveSqlRemoved: GleanCounter;
  }

  paint: {
    buildDisplaylistTime: GleanTimingDistribution;
  }

  gpuProcess: {
    featureStatus: GleanString;
    crashFallbacks: Record<string, GleanCounter>;
    totalLaunchAttempts: GleanQuantity;
    unstableLaunchAttempts: GleanQuantity;
    launchTime: GleanTimingDistribution;
    initializationTime: GleanTimingDistribution;
  }

  wr: {
    gpuWaitTime: GleanTimingDistribution;
    rasterizeGlyphsTime: GleanTimingDistribution;
    rasterizeBlobsTime: GleanTimingDistribution;
    rendererTime: GleanTimingDistribution;
    rendererTimeNoSc: GleanTimingDistribution;
    framebuildTime: GleanTimingDistribution;
    scenebuildTime: GleanTimingDistribution;
    shaderloadTime: GleanTimingDistribution;
    sceneswapTime: GleanTimingDistribution;
    textureCacheUpdateTime: GleanTimingDistribution;
    timeToFrameBuild: GleanTimingDistribution;
    timeToRenderStart: GleanTimingDistribution;
  }

  gfx: {
    compositeTime: GleanTimingDistribution;
    scrollPresentLatency: GleanTimingDistribution;
    skippedComposites: GleanCounter;
    osCompositor: GleanBoolean;
    linuxWindowProtocol: GleanString;
    supportsHdr: GleanBoolean;
    compositeSwapTime: GleanCustomDistribution;
    compositeFrameRoundtripTime: GleanTimingDistribution;
    deviceResetReason: GleanCustomDistribution;
    forcedDeviceResetReason: GleanCustomDistribution;
    graphicsDriverStartupTest: GleanCustomDistribution;
    contentFailedToAcquireDevice: GleanCustomDistribution;
    crash: GleanCustomDistribution;
    macosVideoLowPower: Record<string, GleanCounter>;
    sanityTest: GleanCustomDistribution;
    d2dEnabled: GleanBoolean;
    dwriteEnabled: GleanBoolean;
    contentBackend: GleanString;
    headless: GleanBoolean;
    targetFrameRate: GleanQuantity;
    textScaleFactor: GleanString;
    monitors: GleanObject;
    adapters: GleanObject;
  }

  gfxDisplay: {
    count: GleanQuantity;
    primaryWidth: GleanQuantity;
    primaryHeight: GleanQuantity;
    scaling: GleanCustomDistribution;
  }

  gfxCheckerboard: {
    duration: GleanTimingDistribution;
    peakPixelCount: GleanCustomDistribution;
    potentialDuration: GleanTimingDistribution;
    severity: GleanCustomDistribution;
  }

  gfxFeature: {
    webrender: GleanString;
  }

  gfxStatus: {
    compositor: GleanString;
    lastCompositorGeckoVersion: GleanString;
    headless: GleanBoolean;
  }

  gfxContentFrameTime: {
    fromPaint: GleanCustomDistribution;
    fromVsync: GleanCustomDistribution;
    withSvg: GleanCustomDistribution;
    withoutResourceUpload: GleanCustomDistribution;
    withoutUpload: GleanCustomDistribution;
    reason: Record<string, GleanCounter>;
  }

  gfxContent: {
    paintTime: GleanTimingDistribution;
    fullPaintTime: GleanTimingDistribution;
    smallPaintPhaseWeightPartial: Record<string, GleanCustomDistribution>;
    largePaintPhaseWeightPartial: Record<string, GleanCustomDistribution>;
    smallPaintPhaseWeightFull: Record<string, GleanCustomDistribution>;
    largePaintPhaseWeightFull: Record<string, GleanCustomDistribution>;
  }

  gfxAdapterPrimary: {
    description: GleanString;
    vendorId: GleanString;
    deviceId: GleanString;
    subsystemId: GleanString;
    ram: GleanQuantity;
    driverFiles: GleanString;
    driverVendor: GleanString;
    driverVersion: GleanString;
    driverDate: GleanString;
  }

  gfxHdr: {
    windowsDisplayColorspaceBitfield: GleanQuantity;
  }

  fontlist: {
    initotherfamilynames: GleanTimingDistribution;
    initotherfamilynamesNoDeferring: GleanTimingDistribution;
    initfacenamelists: GleanTimingDistribution;
    bundledfontsActivate: GleanTimingDistribution;
    dwritefontDelayedinitTotal: GleanTimingDistribution;
    dwritefontDelayedinitCount: GleanCustomDistribution;
    dwritefontDelayedinitCollect: GleanTimingDistribution;
    dwritefontInitProblem: GleanCustomDistribution;
    systemFontFallback: GleanTimingDistribution;
    systemFontFallbackFirst: GleanTimingDistribution;
    fontCacheHit: Record<string, GleanCounter>;
    badFallbackFont: Record<string, GleanCounter>;
    gdiInitTotal: GleanTimingDistribution;
    macInitTotal: GleanTimingDistribution;
  }

  apzZoom: {
    activity: Record<string, GleanCounter>;
    pinchsource: GleanCustomDistribution;
  }

  webfont: {
    downloadTime: GleanTimingDistribution;
    fonttype: GleanCustomDistribution;
    srctype: GleanCustomDistribution;
    perPage: GleanCounter;
    sizePerPage: GleanMemoryDistribution;
    size: GleanMemoryDistribution;
    compressionWoff: GleanCustomDistribution;
    compressionWoff2: GleanCustomDistribution;
  }

  avif: {
    decodeResult: Record<string, GleanCounter>;
    decoder: Record<string, GleanCounter>;
    aomDecodeError: Record<string, GleanCounter>;
    yuvColorSpace: Record<string, GleanCounter>;
    bitDepth: Record<string, GleanCounter>;
    alpha: Record<string, GleanCounter>;
    colr: Record<string, GleanCounter>;
    cicpCp: Record<string, GleanCounter>;
    cicpTc: Record<string, GleanCounter>;
    cicpMc: Record<string, GleanCounter>;
    ispe: Record<string, GleanCounter>;
    pixi: Record<string, GleanCounter>;
    pasp: Record<string, GleanCounter>;
    a1lx: Record<string, GleanCounter>;
    a1op: Record<string, GleanCounter>;
    clap: Record<string, GleanCounter>;
    grid: Record<string, GleanCounter>;
    ipro: Record<string, GleanCounter>;
    lsel: Record<string, GleanCounter>;
    dav1dGetPictureReturnValue: GleanEvent;
    majorBrand: Record<string, GleanCounter>;
    sequence: Record<string, GleanCounter>;
  }

  imageDecode: {
    time: GleanTimingDistribution;
    onDrawLatency: GleanTimingDistribution;
    chunks: GleanCustomDistribution;
    count: GleanCustomDistribution;
    speedJpeg: GleanMemoryDistribution;
    speedGif: GleanMemoryDistribution;
    speedPng: GleanMemoryDistribution;
    speedWebp: GleanMemoryDistribution;
    speedAvif: GleanMemoryDistribution;
  }

  intl: {
    requestedLocales: GleanStringList;
    availableLocales: GleanStringList;
    appLocales: GleanStringList;
    systemLocales: GleanStringList;
    regionalPrefsLocales: GleanStringList;
    acceptLanguages: GleanStringList;
  }

  process: {
    childLaunch: GleanTimingDistribution;
    lifetime: GleanTimingDistribution;
  }

  ipc: {
    transactionCancel: Record<string, GleanCounter>;
  }

  subprocess: {
    abnormalAbort: Record<string, GleanCounter>;
    crashesWithDump: Record<string, GleanCounter>;
    launchFailure: Record<string, GleanCounter>;
    killHard: Record<string, GleanCounter>;
  }

  javascriptIon: {
    compileTime: GleanTimingDistribution;
  }

  javascriptGc: {
    totalTime: GleanTimingDistribution;
    minorTime: GleanTimingDistribution;
    prepareTime: GleanTimingDistribution;
    markRootsTime: GleanTimingDistribution;
    markTime: GleanTimingDistribution;
    sweepTime: GleanTimingDistribution;
    compactTime: GleanTimingDistribution;
    sliceTime: GleanTimingDistribution;
    budget: GleanTimingDistribution;
    budgetOverrun: GleanTimingDistribution;
    animation: GleanTimingDistribution;
    maxPause: GleanTimingDistribution;
    markGray: GleanTimingDistribution;
    markWeak: GleanTimingDistribution;
    timeBetween: GleanTimingDistribution;
    timeBetweenSlices: GleanTimingDistribution;
    taskStartDelay: GleanTimingDistribution;
    nurseryBytes: GleanMemoryDistribution;
    effectiveness: GleanCustomDistribution;
    zoneCount: GleanCustomDistribution;
    zonesCollected: GleanCustomDistribution;
    pretenureCount: GleanCustomDistribution;
    markRate: GleanCustomDistribution;
    sliceCount: GleanCustomDistribution;
    parallelMarkSpeedup: GleanCustomDistribution;
    parallelMarkInterruptions: GleanCustomDistribution;
    parallelMarkUtilization: GleanCustomDistribution;
    mmu50: GleanCustomDistribution;
    nurseryPromotionRate: GleanCustomDistribution;
    tenuredSurvivalRate: GleanCustomDistribution;
    isZoneGc: Record<string, GleanCounter>;
    budgetWasIncreased: Record<string, GleanCounter>;
    sliceWasLong: Record<string, GleanCounter>;
    reset: Record<string, GleanCounter>;
    nonIncremental: Record<string, GleanCounter>;
    parallelMarkUsed: Record<string, GleanCounter>;
    reason: Record<string, GleanCounter>;
    slowPhase: Record<string, GleanCounter>;
    slowTask: Record<string, GleanCounter>;
    resetReason: Record<string, GleanCounter>;
    nonIncrementalReason: Record<string, GleanCounter>;
    minorReason: Record<string, GleanCounter>;
    minorReasonLong: Record<string, GleanCounter>;
  }

  slowScriptWarning: {
    shownBrowser: GleanEvent;
    shownContent: GleanEvent;
    notifyDelay: GleanTimingDistribution;
  }

  scriptPreloader: {
    mainthreadRecompile: GleanCounter;
    requests: Record<string, GleanCounter>;
    waitTime: GleanTimingDistribution;
  }

  layout: {
    refreshDriverTick: GleanTimingDistribution;
    paintRasterizeTime: GleanTimingDistribution;
    refreshDriverChromeFrameDelay: GleanTimingDistribution;
    refreshDriverContentFrameDelay: GleanTimingDistribution;
    inputEventResponse: GleanTimingDistribution;
    inputEventResponseCoalesced: GleanTimingDistribution;
    loadInputEventResponse: GleanTimingDistribution;
    longReflowInterruptible: Record<string, GleanCounter>;
    timeToFirstInteraction: GleanTimingDistribution;
    inputEventQueuedClick: GleanTimingDistribution;
    inputEventQueuedKeyboard: GleanTimingDistribution;
  }

  geckoview: {
    pageLoadProgressTime: GleanTimingDistribution;
    pageLoadTime: GleanTimingDistribution;
    pageReloadTime: GleanTimingDistribution;
    documentSiteOrigins: GleanCustomDistribution;
    perDocumentSiteOrigins: GleanCustomDistribution;
    startupRuntime: GleanTimingDistribution;
    contentProcessLifetime: GleanTimingDistribution;
  }

  zeroByteLoad: {
    loadFtl: GleanEvent;
    loadDtd: GleanEvent;
    loadProperties: GleanEvent;
    loadJs: GleanEvent;
    loadXml: GleanEvent;
    loadXhtml: GleanEvent;
    loadCss: GleanEvent;
    loadJson: GleanEvent;
    loadHtml: GleanEvent;
    loadPng: GleanEvent;
    loadSvg: GleanEvent;
    loadOthers: GleanEvent;
  }

  preferences: {
    prefsFileWasInvalid: GleanBoolean;
    userPrefs: GleanObject;
  }

  network: {
    diskCacheShutdownV2: GleanTimingDistribution;
    diskCache2ShutdownClearPrivate: GleanTimingDistribution;
    cacheV2OutputStreamStatus: GleanCustomDistribution;
    cacheV2InputStreamStatus: GleanCustomDistribution;
    cacheSize: Record<string, GleanMemoryDistribution>;
    cacheEntryCount: Record<string, GleanCustomDistribution>;
    cacheSizeShare: Record<string, GleanCustomDistribution>;
    cacheEntryCountShare: Record<string, GleanCustomDistribution>;
    httpCacheEntryReloadTime: GleanTimingDistribution;
    httpCacheEntryAliveTime: GleanTimingDistribution;
    httpCacheEntryReuseCount: GleanCustomDistribution;
    id: GleanCustomDistribution;
    idOnline: Record<string, GleanCounter>;
    backgroundfilesaverThreadCount: GleanCustomDistribution;
    ipv4AndIpv6AddressConnectivity: GleanCustomDistribution;
    relPreloadMissRatio: Record<string, GleanCounter>;
    byteRangeRequest: Record<string, GleanCounter>;
    cacheReadTime: GleanTimingDistribution;
    completeLoad: GleanTimingDistribution;
    completeLoadCached: GleanTimingDistribution;
    completeLoadNet: GleanTimingDistribution;
    corsAuthorizationHeader: Record<string, GleanCounter>;
    cacheHitTime: GleanTimingDistribution;
    cacheMissTime: GleanTimingDistribution;
    cacheHitMissStatPerCacheSize: Record<string, GleanCounter>;
    cacheHitRatePerCacheSize: Record<string, GleanCustomDistribution>;
    fontDownloadEnd: GleanTimingDistribution;
    firstFromCache: GleanTimingDistribution;
    tcpConnection: GleanTimingDistribution;
    dnsStart: GleanTimingDistribution;
    dnsEnd: GleanTimingDistribution;
    httpRevalidation: GleanTimingDistribution;
    firstSentToLastReceived: GleanTimingDistribution;
    openToFirstSent: GleanTimingDistribution;
    openToFirstReceived: GleanTimingDistribution;
    subCacheReadTime: GleanTimingDistribution;
    subCompleteLoad: GleanTimingDistribution;
    subCompleteLoadCached: GleanTimingDistribution;
    subCompleteLoadNet: GleanTimingDistribution;
    subDnsStart: GleanTimingDistribution;
    subDnsEnd: GleanTimingDistribution;
    subFirstFromCache: GleanTimingDistribution;
    subFirstSentToLastReceived: GleanTimingDistribution;
    subHttpRevalidation: GleanTimingDistribution;
    subOpenToFirstSent: GleanTimingDistribution;
    subOpenToFirstReceived: GleanTimingDistribution;
    subTlsHandshake: GleanTimingDistribution;
    subTcpConnection: GleanTimingDistribution;
    pageLoadSize: Record<string, GleanMemoryDistribution>;
    tlsEarlyDataNegotiated: Record<string, GleanCounter>;
    tlsEarlyDataAccepted: Record<string, GleanCounter>;
    tlsEarlyDataBytesWritten: GleanCustomDistribution;
    tlsHandshake: GleanTimingDistribution;
    http3TlsHandshake: Record<string, GleanTimingDistribution>;
    supHttp3TcpConnection: Record<string, GleanTimingDistribution>;
    http3OpenToFirstSent: Record<string, GleanTimingDistribution>;
    http3FirstSentToLastReceived: Record<string, GleanTimingDistribution>;
    http3OpenToFirstReceived: Record<string, GleanTimingDistribution>;
    http3CompleteLoad: Record<string, GleanTimingDistribution>;
    httpFetchDuration: Record<string, GleanTimingDistribution>;
    systemChannelSuccessOrFailure: Record<string, GleanCounter>;
    systemChannelUpdateStatus: Record<string, GleanCounter>;
    systemChannelAddonversionStatus: Record<string, GleanCounter>;
    systemChannelAddonStatus: Record<string, GleanCounter>;
    systemChannelRemoteSettingsStatus: Record<string, GleanCounter>;
    systemChannelTelemetryStatus: Record<string, GleanCounter>;
    systemChannelOtherStatus: Record<string, GleanCounter>;
    alpnMismatchCount: Record<string, GleanCounter>;
    raceCacheWithNetworkUsage: Record<string, GleanCounter>;
    raceCacheWithNetworkSavedTime: GleanTimingDistribution;
    raceCacheWithNetworkOcecOnStartDiff: GleanTimingDistribution;
    raceCacheBandwidthRaceNetworkWin: GleanMemoryDistribution;
    raceCacheBandwidthRaceCacheWin: GleanMemoryDistribution;
    raceCacheBandwidthNotRace: GleanMemoryDistribution;
    raceCacheValidation: Record<string, GleanCounter>;
    backPressureSuspensionRate: Record<string, GleanCounter>;
    backPressureSuspensionCpType: GleanCustomDistribution;
    backPressureSuspensionDelayTime: GleanTimingDistribution;
    asyncOpenChildToTransactionPendingExp: Record<string, GleanTimingDistribution>;
    responseStartParentToContentExp: Record<string, GleanTimingDistribution>;
    dnsEndToConnectStartExp: Record<string, GleanTimingDistribution>;
    responseEndParentToContent: Record<string, GleanTimingDistribution>;
    trrIdleCloseTimeH1: Record<string, GleanTimingDistribution>;
    trrIdleCloseTimeH2: Record<string, GleanTimingDistribution>;
    trrIdleCloseTimeH3: Record<string, GleanTimingDistribution>;
  }

  dns: {
    lookupMethod: GleanCustomDistribution;
    gracePeriodRenewal: Record<string, GleanCounter>;
    cleanupAge: GleanTimingDistribution;
    byTypeCleanupAge: GleanTimingDistribution;
    prematureEviction: GleanTimingDistribution;
    byTypePrematureEviction: GleanTimingDistribution;
    trrLookupTime: Record<string, GleanTimingDistribution>;
    trrProcessingTime: GleanTimingDistribution;
    trrSkipReasonTrrFirst: Record<string, GleanCustomDistribution>;
    trrSkipReasonNativeSuccess: Record<string, GleanCustomDistribution>;
    trrSkipReasonNativeFailed: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonTrrFirst: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonNativeSuccess: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonNativeFailed: Record<string, GleanCustomDistribution>;
    trrSkipReasonStrictMode: Record<string, GleanCustomDistribution>;
    trrSkipReasonRetrySuccess: Record<string, GleanCustomDistribution>;
    trrSkipReasonRetryFailed: Record<string, GleanCustomDistribution>;
    trrRelevantSkipReasonTrrFirstTypeRec: Record<string, GleanCustomDistribution>;
    trrAttemptCount: Record<string, GleanCustomDistribution>;
    nativeLookupTime: GleanTimingDistribution;
    byTypeFailedLookupTime: GleanTimingDistribution;
    byTypeSucceededLookupTime: GleanTimingDistribution;
    nativeQueuing: GleanTimingDistribution;
    lookupAlgorithm: Record<string, GleanCounter>;
    blocklistCount: GleanCustomDistribution;
  }

  networkDns: {
    trrConfirmationContext: GleanEvent;
  }

  networkSso: {
    entraSuccess: Record<string, GleanCounter>;
    totalEntraUses: GleanCounter;
  }

  predictor: {
    learnAttempts: GleanCustomDistribution;
    waitTime: GleanTimingDistribution;
    predictWorkTime: GleanTimingDistribution;
    learnWorkTime: GleanTimingDistribution;
    totalPredictions: GleanCustomDistribution;
    totalPrefetches: GleanCustomDistribution;
    prefetchUseStatus: Record<string, GleanCounter>;
    prefetchTime: GleanTimingDistribution;
    totalPreconnects: GleanCustomDistribution;
    totalPreresolves: GleanCustomDistribution;
    predictionsCalculated: GleanCustomDistribution;
    globalDegradation: GleanCustomDistribution;
    subresourceDegradation: GleanCustomDistribution;
    baseConfidence: GleanCustomDistribution;
    confidence: GleanCustomDistribution;
    predictTimeToAction: GleanTimingDistribution;
    predictTimeToInaction: GleanTimingDistribution;
    prefetchDecisionReason: GleanCustomDistribution;
    prefetchIgnoreReason: GleanCustomDistribution;
  }

  sts: {
    pollAndEventsCycle: GleanTimingDistribution;
    pollCycle: GleanTimingDistribution;
    pollAndEventTheLastCycle: GleanTimingDistribution;
    pollBlockTime: GleanTimingDistribution;
  }

  networkCookies: {
    sqliteOpenReadahead: GleanTimingDistribution;
  }

  netwerk: {
    parentConnectTimeout: GleanCounter;
    http30rttState: Record<string, GleanCounter>;
    http30rttStateDuration: Record<string, GleanTimingDistribution>;
    http3TimeToReuseIdleConnection: Record<string, GleanTimingDistribution>;
  }

  opaqueResponseBlocking: {
    javascriptValidationCount: GleanCounter;
    crossOriginOpaqueResponseCount: GleanCounter;
  }

  orb: {
    javascriptValidation: Record<string, GleanTimingDistribution>;
    receiveDataForValidation: Record<string, GleanTimingDistribution>;
    didEverBlockResponse: Record<string, GleanCounter>;
    blockReason: Record<string, GleanCounter>;
    blockInitiator: Record<string, GleanCounter>;
  }

  hpack: {
    elementsEvictedDecompressor: GleanCustomDistribution;
    bytesEvictedDecompressor: GleanMemoryDistribution;
    bytesEvictedRatioDecompressor: GleanCustomDistribution;
    peakCountDecompressor: GleanCustomDistribution;
    peakSizeDecompressor: GleanMemoryDistribution;
    elementsEvictedCompressor: GleanCustomDistribution;
    bytesEvictedCompressor: GleanMemoryDistribution;
    bytesEvictedRatioCompressor: GleanCustomDistribution;
    peakCountCompressor: GleanCustomDistribution;
    peakSizeCompressor: GleanMemoryDistribution;
  }

  spdy: {
    parallelStreams: GleanCustomDistribution;
    requestPerConn: GleanCustomDistribution;
    serverInitiatedStreams: GleanCustomDistribution;
    chunkRecvd: GleanMemoryDistribution;
    synSize: GleanMemoryDistribution;
    synRatio: GleanCustomDistribution;
    synReplySize: GleanMemoryDistribution;
    synReplyRatio: GleanCustomDistribution;
    kbreadPerConn: GleanMemoryDistribution;
    settingsMaxStreams: GleanCustomDistribution;
    settingsIw: GleanMemoryDistribution;
    goawayLocal: GleanCustomDistribution;
    goawayPeer: GleanCustomDistribution;
    continuedHeaders: GleanMemoryDistribution;
  }

  http: {
    subitemOpenLatencyTime: GleanTimingDistribution;
    subitemFirstByteLatencyTime: GleanTimingDistribution;
    requestPerPage: GleanCustomDistribution;
    requestPerPageFromCache: GleanCustomDistribution;
    requestPerConn: GleanCustomDistribution;
    kbreadPerConn2: GleanMemoryDistribution;
    proxyType: GleanCustomDistribution;
    transactionIsSsl: Record<string, GleanCounter>;
    pageloadIsSsl: Record<string, GleanCounter>;
    transactionUseAltsvc: Record<string, GleanCounter>;
    altsvcEntriesPerHeader: GleanCustomDistribution;
    altsvcMappingChangedTarget: Record<string, GleanCounter>;
    uploadBandwidthMbps: Record<string, GleanCustomDistribution>;
    responseVersion: GleanCustomDistribution;
    channelDisposition: GleanCustomDistribution;
    channelOnstartSuccess: Record<string, GleanCounter>;
    channelPageOnstartSuccessTrr: Record<string, GleanCustomDistribution>;
    channelSubOnstartSuccessTrr: Record<string, GleanCustomDistribution>;
    connectionEntryCacheHit: Record<string, GleanCounter>;
    sawQuicAltProtocol: GleanCustomDistribution;
    contentEncoding: GleanCustomDistribution;
    connectionCloseReason: Record<string, GleanCustomDistribution>;
    transactionRestartReason: GleanCustomDistribution;
    transactionEchRetryWithEchCount: GleanCustomDistribution;
    transactionEchRetryWithoutEchCount: GleanCustomDistribution;
    transactionEchRetryEchFailedCount: GleanCustomDistribution;
    transactionEchRetryOthersCount: GleanCustomDistribution;
    transactionWaitTimeHttp: GleanTimingDistribution;
    transactionWaitTimeSpdy: GleanTimingDistribution;
    transactionWaitTimeHttp3: GleanTimingDistribution;
    transactionWaitTimeHttp2SupHttp3: GleanTimingDistribution;
    tlsEarlyDataNegotiated: GleanCustomDistribution;
    tlsEarlyDataAccepted: Record<string, GleanCounter>;
    http2FailBeforeSettings: Record<string, GleanCounter>;
    cacheLmInconsistent: Record<string, GleanCounter>;
    dntUsage: GleanCustomDistribution;
    dnsHttpssvcRecordReceivingStage: GleanCustomDistribution;
    dnsHttpssvcConnectionFailedReason: GleanCustomDistribution;
    scriptBlockIncorrectMime: Record<string, GleanCounter>;
    echconfigSuccessRate: Record<string, GleanCounter>;
  }

  http3: {
    echOutcome: Record<string, GleanCustomDistribution>;
    connectionCloseCode: Record<string, GleanCustomDistribution>;
    timerDelayed: GleanTimingDistribution;
    requestPerConn: GleanCustomDistribution;
    blockedByStreamLimitPerConn: GleanCustomDistribution;
    transBlockedByStreamLimitPerConn: GleanCustomDistribution;
    transSendingBlockedByFlowControlPerConn: GleanCustomDistribution;
    sendingBlockedByFlowControlPerTrans: GleanCustomDistribution;
    lossRatio: GleanCustomDistribution;
    lateAckRatio: Record<string, GleanCustomDistribution>;
    lateAck: Record<string, GleanCustomDistribution>;
    countsPto: Record<string, GleanCustomDistribution>;
    dropDgrams: GleanCustomDistribution;
    savedDgrams: GleanCustomDistribution;
    receivedSentDgrams: Record<string, GleanCustomDistribution>;
  }

  websockets: {
    handshakeType: GleanCustomDistribution;
  }

  parsing: {
    svgUnusualPcdata: GleanRate;
  }

  ysod: {
    shownYsod: GleanEvent;
  }

  certVerifier: {
    crliteStatus: Record<string, GleanCounter>;
    crliteVsOcspResult: Record<string, GleanCounter>;
    certRevocationMechanisms: Record<string, GleanCounter>;
    trustObjCount: GleanQuantity;
  }

  certSignatureCache: {
    hits: GleanRate;
    total: GleanCounter;
  }

  certTrustCache: {
    hits: GleanRate;
    total: GleanCounter;
  }

  sctSignatureCache: {
    hits: GleanRate;
    total: GleanCounter;
  }

  certStorage: {
    memory: GleanMemoryDistribution;
  }

  dataStorage: {
    alternateServices: GleanQuantity;
    clientAuthRememberList: GleanQuantity;
    siteSecurityServiceState: GleanQuantity;
  }

  tls: {
    certificateVerifications: GleanCounter;
    xyberIntoleranceReason: Record<string, GleanCounter>;
    cipherSuite: GleanCustomDistribution;
  }

  certCompression: {
    failures: Record<string, GleanCounter>;
  }

  verificationUsedCertFrom: {
    tlsHandshake: GleanRate;
    preloadedIntermediates: GleanRate;
    thirdPartyCertificates: GleanRate;
    nssCertDb: GleanRate;
    builtInRootsModule: GleanRate;
  }

  pkcs11: {
    thirdPartyModulesLoaded: GleanQuantity;
    externalTrustAnchorModuleLoaded: GleanBoolean;
  }

  certVerificationTime: {
    success: GleanTimingDistribution;
    failure: GleanTimingDistribution;
  }

  ocspRequestTime: {
    success: GleanTimingDistribution;
    failure: GleanTimingDistribution;
    cancel: GleanTimingDistribution;
  }

  cert: {
    evStatus: GleanCustomDistribution;
    validationSuccessByCa: GleanCustomDistribution;
    chainKeySizeStatus: GleanCustomDistribution;
    validationHttpRequestResult: GleanCustomDistribution;
  }

  certPinning: {
    failuresByCa: GleanCustomDistribution;
    results: Record<string, GleanCounter>;
    testResults: Record<string, GleanCounter>;
    mozResultsByHost: GleanCustomDistribution;
    mozTestResultsByHost: GleanCustomDistribution;
  }

  sslHandshake: {
    version: GleanCustomDistribution;
    privacy: GleanCustomDistribution;
    result: GleanCustomDistribution;
    resultFirstTry: GleanCustomDistribution;
    resultConservative: GleanCustomDistribution;
    resultEch: GleanCustomDistribution;
    resultEchGrease: GleanCustomDistribution;
    completed: GleanCustomDistribution;
  }

  ssl: {
    timeUntilReady: GleanTimingDistribution;
    timeUntilReadyFirstTry: GleanTimingDistribution;
    timeUntilReadyConservative: GleanTimingDistribution;
    timeUntilReadyEch: GleanTimingDistribution;
    timeUntilReadyEchGrease: GleanTimingDistribution;
    timeUntilHandshakeFinishedKeyedByKa: Record<string, GleanTimingDistribution>;
    bytesBeforeCertCallback: GleanMemoryDistribution;
    npnType: GleanCustomDistribution;
    resumedSession: Record<string, GleanCounter>;
    keyExchangeAlgorithmFull: GleanCustomDistribution;
    keyExchangeAlgorithmResumed: GleanCustomDistribution;
    tls13IntoleranceReasonPre: GleanCustomDistribution;
    tls13IntoleranceReasonPost: GleanCustomDistribution;
    tls12IntoleranceReasonPre: GleanCustomDistribution;
    tls12IntoleranceReasonPost: GleanCustomDistribution;
    tls11IntoleranceReasonPre: GleanCustomDistribution;
    tls11IntoleranceReasonPost: GleanCustomDistribution;
    tls10IntoleranceReasonPre: GleanCustomDistribution;
    tls10IntoleranceReasonPost: GleanCustomDistribution;
    versionFallbackInappropriate: GleanCustomDistribution;
    keaRsaKeySizeFull: GleanCustomDistribution;
    keaDheKeySizeFull: GleanCustomDistribution;
    keaEcdheCurveFull: GleanCustomDistribution;
    authAlgorithmFull: GleanCustomDistribution;
    authRsaKeySizeFull: GleanCustomDistribution;
    authEcdsaCurveFull: GleanCustomDistribution;
    reasonsForNotFalseStarting: GleanCustomDistribution;
    ocspStapling: GleanCustomDistribution;
    certErrorOverrides: GleanCustomDistribution;
    certVerificationErrors: GleanCustomDistribution;
    ctPolicyNonCompliantConnectionsByCa: GleanCustomDistribution;
    permanentCertErrorOverrides: GleanCustomDistribution;
    sctsOrigin: GleanCustomDistribution;
    sctsPerConnection: GleanCustomDistribution;
    sctsVerificationStatus: GleanCustomDistribution;
  }

  sandbox: {
    rejectedSyscalls: Record<string, GleanCounter>;
    failedLaunchKeyed: Record<string, GleanCustomDistribution>;
    hasUserNamespaces: Record<string, GleanCounter>;
    effectiveContentProcessLevel: GleanQuantity;
    contentWin32kLockdownState: GleanQuantity;
  }

  uptakeRemotecontentResult: {
    uptakeRemotesettings: GleanEvent;
    uptakeNormandy: GleanEvent;
  }

  clientAssociation: {
    uid: GleanString;
    legacyClientId: GleanUuid;
  }

  fxa: {
    connectAccount: GleanEvent;
    disconnectAccount: GleanEvent;
    syncEnabled: GleanBoolean;
    accountEnabled: GleanBoolean;
  }

  syncSettings: {
    openChooseWhatToSyncMenu: GleanEvent;
    save: GleanEvent;
  }

  fxaAvatarMenu: {
    clickAccountSettings: GleanEvent;
    clickCad: GleanEvent;
    clickLogin: GleanEvent;
    clickSendTab: GleanEvent;
    clickSyncNow: GleanEvent;
    clickSyncSettings: GleanEvent;
    clickSyncTabs: GleanEvent;
    clickSyncTabsSidebar: GleanEvent;
    clickToolbarIcon: GleanEvent;
    clickUnverSyncSettings: GleanEvent;
    clickOpenMonitor: GleanEvent;
    clickOpenSend: GleanEvent;
    clickMonitorCta: GleanEvent;
    clickRelayCta: GleanEvent;
    clickVpnCta: GleanEvent;
    clickSyncCta: GleanEvent;
  }

  fxaAppMenu: {
    clickAccountSettings: GleanEvent;
    clickCad: GleanEvent;
    clickLogin: GleanEvent;
    clickSendTab: GleanEvent;
    clickSyncNow: GleanEvent;
    clickSyncSettings: GleanEvent;
    clickSyncTabs: GleanEvent;
    clickSyncTabsSidebar: GleanEvent;
    clickToolbarIcon: GleanEvent;
    clickUnverSyncSettings: GleanEvent;
    clickOpenMonitor: GleanEvent;
    clickOpenSend: GleanEvent;
    clickMonitorCta: GleanEvent;
    clickRelayCta: GleanEvent;
    clickVpnCta: GleanEvent;
    clickSyncCta: GleanEvent;
  }

  syncMergeDialog: {
    clicked: GleanEvent;
  }

  sync: {
    deviceCountDesktop: GleanCustomDistribution;
    deviceCountMobile: GleanCustomDistribution;
  }

  startupCache: {
    requests: Record<string, GleanCounter>;
  }

  bounceTrackingProtection: {
    purgeDuration: GleanTimingDistribution;
    numHostsPerPurgeRun: GleanCustomDistribution;
    purgeCount: Record<string, GleanCounter>;
    purgeAction: GleanEvent;
    mode: GleanQuantity;
    purgeCountClassifiedTracker: GleanCounter;
  }

  contentblocking: {
    category: GleanQuantity;
    cryptominingBlockingEnabled: GleanBoolean;
    fingerprintingBlockingEnabled: GleanBoolean;
    trackersBlockedCount: GleanCounter;
    canvasFingerprintingPerTab: Record<string, GleanCustomDistribution>;
    fontFingerprintingPerTab: Record<string, GleanCounter>;
    storageAccessGrantedCount: Record<string, GleanCounter>;
    storageAccessRemainingDays: GleanCustomDistribution;
    queryStrippingCount: Record<string, GleanCounter>;
    queryStrippingParamCount: GleanCustomDistribution;
    queryStrippingCountByParam: Record<string, GleanCounter>;
    emailTrackerCount: Record<string, GleanCounter>;
    emailTrackerEmbeddedPerTab: Record<string, GleanCustomDistribution>;
    stripOnShareParamsRemoved: GleanCustomDistribution;
    stripOnShareLengthDecrease: GleanCustomDistribution;
    cookieBehavior: GleanCustomDistribution;
    trackingProtectionEnabled: Record<string, GleanCounter>;
    trackingProtectionPbmDisabled: Record<string, GleanCounter>;
    trackingProtectionShield: GleanCustomDistribution;
    fingerprintersBlockedCount: Record<string, GleanCounter>;
    cryptominersBlockedCount: Record<string, GleanCounter>;
  }

  cookiePurging: {
    originsPurged: GleanCustomDistribution;
    trackersWithUserInteraction: GleanCustomDistribution;
    trackersUserInteractionRemainingDays: GleanTimingDistribution;
    duration: GleanTimingDistribution;
    intervalHours: GleanTimingDistribution;
  }

  hangs: {
    reports: GleanObject;
    modules: GleanObject;
  }

  backgroundTasksRmdirBase: {
    metricBase: GleanEvent;
    elapsedMs: GleanQuantity;
    wasFirst: GleanBoolean;
    retryCount: GleanQuantity;
    removalCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    suffixEverFailed: GleanBoolean;
  }

  backgroundTasksRmdirQuota: {
    metricBase: GleanEvent;
    elapsedMs: GleanQuantity;
    wasFirst: GleanBoolean;
    retryCount: GleanQuantity;
    removalCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    suffixEverFailed: GleanBoolean;
  }

  backgroundTasksRmdirHttpCache: {
    metricBase: GleanEvent;
    elapsedMs: GleanQuantity;
    wasFirst: GleanBoolean;
    retryCount: GleanQuantity;
    removalCount: GleanQuantity;
    succeeded: GleanBoolean;
    suffixRemovalCount: GleanQuantity;
    suffixEverFailed: GleanBoolean;
  }

  captchaDetection: {
    googleRecaptchaV2Oc: GleanCounter;
    googleRecaptchaV2Ps: GleanCounter;
    googleRecaptchaV2Pc: GleanCounter;
    googleRecaptchaV2Ac: GleanCounter;
    cloudflareTurnstileOc: GleanCounter;
    cloudflareTurnstileCc: GleanCounter;
    cloudflareTurnstileCf: GleanCounter;
    datadomeOc: GleanCounter;
    datadomePs: GleanCounter;
    datadomeBl: GleanCounter;
    datadomePc: GleanCounter;
    hcaptchaOc: GleanCounter;
    hcaptchaPs: GleanCounter;
    hcaptchaPc: GleanCounter;
    hcaptchaAc: GleanCounter;
    arkoselabsOc: GleanCounter;
    arkoselabsPs: GleanCounter;
    arkoselabsPc: GleanCounter;
    arkoselabsPf: GleanCounter;
    arkoselabsSolutionsRequired: GleanCustomDistribution;
    googleRecaptchaV2OcPbm: GleanCounter;
    googleRecaptchaV2PsPbm: GleanCounter;
    googleRecaptchaV2PcPbm: GleanCounter;
    googleRecaptchaV2AcPbm: GleanCounter;
    cloudflareTurnstileOcPbm: GleanCounter;
    cloudflareTurnstileCcPbm: GleanCounter;
    cloudflareTurnstileCfPbm: GleanCounter;
    datadomePsPbm: GleanCounter;
    datadomeBlPbm: GleanCounter;
    datadomePcPbm: GleanCounter;
    hcaptchaOcPbm: GleanCounter;
    hcaptchaPsPbm: GleanCounter;
    hcaptchaPcPbm: GleanCounter;
    hcaptchaAcPbm: GleanCounter;
    arkoselabsOcPbm: GleanCounter;
    arkoselabsPsPbm: GleanCounter;
    arkoselabsPcPbm: GleanCounter;
    arkoselabsPfPbm: GleanCounter;
    arkoselabsSolutionsRequiredPbm: GleanCustomDistribution;
    networkCookieCookiebehavior: GleanString;
    privacyTrackingprotectionEnabled: GleanBoolean;
    privacyTrackingprotectionCryptominingEnabled: GleanBoolean;
    privacyTrackingprotectionFingerprintingEnabled: GleanBoolean;
    privacyFingerprintingprotection: GleanBoolean;
    networkCookieCookiebehaviorOptinpartitioning: GleanBoolean;
    privacyResistfingerprinting: GleanBoolean;
    privacyTrackingprotectionPbmEnabled: GleanBoolean;
    privacyFingerprintingprotectionPbm: GleanBoolean;
    networkCookieCookiebehaviorOptinpartitioningPbm: GleanBoolean;
    privacyResistfingerprintingPbmode: GleanBoolean;
    pagesVisited: GleanCounter;
    pagesVisitedPbm: GleanCounter;
  }

  relevancyClassify: {
    succeed: GleanEvent;
    fail: GleanEvent;
    duration: GleanTimingDistribution;
  }

  cookieBanners: {
    normalWindowServiceMode: Record<string, GleanBoolean>;
    privateWindowServiceMode: Record<string, GleanBoolean>;
    serviceDetectOnly: GleanBoolean;
    googleGdprChoiceCookie: Record<string, GleanString>;
    googleGdprChoiceCookieEvent: GleanEvent;
    googleGdprChoiceCookieEventPbm: GleanEvent;
  }

  crash: {
    processType: GleanString;
    time: GleanDatetime;
    startup: GleanBoolean;
    appChannel: GleanString;
    appDisplayVersion: GleanString;
    appBuild: GleanString;
    minidumpSha256Hash: GleanString;
    stackTraces: GleanObject;
    asyncShutdownTimeout: GleanObject;
    backgroundTaskName: GleanString;
    eventLoopNestingLevel: GleanQuantity;
    fontName: GleanString;
    gpuProcessLaunch: GleanQuantity;
    ipcChannelError: GleanString;
    isGarbageCollecting: GleanBoolean;
    mainThreadRunnableName: GleanString;
    mozCrashReason: GleanString;
    profilerChildShutdownPhase: GleanString;
    quotaManagerShutdownTimeout: GleanObject;
    remoteType: GleanString;
    utilityActorsName: GleanStringList;
    shutdownProgress: GleanString;
    compressedStoreSize: GleanMemoryDistribution;
    submitAttempt: Record<string, GleanCounter>;
  }

  crashWindows: {
    errorReporting: GleanBoolean;
    fileDialogErrorCode: GleanString;
  }

  windows: {
    packageFamilyName: GleanString;
  }

  memory: {
    availableCommit: GleanQuantity;
    availablePhysical: GleanQuantity;
    availableSwap: GleanQuantity;
    availableVirtual: GleanQuantity;
    jsLargeAllocationFailure: GleanString;
    jsOutOfMemory: GleanString;
    lowPhysical: GleanQuantity;
    oomAllocationSize: GleanQuantity;
    purgeablePhysical: GleanQuantity;
    systemUsePercentage: GleanQuantity;
    texture: GleanQuantity;
    totalPageFile: GleanQuantity;
    totalPhysical: GleanQuantity;
    totalVirtual: GleanQuantity;
    residentFast: GleanMemoryDistribution;
    residentPeak: GleanMemoryDistribution;
    total: GleanMemoryDistribution;
    distributionAmongContent: Record<string, GleanCustomDistribution>;
    unique: GleanMemoryDistribution;
    vsize: GleanMemoryDistribution;
    vsizeMaxContiguous: GleanMemoryDistribution;
    jsCompartmentsSystem: GleanCustomDistribution;
    jsCompartmentsUser: GleanCustomDistribution;
    jsRealmsSystem: GleanCustomDistribution;
    jsRealmsUser: GleanCustomDistribution;
    jsGcHeap: GleanMemoryDistribution;
    storageSqlite: GleanMemoryDistribution;
    imagesContentUsedUncompressed: GleanMemoryDistribution;
    heapAllocated: GleanMemoryDistribution;
    heapOverheadFraction: GleanCustomDistribution;
    ghostWindows: GleanCustomDistribution;
    lowMemoryEventsPhysical: GleanCustomDistribution;
    pageFaultsHard: GleanCustomDistribution;
    collectionTime: GleanTimingDistribution;
    freePurgedPages: GleanTimingDistribution;
    uniqueContentStartup: GleanMemoryDistribution;
  }

  dllBlocklist: {
    list: GleanStringList;
    initFailed: GleanBoolean;
    user32LoadedBefore: GleanBoolean;
  }

  environment: {
    nimbusEnrollments: GleanStringList;
    headlessMode: GleanBoolean;
    uptime: GleanTimespan;
  }

  crashSubmission: {
    success: GleanCounter;
    failure: GleanCounter;
    pending: GleanCounter;
    collectorErrors: Record<string, GleanCounter>;
    channelStatus: Record<string, GleanCounter>;
  }

  doh: {
    evaluateV2Heuristics: GleanEvent;
    stateEnabled: GleanEvent;
    stateDisabled: GleanEvent;
    stateManuallyDisabled: GleanEvent;
    statePolicyDisabled: GleanEvent;
    stateUninstalled: GleanEvent;
    stateUiok: GleanEvent;
    stateUidisabled: GleanEvent;
    stateRollback: GleanEvent;
    stateShutdown: GleanEvent;
  }

  securityDohTrrPerformance: {
    resolvedRecord: GleanEvent;
    trrselectDryrunresult: GleanEvent;
  }

  policies: {
    count: GleanQuantity;
    isEnterprise: GleanBoolean;
  }

  extensions: {
    useRemotePref: GleanBoolean;
    useRemotePolicy: GleanBoolean;
    startupCacheLoadTime: GleanTimespan;
    startupCacheReadErrors: Record<string, GleanCounter>;
    startupCacheWriteBytelength: GleanQuantity;
    processEvent: Record<string, GleanCounter>;
  }

  extensionsApisDnr: {
    startupCacheReadSize: GleanMemoryDistribution;
    startupCacheReadTime: GleanTimingDistribution;
    startupCacheWriteSize: GleanMemoryDistribution;
    startupCacheWriteTime: GleanTimingDistribution;
    startupCacheEntries: Record<string, GleanCounter>;
    validateRulesTime: GleanTimingDistribution;
    evaluateRulesTime: GleanTimingDistribution;
    evaluateRulesCountMax: GleanQuantity;
  }

  extensionsData: {
    migrateResult: GleanEvent;
    storageLocalError: GleanEvent;
    syncUsageQuotas: GleanEvent;
    migrateResultCount: Record<string, GleanCounter>;
  }

  extensionsCounters: {
    browserActionPreloadResult: Record<string, GleanCounter>;
    eventPageIdleResult: Record<string, GleanCounter>;
  }

  extensionsTiming: {
    backgroundPageLoad: GleanTimingDistribution;
    backgroundPageLoadByAddonid: Record<string, GleanTimingDistribution>;
    browserActionPopupOpen: GleanTimingDistribution;
    browserActionPopupOpenByAddonid: Record<string, GleanTimingDistribution>;
    contentScriptInjection: GleanTimingDistribution;
    contentScriptInjectionByAddonid: Record<string, GleanTimingDistribution>;
    eventPageRunningTime: GleanCustomDistribution;
    eventPageRunningTimeByAddonid: Record<string, GleanTimingDistribution>;
    extensionStartup: GleanTimingDistribution;
    extensionStartupByAddonid: Record<string, GleanTimingDistribution>;
    pageActionPopupOpen: GleanTimingDistribution;
    pageActionPopupOpenByAddonid: Record<string, GleanTimingDistribution>;
    storageLocalGetIdb: GleanTimingDistribution;
    storageLocalGetIdbByAddonid: Record<string, GleanTimingDistribution>;
    storageLocalSetIdb: GleanTimingDistribution;
    storageLocalSetIdbByAddonid: Record<string, GleanTimingDistribution>;
  }

  formautofillCreditcards: {
    autofillProfilesCount: GleanQuantity;
  }

  formautofill: {
    formSubmissionHeuristic: Record<string, GleanCounter>;
    iframeLayoutDetection: GleanEvent;
    availability: GleanBoolean;
    promptShownOsReauth: GleanEvent;
    requireOsReauthToggle: GleanEvent;
    osAuthEnabled: GleanBoolean;
  }

  address: {
    showCaptureDoorhanger: GleanEvent;
    showUpdateDoorhanger: GleanEvent;
    showEditDoorhanger: GleanEvent;
    saveCaptureDoorhanger: GleanEvent;
    saveUpdateDoorhanger: GleanEvent;
    saveEditDoorhanger: GleanEvent;
    updateCaptureDoorhanger: GleanEvent;
    updateUpdateDoorhanger: GleanEvent;
    updateEditDoorhanger: GleanEvent;
    cancelCaptureDoorhanger: GleanEvent;
    cancelUpdateDoorhanger: GleanEvent;
    cancelEditDoorhanger: GleanEvent;
    disableCaptureDoorhanger: GleanEvent;
    disableUpdateDoorhanger: GleanEvent;
    disableEditDoorhanger: GleanEvent;
    prefCaptureDoorhanger: GleanEvent;
    prefUpdateDoorhanger: GleanEvent;
    prefEditDoorhanger: GleanEvent;
    learnMoreCaptureDoorhanger: GleanEvent;
    learnMoreUpdateDoorhanger: GleanEvent;
    learnMoreEditDoorhanger: GleanEvent;
    showManage: GleanEvent;
    addManage: GleanEvent;
    deleteManage: GleanEvent;
    showEntryManage: GleanEvent;
    editManage: GleanEvent;
    detectedAddressForm: GleanEvent;
    popupShownAddressForm: GleanEvent;
    filledAddressForm: GleanEvent;
    filledOnFieldsUpdateAddressForm: GleanEvent;
    filledModifiedAddressForm: GleanEvent;
    submittedAddressForm: GleanEvent;
    clearedAddressForm: GleanEvent;
    detectedAddressFormExt: GleanEvent;
    filledAddressFormExt: GleanEvent;
    submittedAddressFormExt: GleanEvent;
  }

  creditcard: {
    showCaptureDoorhanger: GleanEvent;
    showUpdateDoorhanger: GleanEvent;
    saveCaptureDoorhanger: GleanEvent;
    saveUpdateDoorhanger: GleanEvent;
    updateCaptureDoorhanger: GleanEvent;
    updateUpdateDoorhanger: GleanEvent;
    cancelCaptureDoorhanger: GleanEvent;
    cancelUpdateDoorhanger: GleanEvent;
    disableCaptureDoorhanger: GleanEvent;
    disableUpdateDoorhanger: GleanEvent;
    showManage: GleanEvent;
    addManage: GleanEvent;
    deleteManage: GleanEvent;
    showEntryManage: GleanEvent;
    editManage: GleanEvent;
    detectedCcFormV2: GleanEvent;
    popupShownCcFormV2: GleanEvent;
    filledCcFormV2: GleanEvent;
    filledOnFieldsUpdateCcFormV2: GleanEvent;
    filledModifiedCcFormV2: GleanEvent;
    submittedCcFormV2: GleanEvent;
    clearedCcFormV2: GleanEvent;
    detectedCcNumberFieldsCount: Record<string, GleanCounter>;
    osKeystoreDecrypt: GleanEvent;
  }

  formautofillMl: {
    fieldInferResult: GleanEvent;
  }

  formautofillAddresses: {
    autofillProfilesCount: GleanQuantity;
  }

  fog: {
    initialization: GleanTimespan;
    failedIdleRegistration: GleanBoolean;
    initsDuringShutdown: GleanCounter;
    maxPingsPerMinute: GleanQuantity;
  }

  fogIpc: {
    replayFailures: GleanCounter;
    bufferSizes: GleanMemoryDistribution;
    flushDurations: GleanTimingDistribution;
    flushFailures: GleanCounter;
    shutdownRegistrationFailures: GleanCounter;
  }

  testOnly: {
    badCode: GleanCounter;
    canWeTimeIt: GleanTimespan;
    cheesyString: GleanString;
    cheesyStringList: GleanStringList;
    whatADate: GleanDatetime;
    whatIdIt: GleanUuid;
    canWeFlagIt: GleanBoolean;
    doYouRemember: GleanMemoryDistribution;
    whatTimeIsIt: GleanTimingDistribution;
    mabelsKitchenCounters: Record<string, GleanCounter>;
    mabelsLabeledCounters: Record<string, GleanCounter>;
    mabelsBathroomCounters: Record<string, GleanCounter>;
    mabelsLikeBalloons: Record<string, GleanBoolean>;
    mabelsLikeLabeledBalloons: Record<string, GleanBoolean>;
    mabelsBalloonStrings: Record<string, GleanString>;
    mabelsBalloonLabels: Record<string, GleanString>;
    mabelsLabelMaker: Record<string, GleanString>;
    mabelsCustomLabelLengths: Record<string, GleanCustomDistribution>;
    whatDoYouRemember: Record<string, GleanMemoryDistribution>;
    whereHasTheTimeGone: Record<string, GleanTimingDistribution>;
    buttonJars: Record<string, GleanQuantity>;
    mirrorTime: GleanTimespan;
    mirrorTimeNanos: GleanTimespan;
    mirrorsForLabeledBools: Record<string, GleanBoolean>;
    onePingOneBool: GleanBoolean;
    meaningOfLife: GleanQuantity;
    balloons: GleanObject;
    crashStack: GleanObject;
    mainOnly: GleanQuantity;
    impressionIdOnly: GleanString;
    expired: GleanCounter;
    keyedExpired: Record<string, GleanCounter>;
    unexpired: GleanCounter;
    releaseOptin: GleanCounter;
    releaseOptout: GleanCounter;
    keyedReleaseOptin: Record<string, GleanCounter>;
    keyedReleaseOptout: Record<string, GleanCounter>;
    defaultProducts: GleanCounter;
    desktopOnly: GleanCounter;
    multiproduct: GleanCounter;
    mobileOnly: GleanCounter;
    keyedMobileOnly: Record<string, GleanCounter>;
    disabledCounter: GleanCounter;
    collectionDisabledCounter: GleanCounter;
    expiredHist: GleanCustomDistribution;
  }

  testOnlyIpc: {
    aCounter: GleanCounter;
    aCounterForHgram: GleanCounter;
    aLabeledCounterForHgram: Record<string, GleanCounter>;
    aLabeledCounterForKeyedCountHgram: Record<string, GleanCounter>;
    aLabeledCounterForCategorical: Record<string, GleanCounter>;
    anUnorderedBool: GleanBoolean;
    aBool: GleanBoolean;
    anUnorderedLabeledBoolean: Record<string, GleanBoolean>;
    aDate: GleanDatetime;
    aString: GleanString;
    aText: GleanText;
    aMemoryDist: GleanMemoryDistribution;
    aTimingDist: GleanTimingDistribution;
    aCustomDist: GleanCustomDistribution;
    aStringList: GleanStringList;
    anEvent: GleanEvent;
    eventWithExtra: GleanEvent;
    noExtraEvent: GleanEvent;
    aUuid: GleanUuid;
    aLabeledCounter: Record<string, GleanCounter>;
    anotherLabeledCounter: Record<string, GleanCounter>;
    aQuantity: GleanQuantity;
    irate: GleanRate;
    rateWithExternalDenominator: GleanRate;
    anExternalDenominator: GleanCounter;
    aUrl: GleanUrl;
  }

  testOnlyJog: {
    aCounter: GleanCounter;
    anEvent: GleanEvent;
  }

  mediaSniffer: {
    mp4BrandPattern: Record<string, GleanCounter>;
  }

  messagingExperiments: {
    targetingAttributeError: GleanEvent;
    targetingAttributeTimeout: GleanEvent;
    reachCfr: GleanEvent;
    reachMomentsPage: GleanEvent;
    reachInfobar: GleanEvent;
    reachSpotlight: GleanEvent;
    reachFeatureCallout: GleanEvent;
    reachFxmsBmbButton: GleanEvent;
    reachFxmsMessage1: GleanEvent;
    reachFxmsMessage2: GleanEvent;
    reachFxmsMessage3: GleanEvent;
    reachFxmsMessage4: GleanEvent;
    reachFxmsMessage5: GleanEvent;
    reachFxmsMessage6: GleanEvent;
    reachFxmsMessage7: GleanEvent;
    reachFxmsMessage8: GleanEvent;
    reachFxmsMessage9: GleanEvent;
    reachFxmsMessage10: GleanEvent;
    reachFxmsMessage11: GleanEvent;
    reachFxmsMessage12: GleanEvent;
    reachFxmsMessage13: GleanEvent;
    reachFxmsMessage14: GleanEvent;
    reachFxmsMessage15: GleanEvent;
  }

  firefoxAiRuntime: {
    engineCreationSuccess: Record<string, GleanTimingDistribution>;
    engineCreationFailure: GleanEvent;
    runInferenceFailure: GleanEvent;
    runInferenceSuccess: Record<string, GleanTimingDistribution>;
    modelDownload: GleanEvent;
    modelDeletion: GleanEvent;
  }

  modelManagement: {
    removeInitiated: GleanEvent;
    removeConfirmation: GleanEvent;
    listItemManage: GleanEvent;
    modelCardLink: GleanEvent;
    listView: GleanEvent;
    detailsView: GleanEvent;
  }

  nimbusTargetingEnvironment: {
    targetingContextValue: GleanText;
    prefTypeErrors: Record<string, GleanCounter>;
    attrEvalErrors: Record<string, GleanCounter>;
    userSetPrefs: GleanObject;
    prefValues: GleanObject;
  }

  nimbusTargetingContext: {
    activeExperiments: GleanObject;
    activeRollouts: GleanObject;
    addonsInfo: GleanObject;
    addressesSaved: GleanQuantity;
    archBits: GleanQuantity;
    attributionData: GleanObject;
    browserSettings: GleanObject;
    buildId: GleanQuantity;
    currentDate: GleanString;
    defaultPdfHandler: GleanObject;
    distributionId: GleanString;
    doesAppNeedPin: GleanBoolean;
    enrollmentsMap: GleanObject;
    firefoxVersion: GleanQuantity;
    hasActiveEnterprisePolicies: GleanBoolean;
    homePageSettings: GleanObject;
    isDefaultBrowser: GleanBoolean;
    isDefaultHandler: GleanObject;
    isFirstStartup: GleanBoolean;
    isFxAEnabled: GleanBoolean;
    isFxASignedIn: GleanBoolean;
    isMsix: GleanBoolean;
    locale: GleanString;
    memoryMb: GleanQuantity;
    os: GleanObject;
    primaryResolution: GleanObject;
    profileAgeCreated: GleanQuantity;
    region: GleanString;
    totalBookmarksCount: GleanQuantity;
    userMonthlyActivity: GleanObject;
    userPrefersReducedMotion: GleanBoolean;
    usesFirefoxSync: GleanBoolean;
    version: GleanString;
  }

  nimbusEvents: {
    enrollment: GleanEvent;
    enrollFailed: GleanEvent;
    unenrollment: GleanEvent;
    unenrollFailed: GleanEvent;
    exposure: GleanEvent;
    validationFailed: GleanEvent;
    isReady: GleanEvent;
    enrollmentStatus: GleanEvent;
    migration: GleanEvent;
  }

  normandy: {
    exposeNimbusExperiment: GleanEvent;
    enrollPreferenceStudy: GleanEvent;
    enrollAddonStudy: GleanEvent;
    enrollPreferenceRollout: GleanEvent;
    enrollAddonRollout: GleanEvent;
    enrollNimbusExperiment: GleanEvent;
    enrollFailedAddonStudy: GleanEvent;
    enrollFailedPreferenceRollout: GleanEvent;
    enrollFailedPreferenceStudy: GleanEvent;
    enrollFailedAddonRollout: GleanEvent;
    enrollFailedNimbusExperiment: GleanEvent;
    updateAddonStudy: GleanEvent;
    updatePreferenceRollout: GleanEvent;
    updateAddonRollout: GleanEvent;
    updateNimbusExperiment: GleanEvent;
    updateFailedAddonStudy: GleanEvent;
    updateFailedAddonRollout: GleanEvent;
    unenrollPreferenceStudy: GleanEvent;
    unenrollAddonStudy: GleanEvent;
    unenrollPreferenceRollback: GleanEvent;
    unenrollAddonRollback: GleanEvent;
    unenrollNimbusExperiment: GleanEvent;
    unenrollFailedPreferenceRollback: GleanEvent;
    unenrollFailedPreferenceStudy: GleanEvent;
    unenrollFailedAddonRollback: GleanEvent;
    unenrollFailedNimbusExperiment: GleanEvent;
    graduatePreferenceRollout: GleanEvent;
    expPrefChangedPreferenceStudy: GleanEvent;
    validationFailedNimbusExperiment: GleanEvent;
    recipeFreshness: Record<string, GleanQuantity>;
  }

  heartbeat: {
    flowId: GleanUuid;
    offered: GleanDatetime;
    learnMore: GleanDatetime;
    voted: GleanDatetime;
    engaged: GleanDatetime;
    closed: GleanDatetime;
    expired: GleanDatetime;
    windowClosed: GleanDatetime;
    score: GleanQuantity;
    surveyId: GleanString;
  }

  pwmgr: {
    formAutofillResult: Record<string, GleanCounter>;
    autocompleteFieldGeneratedpassword: GleanEvent;
    autocompleteShownGeneratedpassword: GleanEvent;
    filledFieldEditedGeneratedpassword: GleanEvent;
    doorhangerSubmittedSave: GleanEvent;
    doorhangerSubmittedUpdate: GleanEvent;
    savedLoginUsedFormLogin: GleanEvent;
    savedLoginUsedFormPassword: GleanEvent;
    savedLoginUsedAuthLogin: GleanEvent;
    savedLoginUsedPromptLogin: GleanEvent;
    mgmtMenuItemUsedImportFromBrowser: GleanEvent;
    mgmtMenuItemUsedImportFromCsv: GleanEvent;
    mgmtMenuItemUsedImportCsvComplete: GleanEvent;
    mgmtMenuItemUsedExport: GleanEvent;
    mgmtMenuItemUsedExportComplete: GleanEvent;
    mgmtMenuItemUsedPreferences: GleanEvent;
    reauthenticateMasterPassword: GleanEvent;
    reauthenticateOsAuth: GleanEvent;
    promptShownOsReauth: GleanEvent;
    requireOsReauthToggle: GleanEvent;
    osAuthEnabled: GleanBoolean;
    openManagementAboutprotections: GleanEvent;
    openManagementAutocomplete: GleanEvent;
    openManagementContextmenu: GleanEvent;
    openManagementDirect: GleanEvent;
    openManagementMainmenu: GleanEvent;
    openManagementPageinfo: GleanEvent;
    openManagementPreferences: GleanEvent;
    openManagementSnippet: GleanEvent;
    cancelExistingLogin: GleanEvent;
    cancelNewLogin: GleanEvent;
    copyPassword: GleanEvent;
    copyUsername: GleanEvent;
    deleteExistingLogin: GleanEvent;
    deleteNewLogin: GleanEvent;
    editExistingLogin: GleanEvent;
    filterList: GleanEvent;
    hidePassword: GleanEvent;
    learnMoreVulnExistingLogin: GleanEvent;
    newNewLogin: GleanEvent;
    openSiteExistingLogin: GleanEvent;
    saveExistingLogin: GleanEvent;
    saveNewLogin: GleanEvent;
    selectExistingLogin: GleanEvent;
    showPassword: GleanEvent;
    sortList: GleanEvent;
    potentiallyBreachedPasswords: GleanQuantity;
    numSavedPasswords: GleanQuantity;
    savingEnabled: GleanBoolean;
    importLoginsFromFileCategorical: Record<string, GleanCounter>;
    loginPageSafety: GleanCustomDistribution;
    numImprovedGeneratedPasswords: Record<string, GleanCounter>;
    promptRememberAction: GleanCustomDistribution;
    promptUpdateAction: GleanCustomDistribution;
    isUsernameOnlyForm: Record<string, GleanCounter>;
    signupFormDetection: GleanTimingDistribution;
  }

  formAutocomplete: {
    showLogins: GleanEvent;
  }

  relayIntegration: {
    enabledPrefChange: GleanEvent;
    disabledPrefChange: GleanEvent;
    shownOfferRelay: GleanEvent;
    clickedOfferRelay: GleanEvent;
    shownFillUsername: GleanEvent;
    clickedFillUsername: GleanEvent;
    shownReusePanel: GleanEvent;
    getUnlimitedMasksReusePanel: GleanEvent;
    reuseMaskReusePanel: GleanEvent;
    shownOptInPanel: GleanEvent;
    enabledOptInPanel: GleanEvent;
    postponedOptInPanel: GleanEvent;
    disabledOptInPanel: GleanEvent;
  }

  pdfjs: {
    editing: Record<string, GleanCounter>;
    stamp: Record<string, GleanCounter>;
    buttons: Record<string, GleanCounter>;
    geckoview: Record<string, GleanCounter>;
    used: GleanCounter;
    timeToView: GleanCustomDistribution;
  }

  pdfjsEditingHighlight: {
    kind: Record<string, GleanCounter>;
    method: Record<string, GleanCounter>;
    color: Record<string, GleanCounter>;
    colorChanged: GleanCounter;
    numberOfColors: Record<string, GleanCounter>;
    thickness: GleanCustomDistribution;
    thicknessChanged: GleanCounter;
    save: GleanCounter;
    print: GleanCounter;
    edited: GleanCounter;
    deleted: GleanCounter;
    toggleVisibility: GleanCounter;
  }

  pdfjsImageAltText: {
    calloutDisplayed: GleanEvent;
    calloutDismissed: GleanEvent;
    info: GleanEvent;
    aiGenerationCheck: GleanEvent;
    settingsDisplayed: GleanEvent;
    settingsAiGenerationCheck: GleanEvent;
    settingsEditAltTextCheck: GleanEvent;
    save: GleanEvent;
    dismiss: GleanEvent;
    modelDownloadStart: GleanEvent;
    modelDownloadComplete: GleanEvent;
    modelDownloadError: GleanEvent;
    modelDeleted: GleanEvent;
    modelResult: GleanEvent;
    userEdit: GleanEvent;
    imageStatusLabelDisplayed: GleanEvent;
    imageStatusLabelClicked: GleanEvent;
  }

  pdfjsImage: {
    iconClick: GleanEvent;
    addImageClick: GleanEvent;
    imageSelected: GleanEvent;
    imageAdded: GleanEvent;
    altTextEdit: Record<string, GleanBoolean>;
    added: Record<string, GleanCounter>;
  }

  pdfjsSignature: {
    clear: Record<string, GleanCounter>;
    deleteSaved: GleanEvent;
    created: GleanEvent;
    added: GleanEvent;
    inserted: GleanEvent;
    editDescription: Record<string, GleanCounter>;
  }

  pictureinpictureSettings: {
    enableSettings: GleanEvent;
    enableAutotriggerSettings: GleanEvent;
    disablePlayer: GleanEvent;
    disableSettings: GleanEvent;
  }

  pictureinpicture: {
    createPlayer: GleanEvent;
    resizePlayer: GleanEvent;
    sawToggleToggle: GleanEvent;
    openedMethodToggle: GleanEvent;
    openedMethodContextMenu: GleanEvent;
    openedMethodUrlBar: GleanEvent;
    openedMethodShortcut: GleanEvent;
    openedMethodAutoPip: GleanEvent;
    closedMethodCloseButton: GleanEvent;
    closedMethodUnpip: GleanEvent;
    closedMethodPagehide: GleanEvent;
    closedMethodForegrounded: GleanEvent;
    closedMethodFullscreen: GleanEvent;
    closedMethodSetupFailure: GleanEvent;
    closedMethodClosePlayerShortcut: GleanEvent;
    closedMethodContextMenu: GleanEvent;
    closedMethodVideoElRemove: GleanEvent;
    closedMethodVideoElEmptied: GleanEvent;
    closedMethodUrlBar: GleanEvent;
    closedMethodShortcut: GleanEvent;
    closedMethodBrowserCrash: GleanEvent;
    subtitlesShownSubtitles: GleanEvent;
    fullscreenPlayer: GleanEvent;
    disrespectDisableUrlBar: GleanEvent;
    mostConcurrentPlayers: GleanQuantity;
    toggleEnabled: GleanBoolean;
    windowOpenDuration: GleanTimingDistribution;
    backgroundTabPlayingDuration: GleanTimingDistribution;
    foregroundTabPlayingDuration: GleanTimingDistribution;
  }

  places: {
    placesDatabaseCorruptionHandlingStage: Record<string, GleanString>;
    sponsoredVisitNoTriggeringUrl: GleanCounter;
    pagesNeedFrecencyRecalculation: GleanQuantity;
    previousdayVisits: GleanQuantity;
    pagesCount: GleanCustomDistribution;
    mostRecentExpiredVisit: GleanTimingDistribution;
    bookmarksCount: GleanCustomDistribution;
    tagsCount: GleanCustomDistribution;
    keywordsCount: GleanCustomDistribution;
    backupsDaysfromlast: GleanTimingDistribution;
    backupsBookmarkstree: GleanTimingDistribution;
    backupsTojson: GleanTimingDistribution;
    exportTohtml: GleanTimingDistribution;
    sortedBookmarksPerc: GleanCustomDistribution;
    taggedBookmarksPerc: GleanCustomDistribution;
    databaseFilesize: GleanMemoryDistribution;
    databaseFaviconsFilesize: GleanMemoryDistribution;
    expirationStepsToClean: GleanCustomDistribution;
    idleFrecencyDecayTime: GleanTimingDistribution;
    idleMaintenanceTime: GleanTimingDistribution;
    frecencyRecalcChunkTime: GleanTimingDistribution;
    annosPagesCount: GleanCustomDistribution;
    maintenanceDaysfromlast: GleanTimingDistribution;
  }

  pageIcon: {
    smallIconCount: GleanCounter;
    fitIconCount: GleanCounter;
  }

  printing: {
    dialogOpenedViaPreviewTm: GleanCounter;
    dialogViaPreviewCancelledTm: GleanCounter;
    error: Record<string, GleanCounter>;
    previewOpenedTm: GleanCounter;
    previewCancelledTm: GleanCounter;
    settingsChanged: Record<string, GleanCounter>;
    silentPrint: GleanCounter;
    targetType: Record<string, GleanCounter>;
  }

  power: {
    cpuTimeBogusValues: GleanCounter;
    cpuTimePerProcessTypeMs: Record<string, GleanCounter>;
    cpuTimePerTrackerTypeMs: Record<string, GleanCounter>;
    gpuTimePerProcessTypeMs: Record<string, GleanCounter>;
    gpuTimeBogusValues: GleanCounter;
    energyPerProcessType: Record<string, GleanCounter>;
    wakeupsPerProcessType: Record<string, GleanCounter>;
    totalCpuTimeMs: GleanCounter;
    totalGpuTimeMs: GleanCounter;
    totalThreadWakeups: GleanCounter;
  }

  powerWakeupsPerThread: {
    parentActive: Record<string, GleanCounter>;
    parentInactive: Record<string, GleanCounter>;
    contentForeground: Record<string, GleanCounter>;
    contentBackground: Record<string, GleanCounter>;
    gpuProcess: Record<string, GleanCounter>;
  }

  powerCpuMsPerThread: {
    parentActive: Record<string, GleanCounter>;
    parentInactive: Record<string, GleanCounter>;
    contentForeground: Record<string, GleanCounter>;
    contentBackground: Record<string, GleanCounter>;
    gpuProcess: Record<string, GleanCounter>;
  }

  powerBattery: {
    percentageWhenUserActive: GleanCustomDistribution;
  }

  readermode: {
    viewOn: GleanEvent;
    viewOff: GleanEvent;
    buttonClick: GleanEvent;
    parseResult: GleanCustomDistribution;
    downloadResult: GleanCustomDistribution;
  }

  brokenSiteReport: {
    breakageCategory: GleanString;
    description: GleanText;
    url: GleanUrl;
  }

  brokenSiteReportTabInfo: {
    languages: GleanStringList;
    useragentString: GleanText;
  }

  brokenSiteReportTabInfoAntitracking: {
    blockList: GleanString;
    hasMixedActiveContentBlocked: GleanBoolean;
    hasMixedDisplayContentBlocked: GleanBoolean;
    hasTrackingContentBlocked: GleanBoolean;
    isPrivateBrowsing: GleanBoolean;
    btpHasPurgedSite: GleanBoolean;
    etpCategory: GleanString;
  }

  brokenSiteReportTabInfoFrameworks: {
    fastclick: GleanBoolean;
    marfeel: GleanBoolean;
    mobify: GleanBoolean;
  }

  brokenSiteReportBrowserInfo: {
    addons: GleanObject;
    experiments: GleanObject;
  }

  brokenSiteReportBrowserInfoApp: {
    defaultLocales: GleanStringList;
    defaultUseragentString: GleanText;
    fissionEnabled: GleanBoolean;
  }

  brokenSiteReportBrowserInfoGraphics: {
    devicePixelRatio: GleanString;
    hasTouchScreen: GleanBoolean;
    devicesJson: GleanText;
    driversJson: GleanText;
    featuresJson: GleanText;
    monitorsJson: GleanText;
  }

  brokenSiteReportBrowserInfoSystem: {
    isTablet: GleanBoolean;
    memory: GleanQuantity;
  }

  brokenSiteReportBrowserInfoPrefs: {
    opaqueResponseBlocking: GleanBoolean;
    installtriggerEnabled: GleanBoolean;
    softwareWebrender: GleanBoolean;
    forcedAcceleratedLayers: GleanBoolean;
    cookieBehavior: GleanQuantity;
    globalPrivacyControlEnabled: GleanBoolean;
    h1InSectionUseragentStylesEnabled: GleanBoolean;
    resistFingerprintingEnabled: GleanBoolean;
    thirdPartyCookieBlockingEnabled: GleanBoolean;
    thirdPartyCookieBlockingEnabledInPbm: GleanBoolean;
  }

  brokenSiteReportBrowserInfoSecurity: {
    antivirus: GleanStringList;
    antispyware: GleanStringList;
    firewall: GleanStringList;
  }

  webcompatreporting: {
    opened: GleanEvent;
    reasonDropdown: GleanEvent;
    send: GleanEvent;
    sendMoreInfo: GleanEvent;
  }

  applicationReputation: {
    binaryType: Record<string, GleanCounter>;
    binaryArchive: Record<string, GleanCounter>;
    shouldBlock: Record<string, GleanCounter>;
    local: GleanCustomDistribution;
    server: GleanCustomDistribution;
    server2: Record<string, GleanCounter>;
    serverVerdict: GleanCustomDistribution;
    remoteLookupResponseTime: GleanTimingDistribution;
    remoteLookupTimeout: Record<string, GleanCounter>;
    reason: Record<string, GleanCounter>;
  }

  fingerprintingProtection: {
    canvasNoiseCalculateTime2: GleanTimingDistribution;
  }

  characteristics: {
    clientIdentifier: GleanUuid;
    submissionSchema: GleanQuantity;
    maxTouchPoints: GleanQuantity;
    prefersReducedTransparency: GleanBoolean;
    prefersReducedMotion: GleanBoolean;
    prefersContrast: GleanQuantity;
    invertedColors: GleanBoolean;
    colorScheme: GleanQuantity;
    colorAccentcolor: GleanQuantity;
    colorAccentcolortext: GleanQuantity;
    colorCanvas: GleanQuantity;
    colorCanvastext: GleanQuantity;
    colorHighlight: GleanQuantity;
    colorHighlighttext: GleanQuantity;
    colorSelecteditem: GleanQuantity;
    colorSelecteditemtext: GleanQuantity;
    useDocumentColors: GleanBoolean;
    missingFonts: GleanText;
    processorCount: GleanQuantity;
    timezone: GleanString;
    systemLocale: GleanString;
    targetFrameRate: GleanQuantity;
    gamepads: GleanStringList;
    prefsIntlAcceptLanguages: GleanString;
    prefsMediaEmeEnabled: GleanBoolean;
    prefsZoomTextOnly: GleanBoolean;
    prefsPrivacyDonottrackheaderEnabled: GleanBoolean;
    prefsPrivacyGlobalprivacycontrolEnabled: GleanBoolean;
    prefsGeneralAutoscroll: GleanBoolean;
    prefsGeneralSmoothscroll: GleanBoolean;
    prefsOverlayScrollbars: GleanBoolean;
    prefsBlockPopups: GleanBoolean;
    prefsBrowserDisplayUseDocumentFonts: GleanBoolean;
    fontDefaultWestern: GleanString;
    fontDefaultDefaultGroup: GleanString;
    fontDefaultModified: GleanQuantity;
    fontNameSerifWestern: GleanString;
    fontNameSerifDefaultGroup: GleanString;
    fontNameSerifModified: GleanQuantity;
    fontNameSansSerifWestern: GleanString;
    fontNameSansSerifDefaultGroup: GleanString;
    fontNameSansSerifModified: GleanQuantity;
    fontNameMonospaceWestern: GleanString;
    fontNameMonospaceDefaultGroup: GleanString;
    fontNameMonospaceModified: GleanQuantity;
    fontSizeVariableWestern: GleanString;
    fontSizeVariableDefaultGroup: GleanString;
    fontSizeVariableModified: GleanQuantity;
    fontSizeMonospaceWestern: GleanString;
    fontSizeMonospaceDefaultGroup: GleanString;
    canvasdata1: GleanString;
    canvasdata2: GleanString;
    canvasdata3: GleanString;
    canvasdata4: GleanString;
    canvasdata5: GleanString;
    canvasdata6: GleanString;
    canvasdata7: GleanString;
    canvasdata8: GleanString;
    canvasdata9: GleanString;
    canvasdata10: GleanString;
    canvasdata11Webgl: GleanString;
    canvasdata12Fingerprintjs1: GleanString;
    canvasdata13Fingerprintjs2: GleanString;
    canvasdata1software: GleanString;
    canvasdata2software: GleanString;
    canvasdata3software: GleanString;
    canvasdata4software: GleanString;
    canvasdata5software: GleanString;
    canvasdata6software: GleanString;
    canvasdata7software: GleanString;
    canvasdata8software: GleanString;
    canvasdata9software: GleanString;
    canvasdata10software: GleanString;
    canvasdata11Webglsoftware: GleanString;
    canvasdata12Fingerprintjs1software: GleanString;
    canvasdata13Fingerprintjs2software: GleanString;
    canvasDpr: GleanString;
    fontSizeMonospaceModified: GleanQuantity;
    fontMinimumSizeWestern: GleanString;
    fontMinimumSizeDefaultGroup: GleanString;
    fontMinimumSizeModified: GleanQuantity;
    fontNameListSerifModified: GleanQuantity;
    fontNameListSansSerifModified: GleanQuantity;
    fontNameListMonospaceModified: GleanQuantity;
    fontNameListCursiveModified: GleanQuantity;
    fontNameListEmojiModified: GleanBoolean;
    glExtensions: GleanText;
    glExtensionsRaw: GleanText;
    glRenderer: GleanString;
    glRendererRaw: GleanString;
    glVendor: GleanString;
    glVendorRaw: GleanString;
    glVersionRaw: GleanString;
    glFragmentShader: GleanString;
    glVertexShader: GleanString;
    glMinimalSource: GleanText;
    glParamsExtensions: GleanText;
    glParams: GleanText;
    glPrecisionFragment: GleanText;
    glPrecisionVertex: GleanText;
    glContextType: GleanString;
    glExtensionsSoftware: GleanText;
    glExtensionsRawSoftware: GleanText;
    glRendererSoftware: GleanString;
    glRendererRawSoftware: GleanString;
    glVendorSoftware: GleanString;
    glVendorRawSoftware: GleanString;
    glVersionRawSoftware: GleanString;
    glFragmentShaderSoftware: GleanString;
    glVertexShaderSoftware: GleanString;
    glMinimalSourceSoftware: GleanText;
    glParamsExtensionsSoftware: GleanText;
    glParamsSoftware: GleanText;
    glPrecisionFragmentSoftware: GleanText;
    glPrecisionVertexSoftware: GleanText;
    glContextTypeSoftware: GleanString;
    gl2Extensions: GleanText;
    gl2ExtensionsRaw: GleanText;
    gl2Renderer: GleanString;
    gl2RendererRaw: GleanString;
    gl2Vendor: GleanString;
    gl2VendorRaw: GleanString;
    gl2VersionRaw: GleanString;
    gl2FragmentShader: GleanString;
    gl2VertexShader: GleanString;
    gl2MinimalSource: GleanText;
    gl2ParamsExtensions: GleanText;
    gl2Params: GleanText;
    gl2PrecisionFragment: GleanText;
    gl2PrecisionVertex: GleanText;
    gl2ContextType: GleanString;
    gl2ExtensionsSoftware: GleanText;
    gl2ExtensionsRawSoftware: GleanText;
    gl2RendererSoftware: GleanString;
    gl2RendererRawSoftware: GleanString;
    gl2VendorSoftware: GleanString;
    gl2VendorRawSoftware: GleanString;
    gl2VersionRawSoftware: GleanString;
    gl2FragmentShaderSoftware: GleanString;
    gl2VertexShaderSoftware: GleanString;
    gl2MinimalSourceSoftware: GleanText;
    gl2ParamsExtensionsSoftware: GleanText;
    gl2ParamsSoftware: GleanText;
    gl2PrecisionFragmentSoftware: GleanText;
    gl2PrecisionVertexSoftware: GleanText;
    gl2ContextTypeSoftware: GleanString;
    prefsNetworkCookieCookiebehavior: GleanQuantity;
    voicesCount: GleanQuantity;
    voicesLocalCount: GleanQuantity;
    voicesDefault: GleanString;
    voicesSample: GleanText;
    voicesSha1: GleanText;
    voicesAllSsdeep: GleanString;
    voicesLocalSsdeep: GleanString;
    voicesNonlocalSsdeep: GleanString;
    zoomCount: GleanQuantity;
    availHeight: GleanQuantity;
    outerHeight: GleanQuantity;
    innerHeight: GleanQuantity;
    screenHeight: GleanQuantity;
    outerWidth: GleanQuantity;
    innerWidth: GleanQuantity;
    screenWidth: GleanQuantity;
    sizeMode: GleanQuantity;
    availWidth: GleanQuantity;
    cameraCount: GleanQuantity;
    microphoneCount: GleanQuantity;
    speakerCount: GleanQuantity;
    groupCount: GleanQuantity;
    groupCountWoSpeakers: GleanQuantity;
    audioFrames: GleanQuantity;
    audioRate: GleanQuantity;
    audioChannels: GleanQuantity;
    languages: GleanString;
    changedMediaPrefs: GleanString;
    mediaCapabilitiesUnsupported: GleanText;
    mediaCapabilitiesNotSmooth: GleanText;
    mediaCapabilitiesNotEfficient: GleanText;
    mediaCapabilitiesH264: GleanText;
    textAntiAliasing: GleanString;
    audioFingerprint: GleanQuantity;
    pixelRatio: GleanString;
    intlLocale: GleanString;
    mathOps: GleanText;
    mathOpsFdlibm: GleanText;
    keyboardLayout: GleanString;
    errors: GleanText;
    jsErrors: GleanText;
    pointerType: GleanQuantity;
    anyPointerType: GleanQuantity;
    iceOrder: GleanQuantity;
    iceSd: GleanQuantity;
    pointerHeight: GleanQuantity;
    pointerWidth: GleanQuantity;
    pointerPressure: GleanString;
    pointerTangentinalPressure: GleanString;
    pointerTiltx: GleanQuantity;
    pointerTilty: GleanQuantity;
    pointerTwist: GleanQuantity;
    touchRotationAngle: GleanString;
    motionDecimals: GleanQuantity;
    orientationDecimals: GleanQuantity;
    orientationabsDecimals: GleanQuantity;
    motionFreq: GleanQuantity;
    orientationFreq: GleanQuantity;
    orientationabsFreq: GleanQuantity;
    version: GleanString;
    channel: GleanString;
    buildDate: GleanQuantity;
    osName: GleanString;
    osVersion: GleanString;
    cpuModel: GleanString;
    cpuArch: GleanString;
    mathml1: GleanString;
    mathml2: GleanString;
    mathml3: GleanString;
    mathml4: GleanString;
    mathml5: GleanString;
    mathml6: GleanString;
    mathml7: GleanString;
    mathml8: GleanString;
    mathml9: GleanString;
    mathml10: GleanString;
    monochrome: GleanBoolean;
    oscpu: GleanString;
    pdfViewer: GleanBoolean;
    platform: GleanString;
    usingAcceleratedCanvas: GleanBoolean;
    canvasFeatureStatus: GleanString;
    wgpuMissingFeatures: GleanString;
    wgpuMaxtexturedimension1d: GleanQuantity;
    wgpuMaxtexturedimension2d: GleanQuantity;
    wgpuMaxtexturedimension3d: GleanQuantity;
    wgpuMaxtexturearraylayers: GleanQuantity;
    wgpuMaxbindgroups: GleanQuantity;
    wgpuMaxbindgroupsplusvertexbuffers: GleanQuantity;
    wgpuMaxbindingsperbindgroup: GleanQuantity;
    wgpuMaxdynamicuniformbuffersperpipelinelayout: GleanQuantity;
    wgpuMaxdynamicstoragebuffersperpipelinelayout: GleanQuantity;
    wgpuMaxsampledtexturespershaderstage: GleanQuantity;
    wgpuMaxsamplerspershaderstage: GleanQuantity;
    wgpuMaxstoragebufferspershaderstage: GleanQuantity;
    wgpuMaxstoragetexturespershaderstage: GleanQuantity;
    wgpuMaxuniformbufferspershaderstage: GleanQuantity;
    wgpuMaxuniformbufferbindingsize: GleanQuantity;
    wgpuMaxstoragebufferbindingsize: GleanQuantity;
    wgpuMinuniformbufferoffsetalignment: GleanQuantity;
    wgpuMinstoragebufferoffsetalignment: GleanQuantity;
    wgpuMaxvertexbuffers: GleanQuantity;
    wgpuMaxbuffersize: GleanQuantity;
    wgpuMaxvertexattributes: GleanQuantity;
    wgpuMaxvertexbufferarraystride: GleanQuantity;
    wgpuMaxinterstageshadervariables: GleanQuantity;
    wgpuMaxcolorattachments: GleanQuantity;
    wgpuMaxcolorattachmentbytespersample: GleanQuantity;
    wgpuMaxcomputeworkgroupstoragesize: GleanQuantity;
    wgpuMaxcomputeinvocationsperworkgroup: GleanQuantity;
    wgpuMaxcomputeworkgroupsizex: GleanQuantity;
    wgpuMaxcomputeworkgroupsizey: GleanQuantity;
    wgpuMaxcomputeworkgroupsizez: GleanQuantity;
    wgpuMaxcomputeworkgroupsperdimension: GleanQuantity;
    userAgent: GleanText;
    machineModelName: GleanString;
    fontsFpjsAllowlisted: GleanString;
    fontsFpjsNonallowlisted: GleanString;
    fontsVariantAAllowlisted: GleanString;
    fontsVariantANonallowlisted: GleanString;
    fontsVariantBAllowlisted: GleanString;
    fontsVariantBNonallowlisted: GleanString;
    screens: GleanText;
  }

  searchEngineDefault: {
    engineId: GleanString;
    providerId: GleanString;
    partnerCode: GleanString;
    overriddenByThirdParty: GleanBoolean;
    displayName: GleanString;
    loadPath: GleanString;
    submissionUrl: GleanUrl;
    changed: GleanEvent;
  }

  searchEnginePrivate: {
    engineId: GleanString;
    providerId: GleanString;
    partnerCode: GleanString;
    overriddenByThirdParty: GleanBoolean;
    displayName: GleanString;
    loadPath: GleanString;
    submissionUrl: GleanUrl;
    changed: GleanEvent;
  }

  searchService: {
    startupTime: GleanTimingDistribution;
    initializationStatus: Record<string, GleanCounter>;
  }

  browserSearchinit: {
    engineInvalidWebextension: Record<string, GleanQuantity>;
    secureOpensearchEngineCount: GleanQuantity;
    insecureOpensearchEngineCount: GleanQuantity;
    secureOpensearchUpdateCount: GleanQuantity;
    insecureOpensearchUpdateCount: GleanQuantity;
  }

  search: {
    suggestionsLatency: Record<string, GleanTimingDistribution>;
  }

  searchSuggestions: {
    successfulRequests: Record<string, GleanCounter>;
    abortedRequests: Record<string, GleanCounter>;
    failedRequests: Record<string, GleanCounter>;
  }

  legacyTelemetry: {
    clientId: GleanUuid;
    profileGroupId: GleanUuid;
  }

  telemetry: {
    dataUploadOptin: GleanBoolean;
    archiveDirectoriesCount: GleanCustomDistribution;
    archiveOldestDirectoryAge: GleanCustomDistribution;
    archiveScanPingCount: GleanCustomDistribution;
    archiveSessionPingCount: GleanCounter;
    archiveSize: GleanMemoryDistribution;
    archiveEvictedOverQuota: GleanCustomDistribution;
    archiveEvictedOldDirs: GleanCustomDistribution;
    archiveEvictingDirs: GleanTimingDistribution;
    archiveCheckingOverQuota: GleanTimingDistribution;
    archiveEvictingOverQuota: GleanTimingDistribution;
    pendingLoadFailureRead: GleanCounter;
    pendingLoadFailureParse: GleanCounter;
    pendingPingsSize: GleanMemoryDistribution;
    pendingPingsAge: GleanTimingDistribution;
    pendingPingsEvictedOverQuota: GleanCustomDistribution;
    pendingEvictingOverQuota: GleanTimingDistribution;
    pendingCheckingOverQuota: GleanTimingDistribution;
    pingSizeExceededSend: GleanCounter;
    pingSizeExceededPending: GleanCounter;
    pingSizeExceededArchived: GleanCounter;
    pingSubmissionWaitingClientid: GleanCounter;
    discardedPendingPingsSize: GleanMemoryDistribution;
    discardedArchivedPingsSize: GleanMemoryDistribution;
    discardedSendPingsSize: GleanMemoryDistribution;
    compress: GleanTimingDistribution;
    sendSuccess: GleanTimingDistribution;
    sendFailure: GleanTimingDistribution;
    sendFailureType: Record<string, GleanCounter>;
    stringify: GleanTimingDistribution;
    success: Record<string, GleanCounter>;
    invalidPingTypeSubmitted: Record<string, GleanCounter>;
    invalidPayloadSubmitted: GleanCounter;
    pingEvictedForServerErrors: GleanCounter;
    eventPingSent: Record<string, GleanCounter>;
    eventRegistrationError: Record<string, GleanCounter>;
    eventRecordingError: Record<string, GleanCounter>;
  }

  usage: {
    profileId: GleanUuid;
    profileGroupId: GleanUuid;
    os: GleanString;
    osVersion: GleanString;
    windowsBuildNumber: GleanQuantity;
    appBuild: GleanString;
    appDisplayVersion: GleanString;
    appChannel: GleanString;
    firstRunDate: GleanDatetime;
    reason: GleanString;
    isDefaultBrowser: GleanBoolean;
    distributionId: GleanString;
  }

  onboardingOptOut: {
    activeExperiments: GleanObject;
    activeRollouts: GleanObject;
    enrollmentsMap: GleanObject;
  }

  telemetryTest: {
    test1Object1: GleanEvent;
    test2Object1: GleanEvent;
    test2Object2: GleanEvent;
  }

  thumbnails: {
    captureTime: GleanTimingDistribution;
    storeTime: GleanTimingDistribution;
    queueSizeOnCapture: GleanCustomDistribution;
    captureQueueTime: GleanTimingDistribution;
    captureDoneReason2: GleanCustomDistribution;
    capturePageLoadTime: GleanTimingDistribution;
    captureCanvasDrawTime: GleanTimingDistribution;
  }

  translations: {
    requestCount: Record<string, GleanCounter>;
    error: GleanEvent;
    translationRequest: GleanEvent;
    restorePage: GleanEvent;
    enginePerformance: GleanEvent;
  }

  translationsPanel: {
    open: GleanEvent;
    close: GleanEvent;
    openFromLanguageMenu: GleanEvent;
    changeFromLanguage: GleanEvent;
    closeFromLanguageMenu: GleanEvent;
    openToLanguageMenu: GleanEvent;
    changeToLanguage: GleanEvent;
    closeToLanguageMenu: GleanEvent;
    openSettingsMenu: GleanEvent;
    closeSettingsMenu: GleanEvent;
    cancelButton: GleanEvent;
    changeSourceLanguageButton: GleanEvent;
    dismissErrorButton: GleanEvent;
    restorePageButton: GleanEvent;
    translateButton: GleanEvent;
    alwaysOfferTranslations: GleanEvent;
    alwaysTranslateLanguage: GleanEvent;
    neverTranslateLanguage: GleanEvent;
    neverTranslateSite: GleanEvent;
    manageLanguages: GleanEvent;
    aboutTranslations: GleanEvent;
    learnMore: GleanEvent;
  }

  translationsSelectTranslationsPanel: {
    open: GleanEvent;
    close: GleanEvent;
    cancelButton: GleanEvent;
    copyButton: GleanEvent;
    doneButton: GleanEvent;
    translateButton: GleanEvent;
    translateFullPageButton: GleanEvent;
    tryAgainButton: GleanEvent;
    changeFromLanguage: GleanEvent;
    changeToLanguage: GleanEvent;
    openSettingsMenu: GleanEvent;
    translationSettings: GleanEvent;
    aboutTranslations: GleanEvent;
    initializationFailureMessage: GleanEvent;
    translationFailureMessage: GleanEvent;
    unsupportedLanguageMessage: GleanEvent;
  }

  translationsAboutTranslationsPage: {
    open: GleanEvent;
  }

  urlclassifier: {
    lookupTime2: GleanTimingDistribution;
    shutdownTime: GleanTimingDistribution;
    clCheckTime: GleanTimingDistribution;
    clKeyedUpdateTime: Record<string, GleanTimingDistribution>;
    asyncClassifylocalTime: GleanTimingDistribution;
    vlpsFileloadTime: GleanTimingDistribution;
    vlpsFallocateTime: GleanTimingDistribution;
    vlpsConstructTime: GleanTimingDistribution;
    vlpsMetadataCorrupt: Record<string, GleanCounter>;
    updateRemoteNetworkError: Record<string, GleanCustomDistribution>;
    updateRemoteStatus2: Record<string, GleanCustomDistribution>;
    updateServerResponseTime: Record<string, GleanTimingDistribution>;
    updateTimeout: Record<string, GleanCustomDistribution>;
    completeRemoteStatus2: Record<string, GleanCustomDistribution>;
    completionError: GleanCustomDistribution;
    completeServerResponseTime: Record<string, GleanTimingDistribution>;
    updateError: Record<string, GleanCustomDistribution>;
    threathitNetworkError: GleanCustomDistribution;
    threathitRemoteStatus: GleanCustomDistribution;
    uiEvents: GleanCustomDistribution;
  }

  securityDohNeterror: {
    loadDohwarning: GleanEvent;
    clickTryAgainButton: GleanEvent;
    clickAddExceptionButton: GleanEvent;
    clickSettingsButton: GleanEvent;
    clickContinueButton: GleanEvent;
    clickDisableWarning: GleanEvent;
    clickLearnMoreLink: GleanEvent;
  }

  securityUiCerterror: {
    loadAboutcerterror: GleanEvent;
    clickAdvancedButton: GleanEvent;
    clickExceptionButton: GleanEvent;
    clickReturnButtonTop: GleanEvent;
    clickReturnButtonAdv: GleanEvent;
    clickLearnMoreLink: GleanEvent;
    clickAutoReportCb: GleanEvent;
    clickErrorCodeLink: GleanEvent;
    clickClipboardButtonTop: GleanEvent;
    clickClipboardButtonBot: GleanEvent;
  }

  securityUiTlserror: {
    loadAbouttlserror: GleanEvent;
  }

  findbar: {
    shown: GleanCounter;
    findPrev: GleanCounter;
    findNext: GleanCounter;
    highlightAll: GleanCounter;
    matchCase: GleanCounter;
    matchDiacritics: GleanCounter;
    wholeWords: GleanCounter;
  }

  mozstorage: {
    sqlitejsmTransactionTimeout: Record<string, GleanCounter>;
  }

  region: {
    fetchTime: GleanTimingDistribution;
    fetchResult: GleanCustomDistribution;
    homeRegion: GleanString;
    storeRegionResult: Record<string, GleanCounter>;
  }

  firstStartup: {
    statusCode: GleanQuantity;
    elapsed: GleanQuantity;
    normandyInitTime: GleanQuantity;
    deleteTasksTime: GleanQuantity;
    newProfile: GleanBoolean;
  }

  serviceRequest: {
    bypassProxyInfo: GleanEvent;
  }

  jsonfile: {
    loadLogins: GleanEvent;
    loadAutofillprofiles: GleanEvent;
  }

  newtabPage: {
    pinnedSitesCount: GleanCustomDistribution;
    blockedSitesCount: GleanCustomDistribution;
  }

  popupNotification: {
    stats: Record<string, GleanCustomDistribution>;
    mainAction: Record<string, GleanTimingDistribution>;
    dismissal: Record<string, GleanTimingDistribution>;
  }

  system: {
    osVersion: GleanString;
    previousOsVersion: GleanString;
    memory: GleanQuantity;
    virtualMemory: GleanQuantity;
    isWow64: GleanBoolean;
    isWowArm64: GleanBoolean;
    hasWinPackageId: GleanBoolean;
    winPackageFamilyName: GleanString;
    appleModelId: GleanString;
  }

  systemDefault: {
    browser: GleanString;
    previousBrowser: GleanString;
    pdfHandler: GleanString;
  }

  notification: {
    showSuccess: GleanBoolean;
    action: GleanString;
  }

  defaultagent: {
    daysSinceLastAppLaunch: GleanQuantity;
  }

  addons: {
    activeAddons: GleanObject;
    theme: GleanObject;
    activeGMPlugins: GleanObject;
  }

  addonsManager: {
    install: GleanEvent;
    update: GleanEvent;
    installStats: GleanEvent;
    manage: GleanEvent;
    reportSuspiciousSite: GleanEvent;
    compatibilityCheckEnabled: GleanBoolean;
    xpistatesWriteErrors: GleanEvent;
    installExtension: GleanEvent;
    installTheme: GleanEvent;
    installLocale: GleanEvent;
    installDictionary: GleanEvent;
    installSitepermission: GleanEvent;
    installSitepermDeprecated: GleanEvent;
    installOther: GleanEvent;
    installUnknown: GleanEvent;
    updateExtension: GleanEvent;
    updateTheme: GleanEvent;
    updateLocale: GleanEvent;
    updateDictionary: GleanEvent;
    updateSitepermission: GleanEvent;
    updateSitepermDeprecated: GleanEvent;
    updateOther: GleanEvent;
    updateUnknown: GleanEvent;
    installStatsExtension: GleanEvent;
    installStatsTheme: GleanEvent;
    installStatsLocale: GleanEvent;
    installStatsDictionary: GleanEvent;
    installStatsSitepermission: GleanEvent;
    installStatsSitepermDeprecated: GleanEvent;
    installStatsOther: GleanEvent;
    installStatsUnknown: GleanEvent;
    disableExtension: GleanEvent;
    disableTheme: GleanEvent;
    disableLocale: GleanEvent;
    disableDictionary: GleanEvent;
    disableSitepermission: GleanEvent;
    disableSitepermDeprecated: GleanEvent;
    disableOther: GleanEvent;
    disableUnknown: GleanEvent;
    enableExtension: GleanEvent;
    enableTheme: GleanEvent;
    enableLocale: GleanEvent;
    enableDictionary: GleanEvent;
    enableSitepermission: GleanEvent;
    enableSitepermDeprecated: GleanEvent;
    enableOther: GleanEvent;
    enableUnknown: GleanEvent;
    sideloadPromptExtension: GleanEvent;
    sideloadPromptTheme: GleanEvent;
    sideloadPromptLocale: GleanEvent;
    sideloadPromptDictionary: GleanEvent;
    sideloadPromptSitepermission: GleanEvent;
    sideloadPromptSitepermDeprecated: GleanEvent;
    sideloadPromptOther: GleanEvent;
    sideloadPromptUnknown: GleanEvent;
    uninstallExtension: GleanEvent;
    uninstallTheme: GleanEvent;
    uninstallLocale: GleanEvent;
    uninstallDictionary: GleanEvent;
    uninstallSitepermission: GleanEvent;
    uninstallSitepermDeprecated: GleanEvent;
    uninstallOther: GleanEvent;
    uninstallUnknown: GleanEvent;
  }

  blocklist: {
    lastModifiedRsAddonsMblf: GleanDatetime;
    mlbfSource: GleanString;
    mlbfSoftblocksSource: GleanString;
    mlbfGenerationTime: GleanDatetime;
    mlbfSoftblocksGenerationTime: GleanDatetime;
    mlbfStashTimeOldest: GleanDatetime;
    mlbfStashTimeNewest: GleanDatetime;
    addonBlockChange: GleanEvent;
    enabled: GleanBoolean;
  }

  update: {
    autoDownload: GleanBoolean;
    backgroundUpdate: GleanBoolean;
    canUsuallyApplyUpdates: GleanBoolean;
    canUsuallyCheckForUpdates: GleanBoolean;
    canUsuallyStageUpdates: GleanBoolean;
    canUsuallyUseBits: GleanBoolean;
    channel: GleanString;
    enabled: GleanBoolean;
    serviceEnabled: GleanBoolean;
    checkNoUpdateExternal: GleanCounter;
    checkNoUpdateNotify: GleanCounter;
    checkNoUpdateSubsequent: GleanCounter;
    checkCodeExternal: GleanCustomDistribution;
    checkCodeNotify: GleanCustomDistribution;
    checkCodeSubsequent: GleanCustomDistribution;
    checkExtendedErrorExternal: Record<string, GleanCounter>;
    checkExtendedErrorNotify: Record<string, GleanCounter>;
    checkExtendedErrorSubsequent: Record<string, GleanCounter>;
    invalidLastupdatetimeExternal: GleanCounter;
    invalidLastupdatetimeNotify: GleanCounter;
    invalidLastupdatetimeSubsequent: GleanCounter;
    lastNotifyIntervalDaysExternal: GleanTimingDistribution;
    lastNotifyIntervalDaysNotify: GleanTimingDistribution;
    lastNotifyIntervalDaysSubsequent: GleanTimingDistribution;
    pingCountExternal: GleanCounter;
    pingCountNotify: GleanCounter;
    pingCountSubsequent: GleanCounter;
    serviceInstalledExternal: Record<string, GleanCounter>;
    serviceInstalledNotify: Record<string, GleanCounter>;
    serviceInstalledSubsequent: Record<string, GleanCounter>;
    serviceManuallyUninstalledExternal: GleanCounter;
    serviceManuallyUninstalledNotify: GleanCounter;
    serviceManuallyUninstalledSubsequent: GleanCounter;
    unableToApplyExternal: GleanCounter;
    unableToApplyNotify: GleanCounter;
    unableToApplySubsequent: GleanCounter;
    cannotStageExternal: GleanCounter;
    cannotStageNotify: GleanCounter;
    cannotStageSubsequent: GleanCounter;
    prefUpdateCancelationsExternal: GleanCustomDistribution;
    prefUpdateCancelationsNotify: GleanCustomDistribution;
    prefUpdateCancelationsSubsequent: GleanCustomDistribution;
    prefServiceErrorsExternal: GleanCustomDistribution;
    prefServiceErrorsNotify: GleanCustomDistribution;
    prefServiceErrorsSubsequent: GleanCustomDistribution;
    notPrefUpdateAutoExternal: GleanCounter;
    notPrefUpdateAutoNotify: GleanCounter;
    notPrefUpdateAutoSubsequent: GleanCounter;
    notPrefUpdateStagingEnabledExternal: GleanCounter;
    notPrefUpdateStagingEnabledNotify: GleanCounter;
    notPrefUpdateStagingEnabledSubsequent: GleanCounter;
    notPrefUpdateServiceEnabledExternal: GleanCounter;
    notPrefUpdateServiceEnabledNotify: GleanCounter;
    notPrefUpdateServiceEnabledSubsequent: GleanCounter;
    canUseBitsExternal: Record<string, GleanCounter>;
    canUseBitsNotify: Record<string, GleanCounter>;
    canUseBitsSubsequent: Record<string, GleanCounter>;
    downloadCodeComplete: GleanCustomDistribution;
    downloadCodePartial: GleanCustomDistribution;
    downloadCodeUnknown: GleanCustomDistribution;
    stateCodeCompleteStartup: GleanCustomDistribution;
    stateCodePartialStartup: GleanCustomDistribution;
    stateCodeUnknownStartup: GleanCustomDistribution;
    stateCodeCompleteStage: GleanCustomDistribution;
    stateCodePartialStage: GleanCustomDistribution;
    stateCodeUnknownStage: GleanCustomDistribution;
    statusErrorCodeCompleteStartup: GleanCustomDistribution;
    statusErrorCodePartialStartup: GleanCustomDistribution;
    statusErrorCodeUnknownStartup: GleanCustomDistribution;
    statusErrorCodeCompleteStage: GleanCustomDistribution;
    statusErrorCodePartialStage: GleanCustomDistribution;
    statusErrorCodeUnknownStage: GleanCustomDistribution;
    bitsResultComplete: GleanCustomDistribution;
    bitsResultPartial: GleanCustomDistribution;
    notificationShown: Record<string, GleanCounter>;
    notificationBadgeShown: Record<string, GleanCounter>;
    notificationDismissed: Record<string, GleanCounter>;
    notificationMainActionDoorhanger: Record<string, GleanCounter>;
    notificationMainActionMenu: Record<string, GleanCounter>;
    langpackOvertime: GleanTimingDistribution;
    bitshresult: Record<string, GleanCounter>;
    moveResult: Record<string, GleanCounter>;
    noWindowAutoRestarts: GleanCounter;
    suppressPrompts: GleanBoolean;
    versionPin: GleanString;
  }

  updater: {
    available: GleanBoolean;
  }

  updateSettings: {
    channel: GleanString;
    enabled: GleanBoolean;
    autoDownload: GleanBoolean;
    background: GleanBoolean;
  }

  profiles: {
    creationDate: GleanQuantity;
    resetDate: GleanQuantity;
    firstUseDate: GleanQuantity;
    recoveredFromBackup: GleanQuantity;
  }

  gecko: {
    version: GleanString;
    buildId: GleanString;
    safeModeUsage: GleanCustomDistribution;
  }

  launcherProcess: {
    state: GleanQuantity;
  }

  e10s: {
    enabled: GleanBoolean;
    multiProcesses: GleanQuantity;
  }

  fission: {
    enabled: GleanBoolean;
  }

  widget: {
    imeNameOnMac: Record<string, GleanBoolean>;
    imeNameOnLinux: Record<string, GleanBoolean>;
    gtkVersion: GleanString;
    darkMode: GleanBoolean;
    pointingDevices: Record<string, GleanBoolean>;
    notifyIdle: GleanTimingDistribution;
    imeNameOnWindows: Record<string, GleanBoolean>;
    imeNameOnWindowsInsertedCrlf: Record<string, GleanBoolean>;
    touchEnabledDevice: Record<string, GleanCounter>;
  }

  gfxFeatures: {
    compositor: GleanString;
    d3d11: GleanObject;
    d2d: GleanObject;
    hwCompositing: GleanObject;
    gpuProcess: GleanObject;
    webrender: GleanObject;
    wrCompositor: GleanObject;
    openglCompositing: GleanObject;
    omtp: GleanObject;
  }

  windowsSecurity: {
    antivirus: GleanStringList;
    antispyware: GleanStringList;
    firewall: GleanStringList;
  }

  timerThread: {
    timersFiredPerWakeup: GleanCustomDistribution;
  }

  memoryWatcher: {
    onHighMemoryStats: GleanEvent;
  }

  memoryPhc: {
    slop: GleanMemoryDistribution;
    slotsAllocated: GleanCustomDistribution;
    slotsFreed: GleanCustomDistribution;
  }

  cycleCollector: {
    time: GleanTimingDistribution;
    workerTime: GleanTimingDistribution;
    visitedRefCounted: GleanCustomDistribution;
    workerVisitedRefCounted: GleanCustomDistribution;
    visitedGced: GleanCustomDistribution;
    workerVisitedGced: GleanCustomDistribution;
    collected: GleanCustomDistribution;
    workerCollected: GleanCustomDistribution;
    needGc: Record<string, GleanCounter>;
    workerNeedGc: Record<string, GleanCounter>;
    full: GleanTimingDistribution;
    maxPause: GleanTimingDistribution;
    finishIgc: Record<string, GleanCounter>;
    syncSkippable: Record<string, GleanCounter>;
    timeBetween: GleanTimingDistribution;
    sliceDuringIdle: GleanCustomDistribution;
    asyncSnowWhiteFreeing: GleanTimingDistribution;
    deferredFinalizeAsync: GleanTimingDistribution;
    forgetSkippableMax: GleanTimingDistribution;
  }

  event: {
    longtask: Record<string, GleanTimingDistribution>;
  }

  xpcom: {
    abi: GleanString;
  }

  systemCpu: {
    name: GleanString;
    vendor: GleanString;
    logicalCores: GleanQuantity;
    physicalCores: GleanQuantity;
    bigCores: GleanQuantity;
    mediumCores: GleanQuantity;
    littleCores: GleanQuantity;
    family: GleanQuantity;
    model: GleanQuantity;
    stepping: GleanQuantity;
    l2Cache: GleanQuantity;
    l3Cache: GleanQuantity;
    speed: GleanQuantity;
    extensions: GleanStringList;
  }

  hdd: {
    profile: GleanObject;
    binary: GleanObject;
    system: GleanObject;
  }

  systemOs: {
    name: GleanString;
    version: GleanString;
    locale: GleanString;
    distro: GleanString;
    distroVersion: GleanString;
    servicePackMajor: GleanQuantity;
    servicePackMinor: GleanQuantity;
    windowsBuildNumber: GleanQuantity;
    windowsUbr: GleanQuantity;
  }
}

interface GleanPingsImpl {
  messagingSystem: nsIGleanPingNoReason;
  newtab: nsIGleanPingWithReason<"newtab_session_end"|"component_init">;
  newtabContent: nsIGleanPingWithReason<"newtab_session_end"|"component_init">;
  topSites: nsIGleanPingNoReason;
  spoc: nsIGleanPingWithReason<"impression"|"click"|"save">;
  pocketButton: nsIGleanPingNoReason;
  searchWith: nsIGleanPingNoReason;
  serpCategorization: nsIGleanPingWithReason<"startup"|"inactivity"|"threshold_reached">;
  quickSuggest: nsIGleanPingNoReason;
  quickSuggestDeletionRequest: nsIGleanPingNoReason;
  urlbarKeywordExposure: nsIGleanPingNoReason;
  prototypeNoCodeEvents: nsIGleanPingNoReason;
  contextIdDeletionRequest: nsIGleanPingNoReason;
  pageload: nsIGleanPingWithReason<"startup"|"threshold">;
  useCounters: nsIGleanPingWithReason<"app_shutdown_confirmed"|"idle_startup">;
  fxAccounts: nsIGleanPingWithReason<"active"|"dirty_startup"|"inactive">;
  bounceTrackingProtection: nsIGleanPingNoReason;
  hangReport: nsIGleanPingNoReason;
  backgroundTasks: nsIGleanPingNoReason;
  captchaDetection: nsIGleanPingNoReason;
  crash: nsIGleanPingWithReason<"crash"|"event_found">;
  dauReporting: nsIGleanPingWithReason<"dirty_startup"|"inactive"|"active">;
  onePingOnly: nsIGleanPingNoReason;
  testPing: nsIGleanPingNoReason;
  testOhttpPing: nsIGleanPingNoReason;
  rideAlongPing: nsIGleanPingNoReason;
  collectionDisabledPing: nsIGleanPingNoReason;
  disabledPing: nsIGleanPingNoReason;
  nimbusTargetingContext: nsIGleanPingNoReason;
  heartbeat: nsIGleanPingNoReason;
  brokenSiteReport: nsIGleanPingNoReason;
  userCharacteristics: nsIGleanPingNoReason;
  usageReporting: nsIGleanPingWithReason<"dirty_startup"|"inactive"|"active">;
  usageDeletionRequest: nsIGleanPingWithReason<"set_upload_enabled">;
  onboardingOptOut: nsIGleanPingWithReason<"set_upload_enabled">;
  firstStartup: nsIGleanPingNoReason;
  defaultAgent: nsIGleanPingWithReason<"daily_ping">;
  backgroundUpdate: nsIGleanPingWithReason<"backgroundupdate_task">;
}
