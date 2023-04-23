// Archive/Common/ItemNameUtils.cpp

#include "StdAfx.h"

#include "ItemNameUtils.h"

namespace NArchive {
namespace NItemName {

static const wchar_t kOSDirDelimiter = WCHAR_PATH_SEPARATOR;
static const wchar_t kDirDelimiter = L'/';

UString MakeLegalName(const UString &name)
{
  UString zipName = name;
  zipName.Replace(kOSDirDelimiter, kDirDelimiter);
  return zipName;
}

UString GetOSName(const UString &name)
{
  UString newName = name;
  newName.Replace(kDirDelimiter, kOSDirDelimiter);
  return newName;
}

UString GetOSName2(const UString &name)
{
  if (name.IsEmpty())
    return UString();
  UString newName = GetOSName(name);
  if (newName[newName.Length() - 1] == kOSDirDelimiter)
    newName.Delete(newName.Length() - 1);
  return newName;
}

bool HasTailSlash(const AString &name, UINT codePage)
{
  if (name.IsEmpty())
    return false;
  LPCSTR prev = 
  #ifdef _WIN32
    CharPrevExA(codePage, name, &name[name.Length()], 0);
  #else
    (LPCSTR)(name) + (name.Length() - 1);
  #endif
  return (*prev == '/');
}

#ifndef _WIN32
UString WinNameToOSName(const UString &name)
{
  UString newName = name;
  newName.Replace(L'\\', kOSDirDelimiter);
  return newName;
}
#endif

}}
