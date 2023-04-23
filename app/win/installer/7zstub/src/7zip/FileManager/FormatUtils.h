// FormatUtils.h

#ifndef __FORMATUTILS_H
#define __FORMATUTILS_H

#include "Common/Types.h"
#include "Common/String.h"

UString NumberToString(UInt64 number);

UString MyFormatNew(const UString &format, const UString &argument);
UString MyFormatNew(UINT resourceID, 
    #ifdef LANG
    UInt32 langID, 
    #endif
    const UString &argument);

#endif
