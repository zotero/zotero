export function modifySchemaForTests(customSchema: any): void;
export namespace schema {
    let $schema: string;
    let type: string;
    let properties: {
        "3rdparty": {
            type: string;
            properties: {
                Extensions: {
                    type: string;
                    patternProperties: {
                        "^.*$": {
                            type: string;
                        };
                    };
                };
            };
        };
        AllowedDomainsForApps: {
            type: string;
        };
        AllowFileSelectionDialogs: {
            type: string;
        };
        AppAutoUpdate: {
            type: string;
        };
        AppUpdatePin: {
            type: string;
        };
        AppUpdateURL: {
            type: string;
        };
        Authentication: {
            type: string;
            properties: {
                SPNEGO: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                Delegated: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                NTLM: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                AllowNonFQDN: {
                    type: string;
                    properties: {
                        SPNEGO: {
                            type: string;
                        };
                        NTLM: {
                            type: string;
                        };
                    };
                };
                AllowProxies: {
                    type: string;
                    properties: {
                        SPNEGO: {
                            type: string;
                        };
                        NTLM: {
                            type: string;
                        };
                    };
                };
                Locked: {
                    type: string;
                };
                PrivateBrowsing: {
                    type: string;
                };
            };
        };
        AutofillAddressEnabled: {
            type: string;
        };
        AutofillCreditCardEnabled: {
            type: string;
        };
        AutoLaunchProtocolsFromOrigins: {
            type: string[];
            items: {
                type: string;
                properties: {
                    allowed_origins: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                    protocol: {
                        type: string;
                    };
                    required: string[];
                };
            };
        };
        BackgroundAppUpdate: {
            type: string;
        };
        BlockAboutAddons: {
            type: string;
        };
        BlockAboutConfig: {
            type: string;
        };
        BlockAboutProfiles: {
            type: string;
        };
        BlockAboutSupport: {
            type: string;
        };
        Bookmarks: {
            type: string;
            items: {
                type: string;
                properties: {
                    Title: {
                        type: string;
                    };
                    URL: {
                        type: string;
                    };
                    Favicon: {
                        type: string;
                    };
                    Placement: {
                        type: string;
                        enum: string[];
                    };
                    Folder: {
                        type: string;
                    };
                };
                required: string[];
            };
        };
        CaptivePortal: {
            type: string;
        };
        Certificates: {
            type: string;
            properties: {
                ImportEnterpriseRoots: {
                    type: string;
                };
                Install: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
        };
        Containers: {
            type: string;
            properties: {
                Default: {
                    type: string[];
                    items: {
                        properties: {
                            name: {
                                type: string;
                            };
                            icon: {
                                type: string;
                                enum: string[];
                            };
                            color: {
                                type: string;
                                enum: string[];
                            };
                        };
                        type: string;
                    };
                };
            };
        };
        ContentAnalysis: {
            type: string;
            properties: {
                Enabled: {
                    type: string;
                };
                PipePathName: {
                    type: string;
                };
                AgentTimeout: {
                    type: string;
                };
                AllowUrlRegexList: {
                    type: string;
                };
                DenyUrlRegexList: {
                    type: string;
                };
                AgentName: {
                    type: string;
                };
                ClientSignature: {
                    type: string;
                };
                IsPerUser: {
                    type: string;
                };
                MaxConnectionsCount: {
                    type: string;
                };
                ShowBlockedResult: {
                    type: string;
                };
                DefaultResult: {
                    type: string;
                };
                TimeoutResult: {
                    type: string;
                };
                BypassForSameTabOperations: {
                    type: string;
                };
                InterceptionPoints: {
                    type: string;
                    properties: {
                        Clipboard: {
                            type: string;
                            properties: {
                                Enabled: {
                                    type: string;
                                };
                                PlainTextOnly: {
                                    type: string;
                                };
                            };
                        };
                        DragAndDrop: {
                            type: string;
                            properties: {
                                Enabled: {
                                    type: string;
                                };
                                PlainTextOnly: {
                                    type: string;
                                };
                            };
                        };
                        FileUpload: {
                            type: string;
                            properties: {
                                Enabled: {
                                    type: string;
                                };
                            };
                        };
                        Print: {
                            type: string;
                            properties: {
                                Enabled: {
                                    type: string;
                                };
                            };
                        };
                    };
                };
            };
        };
        Cookies: {
            type: string;
            properties: {
                Allow: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                AllowSession: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                Block: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                Default: {
                    type: string;
                };
                AcceptThirdParty: {
                    type: string;
                    enum: string[];
                };
                RejectTracker: {
                    type: string;
                };
                ExpireAtSessionEnd: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
                Behavior: {
                    type: string;
                    enum: string[];
                };
                BehaviorPrivateBrowsing: {
                    type: string;
                    enum: string[];
                };
            };
        };
        DefaultDownloadDirectory: {
            type: string;
        };
        DisableAccounts: {
            type: string;
        };
        DisableAppUpdate: {
            type: string;
        };
        DisableBuiltinPDFViewer: {
            type: string;
        };
        DisabledCiphers: {
            type: string;
            properties: {
                TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256: {
                    type: string;
                };
                TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256: {
                    type: string;
                };
                TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256: {
                    type: string;
                };
                TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256: {
                    type: string;
                };
                TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384: {
                    type: string;
                };
                TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384: {
                    type: string;
                };
                TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA: {
                    type: string;
                };
                TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA: {
                    type: string;
                };
                TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA: {
                    type: string;
                };
                TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA: {
                    type: string;
                };
                TLS_DHE_RSA_WITH_AES_128_CBC_SHA: {
                    type: string;
                };
                TLS_DHE_RSA_WITH_AES_256_CBC_SHA: {
                    type: string;
                };
                TLS_RSA_WITH_AES_128_GCM_SHA256: {
                    type: string;
                };
                TLS_RSA_WITH_AES_256_GCM_SHA384: {
                    type: string;
                };
                TLS_RSA_WITH_AES_128_CBC_SHA: {
                    type: string;
                };
                TLS_RSA_WITH_AES_256_CBC_SHA: {
                    type: string;
                };
                TLS_RSA_WITH_3DES_EDE_CBC_SHA: {
                    type: string;
                };
                TLS_CHACHA20_POLY1305_SHA256: {
                    type: string;
                };
                TLS_AES_128_GCM_SHA256: {
                    type: string;
                };
                TLS_AES_256_GCM_SHA384: {
                    type: string;
                };
            };
        };
        DisableDefaultBrowserAgent: {
            type: string;
        };
        DisableDeveloperTools: {
            type: string;
        };
        DisableEncryptedClientHello: {
            type: string;
        };
        DisableFeedbackCommands: {
            type: string;
        };
        DisableFirefoxAccounts: {
            type: string;
        };
        DisableFirefoxScreenshots: {
            type: string;
        };
        DisableFirefoxStudies: {
            type: string;
        };
        DisableForgetButton: {
            type: string;
        };
        DisableFormHistory: {
            type: string;
        };
        DisableMasterPasswordCreation: {
            type: string;
        };
        DisablePasswordReveal: {
            type: string;
        };
        DisablePocket: {
            type: string;
        };
        DisablePrivateBrowsing: {
            type: string;
        };
        DisableProfileImport: {
            type: string;
        };
        DisableProfileRefresh: {
            type: string;
        };
        DisableSafeMode: {
            type: string;
        };
        DisableSecurityBypass: {
            type: string;
            properties: {
                InvalidCertificate: {
                    type: string;
                };
                SafeBrowsing: {
                    type: string;
                };
            };
        };
        DisableSetDesktopBackground: {
            type: string;
        };
        DisableSystemAddonUpdate: {
            type: string;
        };
        DisableTelemetry: {
            type: string;
        };
        DisableThirdPartyModuleBlocking: {
            type: string;
        };
        DisplayBookmarksToolbar: {
            type: string[];
            enum: string[];
        };
        DisplayMenuBar: {
            type: string[];
            enum: string[];
        };
        DNSOverHTTPS: {
            type: string;
            properties: {
                Enabled: {
                    type: string;
                };
                ProviderURL: {
                    type: string;
                };
                ExcludedDomains: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                Fallback: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        DontCheckDefaultBrowser: {
            type: string;
        };
        DownloadDirectory: {
            type: string;
        };
        EnableTrackingProtection: {
            type: string;
            properties: {
                Value: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
                Cryptomining: {
                    type: string;
                };
                Fingerprinting: {
                    type: string;
                };
                EmailTracking: {
                    type: string;
                };
                Exceptions: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
            };
        };
        EncryptedMediaExtensions: {
            type: string;
            properties: {
                Enabled: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        ExemptDomainFileTypePairsFromFileTypeDownloadWarnings: {
            type: string;
            items: {
                type: string;
                properties: {
                    file_extension: {
                        type: string;
                    };
                    domains: {
                        type: string;
                        items: {
                            type: string;
                        };
                    };
                };
            };
        };
        Extensions: {
            type: string;
            properties: {
                Install: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                Uninstall: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                Locked: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
        };
        ExtensionSettings: {
            type: string[];
            properties: {
                "*": {
                    type: string;
                    properties: {
                        installation_mode: {
                            type: string;
                            enum: string[];
                        };
                        allowed_types: {
                            type: string;
                            items: {
                                type: string;
                                enum: string[];
                            };
                        };
                        blocked_install_message: {
                            type: string;
                        };
                        install_sources: {
                            type: string;
                            items: {
                                type: string;
                            };
                        };
                        restricted_domains: {
                            type: string;
                            items: {
                                type: string;
                            };
                        };
                        temporarily_allow_weak_signatures: {
                            type: string;
                        };
                    };
                };
            };
            patternProperties: {
                "^.*$": {
                    type: string;
                    properties: {
                        installation_mode: {
                            type: string;
                            enum: string[];
                        };
                        install_url: {
                            type: string;
                        };
                        blocked_install_message: {
                            type: string;
                        };
                        updates_disabled: {
                            type: string;
                        };
                        default_area: {
                            type: string;
                            enum: string[];
                        };
                        temporarily_allow_weak_signatures: {
                            type: string;
                        };
                        private_browsing: {
                            type: string;
                        };
                    };
                };
            };
        };
        ExtensionUpdate: {
            type: string;
        };
        FirefoxHome: {
            type: string;
            properties: {
                Search: {
                    type: string;
                };
                TopSites: {
                    type: string;
                };
                SponsoredTopSites: {
                    type: string;
                };
                Highlights: {
                    type: string;
                };
                Pocket: {
                    type: string;
                };
                SponsoredPocket: {
                    type: string;
                };
                Snippets: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        FirefoxSuggest: {
            type: string;
            properties: {
                WebSuggestions: {
                    type: string;
                };
                SponsoredSuggestions: {
                    type: string;
                };
                ImproveSuggest: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        GoToIntranetSiteForSingleWordEntryInAddressBar: {
            type: string;
        };
        Handlers: {
            type: string[];
            patternProperties: {
                "^(mimeTypes|extensions|schemes)$": {
                    type: string;
                    patternProperties: {
                        "^.*$": {
                            type: string;
                            properties: {
                                action: {
                                    type: string;
                                    enum: string[];
                                };
                                ask: {
                                    type: string;
                                };
                                handlers: {
                                    type: string;
                                    items: {
                                        type: string;
                                        properties: {
                                            name: {
                                                type: string;
                                            };
                                            path: {
                                                type: string;
                                            };
                                            uriTemplate: {
                                                type: string;
                                            };
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        HardwareAcceleration: {
            type: string;
        };
        Homepage: {
            type: string;
            properties: {
                URL: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
                Additional: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                StartPage: {
                    type: string;
                    enum: string[];
                };
            };
        };
        HttpAllowlist: {
            type: string;
            strict: boolean;
            items: {
                type: string;
            };
        };
        HttpsOnlyMode: {
            type: string;
            enum: string[];
        };
        InstallAddonsPermission: {
            type: string;
            properties: {
                Allow: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                Default: {
                    type: string;
                };
            };
        };
        LegacyProfiles: {
            type: string;
        };
        LegacySameSiteCookieBehaviorEnabled: {
            type: string;
        };
        LegacySameSiteCookieBehaviorEnabledForDomainList: {
            type: string;
            items: {
                type: string;
            };
        };
        LocalFileLinks: {
            type: string;
            items: {
                type: string;
            };
        };
        ManagedBookmarks: {
            items: {
                properties: {
                    children: {
                        items: {
                            properties: {
                                name: {
                                    type: string;
                                };
                                toplevel_name: {
                                    type: string;
                                };
                                url: {
                                    type: string;
                                };
                                children: {
                                    items: {
                                        type: string;
                                    };
                                    type: string;
                                };
                            };
                            type: string;
                        };
                        type: string;
                    };
                    name: {
                        type: string;
                    };
                    toplevel_name: {
                        type: string;
                    };
                    url: {
                        type: string;
                    };
                };
                type: string;
            };
            type: string[];
        };
        ManualAppUpdateOnly: {
            type: string;
        };
        MicrosoftEntraSSO: {
            type: string;
        };
        NetworkPrediction: {
            type: string;
        };
        NewTabPage: {
            type: string;
        };
        NoDefaultBookmarks: {
            type: string;
        };
        OfferToSaveLogins: {
            type: string;
        };
        OfferToSaveLoginsDefault: {
            type: string;
        };
        OverrideFirstRunPage: {
            type: string;
        };
        OverridePostUpdatePage: {
            type: string;
        };
        PasswordManagerEnabled: {
            type: string;
        };
        PasswordManagerExceptions: {
            type: string;
            strict: boolean;
            items: {
                type: string;
            };
        };
        PDFjs: {
            type: string;
            properties: {
                Enabled: {
                    type: string;
                };
                EnablePermissions: {
                    type: string;
                };
            };
        };
        Permissions: {
            type: string;
            properties: {
                Camera: {
                    type: string;
                    properties: {
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        BlockNewRequests: {
                            type: string;
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
                Microphone: {
                    type: string;
                    properties: {
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        BlockNewRequests: {
                            type: string;
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
                Autoplay: {
                    type: string;
                    properties: {
                        Default: {
                            type: string;
                            enum: string[];
                        };
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
                Location: {
                    type: string;
                    properties: {
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        BlockNewRequests: {
                            type: string;
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
                Notifications: {
                    type: string;
                    properties: {
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        BlockNewRequests: {
                            type: string;
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
                VirtualReality: {
                    type: string;
                    properties: {
                        Allow: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        Block: {
                            type: string;
                            strict: boolean;
                            items: {
                                type: string;
                            };
                        };
                        BlockNewRequests: {
                            type: string;
                        };
                        Locked: {
                            type: string;
                        };
                    };
                };
            };
        };
        PictureInPicture: {
            type: string;
            properties: {
                Enabled: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        PopupBlocking: {
            type: string;
            properties: {
                Allow: {
                    type: string;
                    strict: boolean;
                    items: {
                        type: string;
                    };
                };
                Default: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        PostQuantumKeyAgreementEnabled: {
            type: string;
        };
        Preferences: {
            type: string[];
            patternProperties: {
                "^.*$": {
                    type: string[];
                    properties: {
                        Value: {
                            type: string[];
                        };
                        Status: {
                            type: string;
                            enum: string[];
                        };
                        Type: {
                            type: string;
                            enum: string[];
                        };
                    };
                };
            };
        };
        PrimaryPassword: {
            type: string;
        };
        PrintingEnabled: {
            type: string;
        };
        PrivateBrowsingModeAvailability: {
            type: string;
            enum: number[];
        };
        PromptForDownloadLocation: {
            type: string;
        };
        Proxy: {
            type: string;
            properties: {
                Mode: {
                    type: string;
                    enum: string[];
                };
                Locked: {
                    type: string;
                };
                AutoConfigURL: {
                    type: string;
                };
                FTPProxy: {
                    type: string;
                };
                HTTPProxy: {
                    type: string;
                };
                SSLProxy: {
                    type: string;
                };
                SOCKSProxy: {
                    type: string;
                };
                SOCKSVersion: {
                    type: string;
                    enum: number[];
                };
                UseHTTPProxyForAllProtocols: {
                    type: string;
                };
                Passthrough: {
                    type: string;
                };
                UseProxyForDNS: {
                    type: string;
                };
                AutoLogin: {
                    type: string;
                };
            };
        };
        RequestedLocales: {
            type: string[];
            items: {
                type: string;
            };
        };
        SanitizeOnShutdown: {
            type: string[];
            properties: {
                Cache: {
                    type: string;
                };
                Cookies: {
                    type: string;
                };
                Downloads: {
                    type: string;
                };
                FormData: {
                    type: string;
                };
                History: {
                    type: string;
                };
                Sessions: {
                    type: string;
                };
                SiteSettings: {
                    type: string;
                };
                OfflineApps: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        SearchBar: {
            type: string;
            enum: string[];
        };
        SearchEngines: {
            type: string;
            properties: {
                Add: {
                    type: string;
                    items: {
                        type: string;
                        required: string[];
                        properties: {
                            Name: {
                                type: string;
                            };
                            IconURL: {
                                type: string;
                            };
                            Alias: {
                                type: string;
                            };
                            Description: {
                                type: string;
                            };
                            Encoding: {
                                type: string;
                            };
                            Method: {
                                type: string;
                                enum: string[];
                            };
                            URLTemplate: {
                                type: string;
                            };
                            PostData: {
                                type: string;
                            };
                            SuggestURLTemplate: {
                                type: string;
                            };
                        };
                    };
                };
                Default: {
                    type: string;
                };
                DefaultPrivate: {
                    type: string;
                };
                PreventInstalls: {
                    type: string;
                };
                Remove: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
        };
        SearchSuggestEnabled: {
            type: string;
        };
        SecurityDevices: {
            type: string;
            patternProperties: {
                "^.*$": {
                    type: string;
                };
            };
            properties: {
                Add: {
                    type: string;
                    patternProperties: {
                        "^.*$": {
                            type: string;
                        };
                    };
                };
                Delete: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
        };
        ShowHomeButton: {
            type: string;
        };
        SkipTermsOfUse: {
            type: string;
        };
        SSLVersionMax: {
            type: string;
            enum: string[];
        };
        SSLVersionMin: {
            type: string;
            enum: string[];
        };
        StartDownloadsInTempDirectory: {
            type: string;
        };
        SupportMenu: {
            type: string;
            properties: {
                Title: {
                    type: string;
                };
                URL: {
                    type: string;
                };
                AccessKey: {
                    type: string;
                };
            };
            required: string[];
        };
        TranslateEnabled: {
            type: string;
        };
        UserMessaging: {
            type: string;
            properties: {
                WhatsNew: {
                    type: string;
                };
                ExtensionRecommendations: {
                    type: string;
                };
                FeatureRecommendations: {
                    type: string;
                };
                UrlbarInterventions: {
                    type: string;
                };
                SkipOnboarding: {
                    type: string;
                };
                MoreFromMozilla: {
                    type: string;
                };
                FirefoxLabs: {
                    type: string;
                };
                Locked: {
                    type: string;
                };
            };
        };
        UseSystemPrintDialog: {
            type: string;
        };
        WebsiteFilter: {
            type: string[];
            properties: {
                Block: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                Exceptions: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
        };
        WindowsSSO: {
            type: string;
        };
    };
}
