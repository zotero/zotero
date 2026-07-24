/*
    ***** BEGIN LICENSE BLOCK *****

    Copyright © 2026 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://www.zotero.org

    This file is part of Zotero.

    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.

    ***** END LICENSE BLOCK *****
*/

// In-process Core Spotlight bridge, built as a dylib and loaded via js-ctypes.
// Indexed items are attributed to Zotero.app's own bundle id.
// The C entry points below are called from spotlight.js.
// Entry activities are handled in XUL (the patched MacApplicationDelegate),
// as on a cold launch the activity arrives before this dylib is loaded.

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreSpotlight/CoreSpotlight.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

#define EXPORT __attribute__((visibility("default")))

// Spotlight domain is the app's own bundle id (per channel), so channels never collide.
static NSString *ZSDomain(void) {
    static NSString *domain = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        domain = [[NSBundle mainBundle] bundleIdentifier] ?: @"org.zotero.zotero";
    });
    return domain;
}

static NSString *ZSUniqueIdentifier(NSString *path) {
    return [NSString stringWithFormat:@"%@:%@", ZSDomain(), path];
}

// Per-library subdomain of the channel domain, e.g. "<bundleid>.library" or
// "<bundleid>.groups.123". Domain deletes are hierarchical, so deleting the
// channel domain clears everything while a library subdomain clears just one.
static NSString *ZSDomainForLibrary(NSString *token) {
    if (![token isKindOfClass:[NSString class]] || !token.length) {
        return ZSDomain();
    }
    return [NSString stringWithFormat:@"%@.%@", ZSDomain(), token];
}

static CSSearchableIndex *ZSIndex(void) {
    static CSSearchableIndex *index = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        index = [[CSSearchableIndex alloc] initWithName:ZSDomain()];
    });
    return index;
}

EXPORT const char *zotero_spotlight_bundle_id(void) {
    static const char *cached = NULL;
    if (!cached) {
        cached = strdup([ZSDomain() UTF8String]);
    }
    return cached;
}

// Diagnostics for why indexing might fail (Core Spotlight silently no-ops for an unsigned app).

static NSString *gLastError = nil;

static void ZSSetError(NSError *error) {
    @synchronized ([CSSearchableIndex class]) {
        gLastError = error.localizedDescription;
    }
    if (error) {
        NSLog(@"ZoteroSpotlight error: %@", error);
    }
}

EXPORT int zotero_spotlight_indexing_available(void) {
    return [CSSearchableIndex isIndexingAvailable] ? 1 : 0;
}

EXPORT const char *zotero_spotlight_last_error(void) {
    static char *buf = NULL;
    @synchronized ([CSSearchableIndex class]) {
        if (buf) {
            free(buf);
            buf = NULL;
        }
        if (gLastError) {
            buf = strdup([gLastError UTF8String]);
        }
    }
    return buf;
}

static NSData *ZSAppIconPNG(void) {
    static NSData *png = nil;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        NSImage *icon = [NSApp applicationIconImage];
        if (!icon) {
            return;
        }
        NSSize size = NSMakeSize(64, 64);
        NSBitmapImageRep *rep = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL
                          pixelsWide:(NSInteger)size.width
                          pixelsHigh:(NSInteger)size.height
                       bitsPerSample:8
                     samplesPerPixel:4
                            hasAlpha:YES
                            isPlanar:NO
                      colorSpaceName:NSDeviceRGBColorSpace
                         bytesPerRow:0
                        bitsPerPixel:0];
        if (!rep) {
            return;
        }
        [NSGraphicsContext saveGraphicsState];
        NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:rep];
        [icon drawInRect:NSMakeRect(0, 0, size.width, size.height)];
        [NSGraphicsContext restoreGraphicsState];
        png = [rep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    });
    return png;
}

static NSDate *ZSParseYear(NSString *date) {
    if (![date isKindOfClass:[NSString class]] || date.length < 4) {
        return nil;
    }
    NSDateComponents *comps = [[NSDateComponents alloc] init];
    comps.year = [[date substringToIndex:4] integerValue];
    if (comps.year <= 0) {
        return nil;
    }
    comps.month = 1;
    comps.day = 1;
    return [[NSCalendar calendarWithIdentifier:NSCalendarIdentifierGregorian] dateFromComponents:comps];
}

