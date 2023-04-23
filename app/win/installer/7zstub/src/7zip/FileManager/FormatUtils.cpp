// FormatUtils.cpp

#include "StdAfx.h"

#include "FormatUtils.h"
#include "Common/IntToString.h"
#include "Windows/ResourceString.h"

#ifdef LANG
#include "LangUtils.h"
#endif

UString NumberToString(UInt64 number)
{
  wchar_t numberString[32];
  ConvertUInt64ToString(number, numberString);
  return numberString;
}

UString MyFormatNew(const UString &format, const UString &argument)
{
  UString result = format;
  result.Replace(L"{0}", argument);
  return result;
}

UString MyFormatNew(UINT resourceID, 
    #ifdef LANG
    UInt32 langID, 
    #endif
    const UString &argument)
{
  return MyFormatNew(
    #ifdef LANG
    LangString(resourceID, langID), 
    #else
    NWindows::MyLoadStringW(resourceID), 
    #endif
    argument);
}
