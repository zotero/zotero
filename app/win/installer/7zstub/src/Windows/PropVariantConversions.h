// Windows/PropVariantConversions.h

#ifndef __PROPVARIANTCONVERSIONS_H
#define __PROPVARIANTCONVERSIONS_H

#include "Common/Types.h"
#include "Common/String.h"

bool ConvertFileTimeToString(const FILETIME &ft, char *s, bool includeTime = true, bool includeSeconds = true);
UString ConvertFileTimeToString(const FILETIME &ft, bool includeTime = true, bool includeSeconds = true);
UString ConvertPropVariantToString(const PROPVARIANT &propVariant);
UInt64 ConvertPropVariantToUInt64(const PROPVARIANT &propVariant);

#endif
