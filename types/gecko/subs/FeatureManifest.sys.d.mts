export const FeatureManifest: {
    "no-feature-firefox-desktop": {
        description: string;
        owner: string;
        applications: string[];
        hasExposure: boolean;
        allowCoenrollment: boolean;
        variables: {};
    };
    testFeature: {
        description: string;
        owner: string;
        applications: string[];
        hasExposure: boolean;
        isEarlyStartup: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
            };
            testInt: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            testSetString: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "nimbus-qa-1": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            value: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "nimbus-qa-2": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            value: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    prefFlips: {
        description: string;
        owner: string;
        hasExposure: boolean;
        allowCoenrollment: boolean;
        variables: {
            prefs: {
                type: string;
                description: string;
            };
        };
        schema: {
            uri: string;
            path: string;
        };
    };
    search: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            scotchBonnetEnableOverride: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            trendingRequireSearchMode: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            trendingMaxResultsNoSearchMode: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            targetExperiment: {
                type: string;
                description: string;
            };
        };
    };
    searchConfiguration: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            experiment: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            extraParams: {
                type: string;
                description: string;
            };
            separatePrivateDefaultUIEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            separatePrivateDefaultUrlbarResultEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    urlbar: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            actionsOnboardingTimesToShow: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            addonsFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            addonsShowLessFrequentlyCap: {
                type: string;
                description: string;
            };
            ampMatchingStrategy: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            autoFillAdaptiveHistoryEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            autoFillAdaptiveHistoryMinCharsThreshold: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            autoFillAdaptiveHistoryUseCountThreshold: {
                type: string;
                description: string;
            };
            deduplicationEnabled: {
                type: string;
                setPref: {
                    pref: string;
                    branch: string;
                };
                description: string;
            };
            fakespotFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            fakespotMinKeywordLength: {
                type: string;
                description: string;
            };
            fakespotShowLessFrequentlyCap: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            fakespotSuggestedIndex: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            keywordExposureResults: {
                type: string;
                setPref: {
                    pref: string;
                    branch: string;
                };
                description: string;
            };
            mdnFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoClientVariants: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoEndpointURL: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoProviders: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoTimeoutMs: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            exposureResults: {
                type: string;
                setPref: {
                    pref: string;
                    branch: string;
                };
                description: string;
            };
            showExposureResults: {
                type: string;
                setPref: {
                    pref: string;
                    branch: string;
                };
                description: string;
            };
            pocketFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            pocketShowLessFrequentlyCap: {
                type: string;
                description: string;
            };
            pocketSuggestIndex: {
                type: string;
                description: string;
            };
            quickSuggestAmpTopPickCharThreshold: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestContextualOptInEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestContextualOptInFirstReshowAfterPeriodDays: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestContextualOptInSecondReshowAfterPeriodDays: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestContextualOptInThirdReshowAfterPeriodDays: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestContextualOptInImpressionLimit: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestContextualOptInImpressionDaysLimit: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            quickSuggestDataCollectionEnabled: {
                type: string;
                description: string;
            };
            quickSuggestDynamicSuggestionTypes: {
                type: string;
                setPref: {
                    pref: string;
                    branch: string;
                };
                description: string;
            };
            quickSuggestEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestImpressionCapsSponsoredEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestImpressionCapsNonSponsoredEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestMlEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestNonSponsoredEnabled: {
                type: string;
                description: string;
            };
            quickSuggestNonSponsoredIndex: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestRankingMode: {
                type: string;
                fallbackPref: string;
                description: string;
                enum: string[];
            };
            quickSuggestScoreMap: {
                type: string;
                description: string;
            };
            quickSuggestSettingsUi: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestSponsoredEnabled: {
                type: string;
                description: string;
            };
            quickSuggestSponsoredIndex: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            quickSuggestSponsoredPriority: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            recentSearchesFeatureGate: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            recentSearchesMaxResults: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            semanticHistoryEnable: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            semanticHistoryCompletionThreshold: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            semanticHistoryDistanceThreshold: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            suggestSemanticHistoryMinLength: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            suggestCalculator: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            weatherFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            weatherKeywordsMinimumLength: {
                type: string;
                description: string;
            };
            weatherShowLessFrequentlyCap: {
                type: string;
                description: string;
            };
            weatherUiTreatment: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            yelpMinKeywordLength: {
                type: string;
                description: string;
            };
            yelpMlEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            yelpFeatureGate: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            yelpServiceResultDistinction: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            yelpShowLessFrequentlyCap: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            yelpSuggestNonPriorityIndex: {
                type: string;
                description: string;
            };
            yelpSuggestPriority: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            originsAlternativeEnable: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            originsDaysCutOff: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesAlternativeEnable: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesNumSampledVisits: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesHalfLifeDays: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesMaxVisitGap: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesViewTimeSeconds: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pageViewTimeIfManyKeypressesSeconds: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            manyKeypresses: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesVeryHighWeight: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesHighWeight: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesMediumWeight: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pagesLowWeight: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    aboutwelcome: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        isEarlyStartup: boolean;
        variables: {
            enabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            id: {
                type: string;
                description: string;
            };
            screens: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            languageMismatchEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            transitions: {
                type: string;
                description: string;
            };
            backdrop: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            toolbarButtonEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    preonboarding: {
        description: string;
        owner: string;
        hasExposure: boolean;
        isEarlyStartup: boolean;
        variables: {
            enabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            screens: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            requireAction: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            currentPolicyVersion: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            minimumPolicyVersion: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            firstRunURL: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    moreFromMozilla: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            enabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            template: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    windowsLaunchOnLogin: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    firefoxBridge: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    abouthomecache: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    newtab: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        isEarlyStartup: boolean;
        variables: {
            newTheme: {
                type: string;
                description: string;
            };
            customizationMenuEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            prefsButtonIcon: {
                type: string;
                description: string;
            };
            topSitesContileEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            topSitesUseAdditionalTilesFromContile: {
                type: string;
                description: string;
            };
        };
    };
    newtabMobileDownloadPromotion: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            showModal: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            variantA: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            variantB: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            variantC: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabUnifiedAds: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            unifiedAdsEndpoint: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            unifiedAdsSpocsEnabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            unifiedAdsTilesEnabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            unifiedAdsFeedEnabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            unifiedAdsFeedTilesEnabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    newtabSpocsCache: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            spocsCacheTimeout: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            spocsStartupCache: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabAdSizingExperiment: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            leaderboard: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            leaderboard_position: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            billboard: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            billboard_position: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            medium_rectangle: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabInlineTopicSelection: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            TopicSelectionEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabLayoutExperiment: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            variantA: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            variantB: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabCustomWallpaper: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            uploadWallpaper: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            colorPicker: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            maxFileSizeEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            maxFileSize: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabShortcutsExperiment: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            refresh: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabSponsoredContent: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            spocPositions: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            spocPlacements: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            spocCounts: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            tilesPlacements: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            tilesCounts: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabTopicSelection: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            availableTopics: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            suggestedTopics: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            topicSelectionOnboarding: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionTopicsConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            localeTopicsConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            regionTopicLabelConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            localeTopicLabelConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    newtabContextualContent: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            contextualContentEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            localeContextualContentConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionContextualContentConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            contextualContentFeeds: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            contextualContentSelectedFeed: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabAdsReporting: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            reportAdsEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newTabSectionsExperiment: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            sectionsEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            cardRefreshThumbsUpDownEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            cardRefreshEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionPersonalizationInferredConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            localePersonalizationInferredConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            personalizationInferredEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            localeSectionstConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionSectionsConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sectionsPersonalization: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sectionsCustomizeMenuPanel: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sectionsContextualAdsEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionSectionsContextualAdsConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            localeSectionsContextualAdsConfig: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            contextualSpocPlacements: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            contextualSpocCounts: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabPrivatePing: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            privatePingEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            redactNewtabPing: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            includeInferredInterests: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabTrainhop: {
        description: string;
        owner: string;
        hasExposure: boolean;
        allowCoenrollment: boolean;
        variables: {
            type: {
                type: string;
                description: string;
            };
            payload: {
                type: string;
                description: string;
            };
        };
    };
    newtabMerinoOhttp: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabMarsOhttp: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    newtabRefinedCardsLayout: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    pocketNewtab: {
        description: string;
        owner: string;
        hasExposure: boolean;
        isEarlyStartup: boolean;
        variables: {
            spocTopsitesPositions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            contileTopsitesPositions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocAdTypes: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocZoneIds: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocTopsitesAdTypes: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocTopsitesZoneIds: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocTopsitesPlacementEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocSiteId: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            widgetPositions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            hybridLayout: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            hideCardBackground: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            fourCardLayout: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            newFooterSection: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            saveToPocketCard: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            saveToPocketCardRegions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            hideDescriptions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            hideDescriptionsRegions: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            compactGrid: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            compactImages: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            imageGradient: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            titleLines: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            descLines: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            onboardingExperience: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            essentialReadsHeader: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            editorsPicksHeader: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            recentSavesEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            readTime: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            newSponsoredLabel: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            sendToPocket: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            wallpapers: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            wallpapersHighlightEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            wallpaperHighlightHeaderText: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            wallpaperHighlightContentText: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            wallpaperHighlightCtaText: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            currentWallpaper: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            weatherLocationSearch: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            recsPersonalized: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            spocsPersonalized: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            discoveryStreamConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            spocsEndpoint: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            spocsEndpointAllowlist: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            spocsClearEndpoint: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ctaButtonSponsors: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            ctaButtonVariant: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            spocMessageVariant: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            regionStoriesConfig: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            regionBffConfig: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoProviderEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoProviderEndpoint: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            regionStoriesBlock: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            localeListConfig: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            regionSpocsConfig: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            regionWeatherConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            localeWeatherConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            topSitesMaxSponsored: {
                type: string;
                description: string;
            };
            topSitesContileMaxSponsored: {
                type: string;
                description: string;
            };
            topSitesContileSovEnabled: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            pocketFeedParameters: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            merinoFeedExperiment: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            thumbsUpDown: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            regionThumbsUpDownConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            localeThumbsUpDownConfig: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            thumbsUpDownCompactLayout: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    saveToPocket: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            emailButton: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            hideRecentSaves: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            bffRecentSaves: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            bffApi: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            oAuthConsumerKeyBff: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "password-autocomplete": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            directMigrateSingleProfile: {
                type: string;
                description: string;
            };
        };
    };
    "email-autocomplete-relay": {
        description: string;
        exposureDescription: string;
        hasExposure: boolean;
        owner: string;
        variables: {
            firstOfferVersion: {
                type: string;
                description: string;
                fallbackPref: string;
            };
            showToAllBrowsers: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "address-autofill-feature": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            status: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "creditcards-autofill-enabled": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            creditcardsSupported: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    shellService: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            disablePin: {
                type: string;
                description: string;
            };
            disableStartMenuPin: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            setDefaultBrowserUserChoice: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            setDefaultBrowserUserChoiceRegRename: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            setDefaultPDFHandler: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            setDefaultPDFHandlerOnlyReplaceBrowsers: {
                type: string;
                fallbackPref: string;
                description: string;
            };
            setDefaultGuidanceNotifications: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    upgradeDialog: {
        description: string;
        owner: string;
        hasExposure: boolean;
        isEarlyStartup: boolean;
        variables: {
            enabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    cfr: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "moments-page": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    infobar: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    spotlight: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    featureCallout: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    fullPageTranslation: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            boolean: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    fullPageTranslationAutomaticPopup: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            boolean: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    selectTranslation: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    pdfjs: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            enableAltText: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enableUpdatedAddImage: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            browserMlEnable: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enableSignatureEditor: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "fxms-message-1": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-2": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-3": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-4": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-5": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-6": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-7": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-8": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-9": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-10": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-11": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-12": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-13": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-14": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    "fxms-message-15": {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    whatsNewPage: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            overrideUrl: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            maxVersion: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            minVersion: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            disableWNP: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    pbNewtab: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    backgroundTaskMessage: {
        description: string;
        owner: string;
        applications: string[];
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    backgroundUpdateAutomaticRestart: {
        description: string;
        owner: string;
        applications: string[];
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    pictureinpicture: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            title: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            showIconOnly: {
                type: string;
                description: string;
            };
            oldToggle: {
                type: string;
                description: string;
            };
            displayDuration: {
                type: string;
                description: string;
            };
        };
    };
    glean: {
        description: string;
        owner: string;
        hasExposure: boolean;
        allowCoenrollment: boolean;
        variables: {
            gleanMetricConfiguration: {
                type: string;
                description: string;
            };
        };
    };
    gleanInternalSdk: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            finalInactive: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gleanMetricConfiguration: {
                type: string;
                description: string;
            };
            gleanMaxPingsPerMinute: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    browserLowMemoryPrefs: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            lowMemoryResponseMask: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            lowMemoryResponseOnWarn: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            tabsUnloadOnLowMemory: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    echPrefs: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            tlsEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            h3Enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            forceWaitHttpsRR: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            insecureFallback: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            tlsGreaseProb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            h3GreaseEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            disableGreaseOnFallback: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            greasePaddingSize: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    dohPrefs: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            trrMode: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            trrUri: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dohMode: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dohUri: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dohProviderList: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dohProviderSteeringList: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            nativeHTTPSRecords: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    dooh: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            ohttpEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ohttpRelayUri: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ohttpConfigUri: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ohttpUri: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networking: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            preconnect: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            networkPredictor: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            http3CCalgorithm: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enableOffMainThreadStreamDecompression: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            offMainThreadStreamDecompressionThreshold: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dnsGracePeriod: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            http3UseNSPRForIO: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingEarlyHints: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            ehPreloadEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ehPreconnectEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingDNS: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            dnsMaxPriorityThreads: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            dnsMaxAnyPriorityThreads: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            maxDnsCacheEntries: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingConnections: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            httpMaxConnections: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpMaxPersistentConnectionsPerServer: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            speculativeConnectionLimit: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingSendOnDataFinished: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            sendOnDataFinished: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            sendOnDataFinshedFromInputStreamPump: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            sendOnDataFinishedToHtml5parser: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            sendOnDataFinishedToCssLoader: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    essentialFallbackDomains: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            essentialDomainsEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    disableHttp3: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            withThirdPartyRoots: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkPrioritization: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            priorityHeader: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            fetchPriority: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            h3FetchPriority: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            sendNoRFC7540Setting: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            h2deps: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            h3BackgroundTabDeprioritization: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            documentPriorityIncremental: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            imagePriorityIncremental: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            imageAdjustLayoutPriority: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadScriptLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadScriptHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadScriptAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustModuleScriptLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustModuleScriptHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustModuleScriptAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustAsyncOrDeferScriptLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustAsyncOrDeferScriptHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustAsyncOrDeferScriptAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustScriptInHeadLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustScriptInHeadHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustScriptInHeadAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustOtherScriptLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustOtherScriptHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustOtherScriptAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFontLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFontHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFontAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFetchLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFetchHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadFetchAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustDeferredStyleLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustDeferredStyleHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustDeferredStyleAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadStyleLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadStyleHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustLinkPreloadStyleAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustNonDeferredStyleLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustNonDeferredStyleHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustNonDeferredStyleAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustGlobalFetchApiLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustGlobalFetchApiHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustGlobalFetchApiAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustImagesLow: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustImagesHigh: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            adjustImagesAuto: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            lowerTrackersPriority: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enableHttpTailing: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpTailingUrgency: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpTailingDelayQuantum: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpTailingDelayQuantumAfterDCL: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpTailingMaxDelay: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            httpTailingTotalMaxDelay: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingAuth: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            redirectForAuthRetriesEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    networkingDenyIpAddrAny: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            denyIpAddrAny: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    cookieStore: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            managerEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    pingsender: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            backgroundTaskEnabled: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    dapTelemetry: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
            };
            task1Enabled: {
                type: string;
                description: string;
            };
            task1TaskId: {
                type: string;
                description: string;
            };
            visitCountingEnabled: {
                type: string;
                description: string;
            };
            visitCountingExperimentList: {
                type: string;
                description: string;
            };
        };
    };
    dapAggregators: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            leader_url: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            leader_hpke: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            helper_url: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            helper_hpke: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    etpLevel2PBMPref: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    etpStrictFeatures: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            features: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    thirdPartyCookieBlocking: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enabledPBM: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    thirdPartyTrackerCookieBlocking: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    fxaButtonVisibility: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            boolean: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            pxiToolbarEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            monitorEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            relayEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            vpnEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            avatarIconVariant: {
                description: string;
                type: string;
            };
        };
    };
    fxaClientAssociation: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            pingEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    fxaAppMenuItem: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            ctaCopyVariant: {
                description: string;
                type: string;
            };
        };
    };
    fxaAvatarMenuItem: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            ctaCopyVariant: {
                description: string;
                type: string;
            };
        };
    };
    legacyHeartbeat: {
        description: string;
        owner: string;
        hasExposure: boolean;
        schema: {
            uri: string;
            path: string;
        };
        variables: {
            survey: {
                type: string;
                description: string;
            };
        };
    };
    queryStripping: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabledNormalBrowsing: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enabledPrivateBrowsing: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            allowList: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            stripList: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    fontvisibility: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabledETP: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enabledStandard: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enabledPBM: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    fingerprintingProtection: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabledNormal: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enabledPrivate: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            overrides: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            fdlibm_math: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            canvas_random_use_siphash: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enabledBaseline: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            overridesBaseline: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    userCharacteristics: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            currentVersion: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    migrationWizard: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            showImportAll: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            showPreferencesEntrypoint: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            aboutWelcomeBehavior: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            migrateExtensions: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            chromeCanRequestPermissions: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    mixedContentUpgrading: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            image: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            audio: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            video: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    gc: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            max_nursery_size: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            min_nursery_size: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_allocation_threshold_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_balanced_heap_limits: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_compacting: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_generational: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_heap_growth_factor: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_helper_thread_ratio: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_high_frequency_large_heap_growth: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_high_frequency_small_heap_growth: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_high_frequency_time_limit_ms: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_incremental: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            incremental_weakmap: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_incremental_slice_ms: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_large_heap_incremental_limit: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_large_heap_size_min_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_low_frequency_heap_growth: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_malloc_threshold_base_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_max_empty_chunk_count: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_max_helper_threads: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_min_empty_chunk_count: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_parallel_marking: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_parallel_marking_threshold_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_max_parallel_marking_threads: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_per_zone: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_small_heap_incremental_limit: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_small_heap_size_max_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            gc_urgent_threshold_mb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            nursery_eager_collection_threshold_kb: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            nursery_eager_collection_threshold_percent: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            nursery_eager_collection_timeout_ms: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            nursery_max_time_goal_ms: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    jsParallelParsing: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    jitThresholds: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            blinterp_threshold: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            baseline_threshold: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ion_threshold: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ion_bailout_threshold: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ion_offthread_compilation: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            inlining_max_length: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    jitHintsCache: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    raceCacheWithNetwork: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    opaqueResponseBlocking: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            javascriptValidator: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            filterFetchResponse: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            mediaExceptionsStrategy: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    updatePrompt: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            showReleaseNotesLink: {
                type: string;
                description: string;
            };
            releaseNotesURL: {
                type: string;
                fallbackPref: string;
                description: string;
            };
        };
    };
    powerSaver: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            reduceFrameRates: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            mediaAutoPlay: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            backgroundTimerMinTime: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            backgroundTimerRegenerationRate: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    backgroundUpdate: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            enableUpdatesForUnelevatedInstallations: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    bookmarks: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enableBookmarksToolbar: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            showOtherBookmarks: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    cookieBannerHandling: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            modeNormalBrowsing: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            modePrivateBrowsing: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enableGlobalRules: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enableGlobalRulesSubFrames: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enableDetectOnly: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enableFirefoxDesktopUI: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enablePromo: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            enableDesktopFeatureCallout: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    backgroundThreads: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            use_low_power: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            lower_mainthread_priority_in_background: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    reportBrokenSite: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sendMoreInfo: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            reasonDropdown: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    feltPrivacy: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            feltPrivacy: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            resetPBMAction: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    phc: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            phcEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            phcMinRamMB: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            phcAvgDelayFirst: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            phcAvgDelayNormal: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            phcAvgDelayPageReuse: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    mailto: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            dualPrompt: {
                type: string;
                description: string;
                fallbackPref: string;
            };
            "dualPrompt.onLocationChange": {
                type: string;
                description: string;
                fallbackPref: string;
            };
            "dualPrompt.dismissXClickMinutes": {
                type: string;
                description: string;
                fallbackPref: string;
            };
            "dualPrompt.dismissNotNowMinutes": {
                type: string;
                description: string;
                fallbackPref: string;
            };
        };
    };
    nimbusIsReady: {
        description: string;
        owner: string;
        hasExposure: boolean;
        applications: string[];
        variables: {
            eventCount: {
                description: string;
                type: string;
            };
        };
    };
    nimbusTelemetry: {
        description: string;
        owner: string;
        hasExposure: boolean;
        applications: string[];
        variables: {
            gleanMetricConfiguration: {
                description: string;
                type: string;
            };
            nimbusTargetingEnvironment: {
                description: string;
                type: string;
            };
        };
        schema: {
            uri: string;
            path: string;
        };
    };
    httpsFirst: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enabledPbm: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            enabledSchemeless: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            backgroundTimerMs: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    contentRelevancy: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                description: string;
                type: string;
                fallbackPref: string;
            };
            maxInputUrls: {
                description: string;
                type: string;
            };
            minInputUrls: {
                description: string;
                type: string;
            };
            timerInterval: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            ingestEnabled: {
                description: string;
                type: string;
                fallbackPref: string;
            };
        };
    };
    backupService: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            prefsUIEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sqlitePagesPerStep: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            sqliteStepDelayMs: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            idleThresholdSeconds: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            minTimeBetweenBackupsSeconds: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    pqcrypto: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            tlsEnableMlkem: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            h3EnableMlkem: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            sendP256: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            dtlsWebRTCEnableMlkem: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    dtlsWebRTC: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            tlsVersionDTLS: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    certCompression: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            tlsEnableZlib: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            tlsEnableBrotli: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            tlsEnableZstd: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    bounceTrackingProtection: {
        description: string;
        owner: string;
        isEarlyStartup: boolean;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            mode: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            requireStatefulBounces: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    remoteTabManagement: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            closeTabsEnabled: {
                description: string;
                type: string;
                fallbackPref: string;
            };
        };
    };
    crlite: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            channel: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            mode: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            timestamps_for_coverage: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    chatbot: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            minVersion: {
                type: string;
                description: string;
            };
            prefs: {
                type: string;
                description: string;
            };
        };
    };
    linkPreviews: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    sidebar: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            defaultLauncherVisible: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            minVersion: {
                type: string;
                description: string;
            };
            revamp: {
                type: string;
                description: string;
            };
            verticalTabs: {
                type: string;
                description: string;
            };
            visibility: {
                type: string;
                description: string;
            };
        };
    };
    fxms_bmb_button: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        schema: {
            uri: string;
            path: string;
        };
        variables: {};
    };
    contentProcessSandbox: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            Level: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    certificateTransparency: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            mode: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    setToDefaultPrompt: {
        description: string;
        owner: string;
        hasExposure: boolean;
        exposureDescription: string;
        variables: {
            showSpotlightPrompt: {
                description: string;
                type: string;
            };
            message: {
                description: string;
                type: string;
            };
        };
    };
    tabGroups: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    smartTabGroups: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            suggestOtherTabsMethod: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            topicModelRevision: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            embeddingModelRevision: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            nearestNeighborThresholdInt: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    smartblockEmbeds: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    selectableProfiles: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
            };
        };
    };
    storageAccessHeuristics: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            popup_past_interaction: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            popup_interaction: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            navigation: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            redirect: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            redirect_tracker: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "partitioned-cookie-attribute": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            chipsMigrationTarget: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            chipsPartitionLimitEnabled: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            chipsPartitionLimitDryRun: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
            chipsPartitionLimitByteCapacity: {
                description: string;
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "auto-pip": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "urlbar-ime-search": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "web-rtc-global-mute-toggles": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "jpeg-xl": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "css-masonry": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    "contextual-password-manager": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
    "h1-in-section-styles": {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    windowsUIAutomation: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            enabled: {
                type: string;
                description: string;
                enum: number[];
                setPref: {
                    branch: string;
                    pref: string;
                };
            };
        };
    };
    expandSignInButton: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            ctaCopyVariant: {
                description: string;
                type: string;
            };
        };
    };
    contextID: {
        description: string;
        owner: string;
        hasExposure: boolean;
        variables: {
            rotationPeriodInDays: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
            rustBackendEnabled: {
                type: string;
                setPref: {
                    branch: string;
                    pref: string;
                };
                description: string;
            };
        };
    };
};
