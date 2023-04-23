// Windows/Error.h

#ifndef __WINDOWS_ERROR_H
#define __WINDOWS_ERROR_H

#include "Common/String.h"

namespace NWindows {
namespace NError {

bool MyFormatMessage(DWORD messageID, CSysString &message);
inline CSysString MyFormatMessage(DWORD messageID)
{
  CSysString message;
  MyFormatMessage(messageID, message);
  return message;
}
#ifdef _UNICODE
inline UString MyFormatMessageW(DWORD messageID)
  { return MyFormatMessage(messageID); }
#else
bool MyFormatMessage(DWORD messageID, UString &message);
inline UString MyFormatMessageW(DWORD messageID)
{
  UString message;
  MyFormatMessage(messageID, message);
  return message;
}
#endif

}}

#endif