static id ZSParseJSON(const char *json) {
    if (!json) {
        return nil;
    }
    NSData *data = [NSData dataWithBytes:json length:strlen(json)];
    return [NSJSONSerialization JSONObjectWithData:data options:0 error:NULL];
}

// recordsJSON: array of { path, title, library?, description?, keywords?, content?, date? }
EXPORT int zotero_spotlight_index(const char *recordsJSON) {
    @autoreleasepool {
        id parsed = ZSParseJSON(recordsJSON);
        if (![parsed isKindOfClass:[NSArray class]]) {
            return 1;
        }
        NSData *icon = ZSAppIconPNG();
        NSMutableArray<CSSearchableItem *> *items = [NSMutableArray array];
        for (NSDictionary *record in (NSArray *)parsed) {
            if (![record isKindOfClass:[NSDictionary class]]) {
                continue;
            }
            NSString *path = record[@"path"];
            NSString *title = record[@"title"];
            if (![path isKindOfClass:[NSString class]] || ![title isKindOfClass:[NSString class]]) {
                continue;
            }
            CSSearchableItemAttributeSet *attrs =
                [[CSSearchableItemAttributeSet alloc] initWithContentType:UTTypeText];
            attrs.title = title;
            if ([record[@"description"] isKindOfClass:[NSString class]]) {
                attrs.contentDescription = record[@"description"];
            }
            if ([record[@"keywords"] isKindOfClass:[NSArray class]]) {
                attrs.keywords = record[@"keywords"];
            }
            // Searchable but not displayed -- fields, notes, filenames, full text.
            if ([record[@"content"] isKindOfClass:[NSString class]]) {
                attrs.textContent = record[@"content"];
            }
            NSDate *date = ZSParseYear(record[@"date"]);
            if (date) {
                attrs.contentCreationDate = date;
            }
            if (icon) {
                attrs.thumbnailData = icon;
            }
            [items addObject:[[CSSearchableItem alloc]
                initWithUniqueIdentifier:ZSUniqueIdentifier(path)
                        domainIdentifier:ZSDomainForLibrary(record[@"library"])
                            attributeSet:attrs]];
        }
        if (items.count) {
            [ZSIndex() indexSearchableItems:items
                completionHandler:^(NSError *error) {
                    ZSSetError(error);
                }];
        }
        return 0;
    }
}

// pathsJSON: array of zotero paths (e.g. "library/items/KEY")
EXPORT int zotero_spotlight_remove(const char *pathsJSON) {
    @autoreleasepool {
        id parsed = ZSParseJSON(pathsJSON);
        if (![parsed isKindOfClass:[NSArray class]]) {
            return 1;
        }
        NSMutableArray<NSString *> *ids = [NSMutableArray array];
        for (NSString *path in (NSArray *)parsed) {
            if ([path isKindOfClass:[NSString class]]) {
                [ids addObject:ZSUniqueIdentifier(path)];
            }
        }
        if (ids.count) {
            [ZSIndex() deleteSearchableItemsWithIdentifiers:ids
                completionHandler:^(NSError *error) {
                    ZSSetError(error);
                }];
        }
        return 0;
    }
}

// tokensJSON: array of library domain tokens (e.g. "groups.123"). Deletes every
// indexed item under each "<bundleid>.<token>" domain (and its subdomains).
EXPORT int zotero_spotlight_remove_libraries(const char *tokensJSON) {
    @autoreleasepool {
        id parsed = ZSParseJSON(tokensJSON);
        if (![parsed isKindOfClass:[NSArray class]]) {
            return 1;
        }
        NSMutableArray<NSString *> *domains = [NSMutableArray array];
        for (NSString *token in (NSArray *)parsed) {
            if ([token isKindOfClass:[NSString class]] && token.length) {
                [domains addObject:ZSDomainForLibrary(token)];
            }
        }
        if (domains.count) {
            [ZSIndex() deleteSearchableItemsWithDomainIdentifiers:domains
                completionHandler:^(NSError *error) {
                    ZSSetError(error);
                }];
        }
        return 0;
    }
}

