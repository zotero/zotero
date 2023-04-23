// Windows/ResourceString.h

#ifndef __WINDOWS_RESOURCESTRING_H
#define __WINDOWS_RESOURCESTRING_H

#include "Common/String.h"

namespace NWindows {

CSysString MyLoadString(UINT resourceID);
#ifdef _UNICODE
inline UString MyLoadStringW(UINT resourceID)
  { return MyLoadString(resourceID); }
#else
UString MyLoadStringW(UINT resourceID);
#endif

}

#endif
