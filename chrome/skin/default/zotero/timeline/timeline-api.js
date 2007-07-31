/*==================================================
 *  Timeline API
 *
 *  This file will load all the Javascript files
 *  necessary to make the standard timeline work.
 *  It also detects the default locale.
 *
 *  Include this file in your HTML file as follows:
 *
 *    <script src="http://simile.mit.edu/timeline/api/scripts/timeline-api.js" type="text/javascript"></script>
 *
 *==================================================
 */
 
var Timeline = new Object();
Timeline.Platform = new Object();

    /*
        HACK: We need these 2 things here because we cannot simply append
        a <script> element containing code that accesses Timeline.Platform
        to initialize it because IE executes that <script> code first
        before it loads timeline.js and util/platform.js.
    */

(function() {
    var bundle = true;
    var javascriptFiles = [
        "timeline.js",
        
        "util/platform.js",
        "util/debug.js",
        "util/xmlhttp.js",
        "util/dom.js",
        "util/graphics.js",
        "util/date-time.js",
        "util/data-structure.js",
        "util/html.js",
        
        "units.js",
        "themes.js",
        "ethers.js",
        "ether-painters.js",
        "labellers.js",
        "sources.js",
        "layouts.js",
        "painters.js",
        "decorators.js"
    ];
    var cssFiles = [
        "timeline.css",
        "ethers.css",
        "events.css"
    ];
    
    // ISO-639 language codes, ISO-3166 country codes (2 characters)
    var supportedLocales = [
        "cs",       // Czech
        "de",       // German
        "en",       // English
        "es",       // Spanish
        "fr",       // French
        "it",       // Italian
        "ru",       // Russian
        "se",       // Swedish
        "vi",       // Vietnamese
        "zh"        // Chinese
    ];
    
    try {
        var desiredLocales = [ "en" ];
        var defaultServerLocale = "en";
        
        var parseURLParameters = function(parameters) {
            var params = parameters.split("&");
            for (var p = 0; p < params.length; p++) {
                var pair = params[p].split("=");
                if (pair[0] == "locales") {
                    desiredLocales = desiredLocales.concat(pair[1].split(","));
                } else if (pair[0] == "defaultLocale") {
                    defaultServerLocale = pair[1];
                } else if (pair[0] == "bundle") {
                    bundle = pair[1] != "false";
                }
            }
        };
        
        (function() {
            if (typeof Timeline_urlPrefix == "string") {
                Timeline.urlPrefix = Timeline_urlPrefix;
                if (typeof Timeline_parameters == "string") {
                    parseURLParameters(Timeline_parameters);
                }
            } else {
                var heads = document.documentElement.getElementsByTagName("head");
                for (var h = 0; h < heads.length; h++) {
                    var scripts = heads[h].getElementsByTagName("script");
                    for (var s = 0; s < scripts.length; s++) {
                        var url = scripts[s].src;
                        var i = url.indexOf("timeline-api.js");
                        if (i >= 0) {
                            Timeline.urlPrefix = url.substr(0, i);
                            var q = url.indexOf("?");
                            if (q > 0) {
                                parseURLParameters(url.substr(q + 1));
                            }
                            return;
                        }
                    }
                }
                throw new Error("Failed to derive URL prefix for Timeline API code files");
            }
        })();
        
        var includeJavascriptFiles;
        var includeCssFiles;
        if ("SimileAjax" in window) {
            includeJavascriptFiles = function(urlPrefix, filenames) {
                SimileAjax.includeJavascriptFiles(document, urlPrefix, filenames);
            }
            includeCssFiles = function(urlPrefix, filenames) {
                SimileAjax.includeCssFiles(document, urlPrefix, filenames);
            }
        } else {
            var getHead = function() {
                return document.getElementsByTagName("head")[0];
            };
            var includeJavascriptFile = function(url) {
                if (document.body == null) {
                    try {
                        document.write("<script src='" + url + "' type='text/javascript'></script>");
                        return;
                    } catch (e) {
                        // fall through
                    }
                }
                
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.language = "JavaScript";
                script.src = url;
                getHead().appendChild(script);
            };
            var includeCssFile = function(url) {
                if (document.body == null) {
                    try {
                        document.write("<link rel='stylesheet' href='" + url + "' type='text/css'/>");
                        return;
                    } catch (e) {
                        // fall through
                    }
                }
                
                var link = document.createElement("link");
                link.setAttribute("rel", "stylesheet");
                link.setAttribute("type", "text/css");
                link.setAttribute("href", url);
                getHead().appendChild(link);
            }
            
            includeJavascriptFiles = function(urlPrefix, filenames) {
                for (var i = 0; i < filenames.length; i++) {
                    includeJavascriptFile(urlPrefix + filenames[i]);
                }
            };
            includeCssFiles = function(urlPrefix, filenames) {
                for (var i = 0; i < filenames.length; i++) {
                    includeCssFile(urlPrefix + filenames[i]);
                }
            };
        }
        
        /*
         *  Include non-localized files
         */
        if (bundle) {
            includeJavascriptFiles(Timeline.urlPrefix, [ "bundle.js" ]);
            includeCssFiles(Timeline.urlPrefix, [ "bundle.css" ]);
        } else {
            includeJavascriptFiles(Timeline.urlPrefix + "scripts/", javascriptFiles);
            includeCssFiles(Timeline.urlPrefix + "styles/", cssFiles);
        }
        
        /*
         *  Include localized files
         */
        var loadLocale = [];
        loadLocale[defaultServerLocale] = true;
        
        var tryExactLocale = function(locale) {
            for (var l = 0; l < supportedLocales.length; l++) {
                if (locale == supportedLocales[l]) {
                    loadLocale[locale] = true;
                    return true;
                }
            }
            return false;
        }
        var tryLocale = function(locale) {
            if (tryExactLocale(locale)) {
                return locale;
            }
            
            var dash = locale.indexOf("-");
            if (dash > 0 && tryExactLocale(locale.substr(0, dash))) {
                return locale.substr(0, dash);
            }
            
            return null;
        }
        
        for (var l = 0; l < desiredLocales.length; l++) {
            tryLocale(desiredLocales[l]);
        }
        
        var defaultClientLocale = defaultServerLocale;
        var defaultClientLocales = ("language" in navigator ? navigator.language : navigator.browserLanguage).split(";");
        for (var l = 0; l < defaultClientLocales.length; l++) {
            var locale = tryLocale(defaultClientLocales[l]);
            if (locale != null) {
                defaultClientLocale = locale;
                break;
            }
        }
        
        Timeline.Platform.serverLocale = defaultServerLocale;
        Timeline.Platform.clientLocale = defaultClientLocale;
    } catch (e) {
        alert(e);
    }
})();