EXPORT int zotero_spotlight_reset(void) {
    @autoreleasepool {
        [ZSIndex() deleteSearchableItemsWithDomainIdentifiers:@[ZSDomain()]
            completionHandler:^(NSError *error) {
                ZSSetError(error);
            }];
        return 0;
    }
}

// Read back the index for tests/diagnostics (mdfind can't see Core Spotlight):
// run a query (e.g. `title == "*term*"c`) -> JSON array of matching ids. Blocks briefly.
EXPORT const char *zotero_spotlight_query(const char *queryStringC) {
    static char *buf = NULL;
    @autoreleasepool {
        if (buf) {
            free(buf);
            buf = NULL;
        }
        if (!queryStringC) {
            return NULL;
        }
        NSString *queryString = [NSString stringWithUTF8String:queryStringC];
        if (!queryString.length) {
            return NULL;
        }

        NSMutableArray<NSString *> *found = [NSMutableArray array];
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);

        // initWithQueryString:attributes: is deprecated in favor of the
        // queryContext: variant (macOS 12+), but works back to our 11.0 minimum.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
        CSSearchQuery *query = [[CSSearchQuery alloc]
            initWithQueryString:queryString
                     attributes:@[@"title", @"displayName"]];
#pragma clang diagnostic pop
        query.foundItemsHandler = ^(NSArray<CSSearchableItem *> *items) {
            @synchronized (found) {
                for (CSSearchableItem *item in items) {
                    if (item.uniqueIdentifier) {
                        [found addObject:item.uniqueIdentifier];
                    }
                }
            }
        };
        query.completionHandler = ^(NSError *error) {
            ZSSetError(error);
            dispatch_semaphore_signal(sem);
        };
        @try {
            [query start];
            dispatch_semaphore_wait(sem,
                dispatch_time(DISPATCH_TIME_NOW, (int64_t)(8 * NSEC_PER_SEC)));
        }
        @catch (NSException *e) {
            // An invalid query string raises rather than calling the handler.
            NSLog(@"ZoteroSpotlight query error: %@", e);
        }

        NSArray *snapshot;
        @synchronized (found) {
            snapshot = [found copy];
        }
        NSData *json = [NSJSONSerialization dataWithJSONObject:snapshot options:0 error:NULL];
        if (json) {
            NSString *str = [[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding];
            if (str) {
                buf = strdup([str UTF8String]);
            }
        }
    }
    return buf;
}

EXPORT int zotero_spotlight_set_client_state(const char *stateC) {
    @autoreleasepool {
        NSData *state = stateC
            ? [NSData dataWithBytes:stateC length:strlen(stateC)]
            : [NSData data];
        CSSearchableIndex *index = ZSIndex();
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        [index beginIndexBatch];
        [index endIndexBatchWithClientState:state completionHandler:^(NSError *error) {
            ZSSetError(error);
            dispatch_semaphore_signal(sem);
        }];
        dispatch_semaphore_wait(sem,
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(8 * NSEC_PER_SEC)));
        return 0;
    }
}

EXPORT const char *zotero_spotlight_get_client_state(void) {
    static char *buf = NULL;
    @autoreleasepool {
        if (buf) {
            free(buf);
            buf = NULL;
        }
        __block NSData *state = nil;
        dispatch_semaphore_t sem = dispatch_semaphore_create(0);
        [ZSIndex()
            fetchLastClientStateWithCompletionHandler:^(NSData *clientState, NSError *error) {
                ZSSetError(error);
                state = clientState;
                dispatch_semaphore_signal(sem);
            }];
        dispatch_semaphore_wait(sem,
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(8 * NSEC_PER_SEC)));
        if (state.length) {
            NSString *str = [[NSString alloc] initWithData:state encoding:NSUTF8StringEncoding];
            if (str) {
                buf = strdup([str UTF8String]);
                return buf;
            }
        }
        return NULL;
    }
}
