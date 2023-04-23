// Windows/FileName.cpp

#include "StdAfx.h"

#include "Windows/FileName.h"
#include "Common/Wildcard.h"

namespace NWindows {
namespace NFile {
namespace NName {

static const wchar_t kDiskDelimiter = L':';

/*
static bool IsCharAPrefixDelimiter(wchar_t c)
  { return (c == kDirDelimiter || c == kDiskDelimiter); }
*/

void NormalizeDirPathPrefix(CSysString &dirPath)
{
  if (dirPath.IsEmpty())
    return;
  if (dirPath.ReverseFind(kDirDelimiter) != dirPath.Length() - 1)
    dirPath += kDirDelimiter;
}

#ifndef _UNICODE
void NormalizeDirPathPrefix(UString &dirPath)
{
  if (dirPath.IsEmpty())
    return;
  if (dirPath.ReverseFind(wchar_t(kDirDelimiter)) != dirPath.Length() - 1)
    dirPath += wchar_t(kDirDelimiter);
}
#endif

namespace NPathType
{
  EEnum GetPathType(const UString &path)
  {
    if (path.Length() <= 2)
      return kLocal;
    if (path[0] == kDirDelimiter && path[1] == kDirDelimiter)
      return kUNC;
    return kLocal;
  }
}

void CParsedPath::ParsePath(const UString &path)
{
  int curPos = 0;
  switch (NPathType::GetPathType(path))
  {
    case NPathType::kLocal:
    {
      int posDiskDelimiter = path.Find(kDiskDelimiter);
      if(posDiskDelimiter >= 0)
      {
        curPos = posDiskDelimiter + 1;
        if (path.Length() > curPos)
          if(path[curPos] == kDirDelimiter)
            curPos++;
      }
      break;
    }
    case NPathType::kUNC:
    {
      int curPos = path.Find(kDirDelimiter, 2);
      if(curPos < 0)
        curPos = path.Length();
      else
        curPos++;
    }
  }
  Prefix = path.Left(curPos);
  SplitPathToParts(path.Mid(curPos), PathParts);
}

UString CParsedPath::MergePath() const
{
  UString result = Prefix;
  for(int i = 0; i < PathParts.Size(); i++)
  {
    if (i != 0)
      result += kDirDelimiter;
    result += PathParts[i];
  }
  return result;
}

const wchar_t kExtensionDelimiter = L'.';

void SplitNameToPureNameAndExtension(const UString &fullName, 
    UString &pureName, UString &extensionDelimiter, UString &extension)
{
  int index = fullName.ReverseFind(kExtensionDelimiter);
  if (index < 0)
  {
    pureName = fullName;
    extensionDelimiter.Empty();
    extension.Empty();
  }
  else
  {
    pureName = fullName.Left(index);
    extensionDelimiter = kExtensionDelimiter;
    extension = fullName.Mid(index + 1);
  }
}

}}}
