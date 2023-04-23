// Windows/COM.cpp

#include "StdAfx.h"

#include "Windows/COM.h"
#include "Common/StringConvert.h"

namespace NWindows {
namespace NCOM {

// CoInitialize (NULL); must be called!

UString GUIDToStringW(REFGUID guid)
{
  UString string;
  const int kStringSize = 48;
  StringFromGUID2(guid, string.GetBuffer(kStringSize), kStringSize);
  string.ReleaseBuffer();
  return string;
}

AString GUIDToStringA(REFGUID guid)
{
  return UnicodeStringToMultiByte(GUIDToStringW(guid));
}

HRESULT StringToGUIDW(const wchar_t *string, GUID &classID)
{
  return CLSIDFromString((wchar_t *)string, &classID);
}

HRESULT StringToGUIDA(const char *string, GUID &classID)
{
  return StringToGUIDW(MultiByteToUnicodeString(string), classID);
}

}}