// FilePathAutoRename.cpp

#include "StdAfx.h"
#include "FilePathAutoRename.h"

#include "Common/Defs.h"
#include "Common/IntToString.h"

#include "Windows/FileName.h"
#include "Windows/FileFind.h"

using namespace NWindows;

static bool MakeAutoName(const UString &name, 
    const UString &extension, int value, UString &path)
{
  wchar_t number[32];
  ConvertUInt64ToString(value, number);
  path = name;
  path += number;
  path += extension;
  return NFile::NFind::DoesFileExist(path);
}

bool AutoRenamePath(UString &fullProcessedPath)
{
  UString path;
  int dotPos = fullProcessedPath.ReverseFind(L'.');

  int slashPos = fullProcessedPath.ReverseFind(L'/');
  #ifdef _WIN32
  int slash1Pos = fullProcessedPath.ReverseFind(L'\\');
  slashPos = MyMax(slashPos, slash1Pos);
  #endif

  UString name, extension;
  if (dotPos > slashPos &&  dotPos > 0)
  {
    name = fullProcessedPath.Left(dotPos);
    extension = fullProcessedPath.Mid(dotPos);
  }
  else
    name = fullProcessedPath;
  name += L'_';
  int indexLeft = 1, indexRight = (1 << 30);
  while (indexLeft != indexRight)
  {
    int indexMid = (indexLeft + indexRight) / 2;
    if (MakeAutoName(name, extension, indexMid, path))
      indexLeft = indexMid + 1;
    else
      indexRight = indexMid;
  }
  if (MakeAutoName(name, extension, indexRight, fullProcessedPath))
    return false;
  return true;
}
