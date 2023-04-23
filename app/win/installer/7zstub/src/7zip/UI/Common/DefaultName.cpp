// DefaultName.cpp

#include "StdAfx.h"

#include "DefaultName.h"

static const wchar_t *kEmptyFileAlias = L"[Content]";

UString GetDefaultName2(const UString &fileName, 
    const UString &extension, const UString &addSubExtension)
{
  int extLength = extension.Length();
  int fileNameLength = fileName.Length();
  if (fileNameLength > extLength + 1)
  {
    int dotPos = fileNameLength - (extLength + 1);
    if (fileName[dotPos] == '.')
      if (extension.CompareNoCase(fileName.Mid(dotPos + 1)) == 0)
        return fileName.Left(dotPos) + addSubExtension;
  }
  return kEmptyFileAlias;
}

