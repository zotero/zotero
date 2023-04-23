// Windows/FileDir.cpp

#include "StdAfx.h"

#include "FileDir.h"
#include "FileName.h"
#include "FileFind.h"
#include "Defs.h"
#ifndef _UNICODE
#include "../Common/StringConvert.h"
#endif

#ifndef _UNICODE
extern bool g_IsNT;
#endif

namespace NWindows {
namespace NFile {
namespace NDirectory {

#ifndef _UNICODE
static inline UINT GetCurrentCodePage() { return ::AreFileApisANSI() ? CP_ACP : CP_OEMCP; } 
static UString GetUnicodePath(const CSysString &sysPath)
  { return MultiByteToUnicodeString(sysPath, GetCurrentCodePage()); }
static CSysString GetSysPath(LPCWSTR sysPath)
  { return UnicodeStringToMultiByte(sysPath, GetCurrentCodePage()); }
#endif

bool MyGetWindowsDirectory(CSysString &path)
{
  UINT needLength = ::GetWindowsDirectory(path.GetBuffer(MAX_PATH + 1), MAX_PATH + 1);
  path.ReleaseBuffer();
  return (needLength > 0 && needLength <= MAX_PATH);
}

bool MyGetSystemDirectory(CSysString &path)
{
  UINT needLength = ::GetSystemDirectory(path.GetBuffer(MAX_PATH + 1), MAX_PATH + 1);
  path.ReleaseBuffer();
  return (needLength > 0 && needLength <= MAX_PATH);
}

#ifndef _UNICODE
bool MyGetWindowsDirectory(UString &path)
{
  if (g_IsNT)
  {
    UINT needLength = ::GetWindowsDirectoryW(path.GetBuffer(MAX_PATH + 1), MAX_PATH + 1);
    path.ReleaseBuffer();
    return (needLength > 0 && needLength <= MAX_PATH);
  }
  CSysString sysPath;
  if (!MyGetWindowsDirectory(sysPath))
    return false;
  path = GetUnicodePath(sysPath);
  return true;
}

bool MyGetSystemDirectory(UString &path)
{
  if (g_IsNT)
  {
    UINT needLength = ::GetSystemDirectoryW(path.GetBuffer(MAX_PATH + 1), MAX_PATH + 1);
    path.ReleaseBuffer();
    return (needLength > 0 && needLength <= MAX_PATH);
  }
  CSysString sysPath;
  if (!MyGetSystemDirectory(sysPath))
    return false;
  path = GetUnicodePath(sysPath);
  return true;
}
#endif

#ifndef _UNICODE
bool MySetFileAttributes(LPCWSTR fileName, DWORD fileAttributes)
{  
  if (g_IsNT)
    return BOOLToBool(::SetFileAttributesW(fileName, fileAttributes));
  return MySetFileAttributes(GetSysPath(fileName), fileAttributes);
}

bool MyRemoveDirectory(LPCWSTR pathName)
{  
  if (g_IsNT)
    return BOOLToBool(::RemoveDirectoryW(pathName));
  return MyRemoveDirectory(GetSysPath(pathName));
}

bool MyMoveFile(LPCWSTR existFileName, LPCWSTR newFileName)
{  
  if (g_IsNT)
    return BOOLToBool(::MoveFileW(existFileName, newFileName));
  return MyMoveFile(GetSysPath(existFileName), GetSysPath(newFileName));
}
#endif

bool MyCreateDirectory(LPCTSTR pathName) { return BOOLToBool(::CreateDirectory(pathName, NULL)); }

#ifndef _UNICODE
bool MyCreateDirectory(LPCWSTR pathName)
{  
  if (g_IsNT)
    return BOOLToBool(::CreateDirectoryW(pathName, NULL));
  return MyCreateDirectory(GetSysPath(pathName));
}
#endif

/*
bool CreateComplexDirectory(LPCTSTR pathName)
{
  NName::CParsedPath path;
  path.ParsePath(pathName);
  CSysString fullPath = path.Prefix;
  DWORD errorCode = ERROR_SUCCESS;
  for(int i = 0; i < path.PathParts.Size(); i++)
  {
    const CSysString &string = path.PathParts[i];
    if(string.IsEmpty())
    {
      if(i != path.PathParts.Size() - 1)
        return false;
      return true;
    }
    fullPath += path.PathParts[i];
    if(!MyCreateDirectory(fullPath))
    {
      DWORD errorCode = GetLastError();
      if(errorCode != ERROR_ALREADY_EXISTS)
        return false;
    }
    fullPath += NName::kDirDelimiter;
  }
  return true;
}
*/

bool CreateComplexDirectory(LPCTSTR _aPathName)
{
  CSysString pathName = _aPathName;
  int pos = pathName.ReverseFind(TEXT(CHAR_PATH_SEPARATOR));
  if (pos > 0 && pos == pathName.Length() - 1)
  {
    if (pathName.Length() == 3 && pathName[1] == ':')
      return true; // Disk folder;
    pathName.Delete(pos);
  }
  CSysString pathName2 = pathName;
  pos = pathName.Length();
  while(true)
  {
    if(MyCreateDirectory(pathName))
      break;
    if(::GetLastError() == ERROR_ALREADY_EXISTS)
    {
      NFind::CFileInfo fileInfo;
      if (!NFind::FindFile(pathName, fileInfo)) // For network folders
        return true;
      if (!fileInfo.IsDirectory())
        return false;
      break;
    }
    pos = pathName.ReverseFind(TEXT(CHAR_PATH_SEPARATOR));
    if (pos < 0 || pos == 0)
      return false;
    if (pathName[pos - 1] == ':')
      return false;
    pathName = pathName.Left(pos);
  }
  pathName = pathName2;
  while(pos < pathName.Length())
  {
    pos = pathName.Find(TEXT(CHAR_PATH_SEPARATOR), pos + 1);
    if (pos < 0)
      pos = pathName.Length();
    if(!MyCreateDirectory(pathName.Left(pos)))
      return false;
  }
  return true;
}

#ifndef _UNICODE

bool CreateComplexDirectory(LPCWSTR _aPathName)
{
  UString pathName = _aPathName;
  int pos = pathName.ReverseFind(WCHAR_PATH_SEPARATOR);
  if (pos > 0 && pos == pathName.Length() - 1)
  {
    if (pathName.Length() == 3 && pathName[1] == L':')
      return true; // Disk folder;
    pathName.Delete(pos);
  }
  UString pathName2 = pathName;
  pos = pathName.Length();
  while(true)
  {
    if(MyCreateDirectory(pathName))
      break;
    if(::GetLastError() == ERROR_ALREADY_EXISTS)
    {
      NFind::CFileInfoW fileInfo;
      if (!NFind::FindFile(pathName, fileInfo)) // For network folders
        return true;
      if (!fileInfo.IsDirectory())
        return false;
      break;
    }
    pos = pathName.ReverseFind(WCHAR_PATH_SEPARATOR);
    if (pos < 0 || pos == 0)
      return false;
    if (pathName[pos - 1] == L':')
      return false;
    pathName = pathName.Left(pos);
  }
  pathName = pathName2;
  while(pos < pathName.Length())
  {
    pos = pathName.Find(WCHAR_PATH_SEPARATOR, pos + 1);
    if (pos < 0)
      pos = pathName.Length();
    if(!MyCreateDirectory(pathName.Left(pos)))
      return false;
  }
  return true;
}

#endif

bool DeleteFileAlways(LPCTSTR name)
{
  if(!::SetFileAttributes(name, 0))
    return false;
  return BOOLToBool(::DeleteFile(name));
}

#ifndef _UNICODE
bool DeleteFileAlways(LPCWSTR name)
{  
  if (g_IsNT)
  {
    if(!MySetFileAttributes(name, 0))
      return false;
    return BOOLToBool(::DeleteFileW(name));
  }
  return DeleteFileAlways(GetSysPath(name));
}
#endif

static bool RemoveDirectorySubItems2(const CSysString pathPrefix, const NFind::CFileInfo &fileInfo)
{
  if(fileInfo.IsDirectory())
    return RemoveDirectoryWithSubItems(pathPrefix + fileInfo.Name);
  else
    return DeleteFileAlways(pathPrefix + fileInfo.Name);
}

bool RemoveDirectoryWithSubItems(const CSysString &path)
{
  NFind::CFileInfo fileInfo;
  CSysString pathPrefix = path + NName::kDirDelimiter;
  {
    NFind::CEnumerator enumerator(pathPrefix + TCHAR(NName::kAnyStringWildcard));
    while(enumerator.Next(fileInfo))
      if(!RemoveDirectorySubItems2(pathPrefix, fileInfo))
        return false;
  }
  if(!BOOLToBool(::SetFileAttributes(path, 0)))
    return false;
  return BOOLToBool(::RemoveDirectory(path));
}

#ifndef _UNICODE
static bool RemoveDirectorySubItems2(const UString pathPrefix, const NFind::CFileInfoW &fileInfo)
{
  if(fileInfo.IsDirectory())
    return RemoveDirectoryWithSubItems(pathPrefix + fileInfo.Name);
  else
    return DeleteFileAlways(pathPrefix + fileInfo.Name);
}
bool RemoveDirectoryWithSubItems(const UString &path)
{
  NFind::CFileInfoW fileInfo;
  UString pathPrefix = path + UString(NName::kDirDelimiter);
  {
    NFind::CEnumeratorW enumerator(pathPrefix + UString(NName::kAnyStringWildcard));
    while(enumerator.Next(fileInfo))
      if(!RemoveDirectorySubItems2(pathPrefix, fileInfo))
        return false;
  }
  if(!MySetFileAttributes(path, 0))
    return false;
  return MyRemoveDirectory(path);
}
#endif

#ifndef _WIN32_WCE

bool MyGetShortPathName(LPCTSTR longPath, CSysString &shortPath)
{
  DWORD needLength = ::GetShortPathName(longPath, shortPath.GetBuffer(MAX_PATH + 1), MAX_PATH + 1);
  shortPath.ReleaseBuffer();
  return (needLength > 0 && needLength < MAX_PATH);
}

bool MyGetFullPathName(LPCTSTR fileName, CSysString &resultPath, int &fileNamePartStartIndex)
{
  resultPath.Empty();
  LPTSTR fileNamePointer = 0;
  LPTSTR buffer = resultPath.GetBuffer(MAX_PATH);
  DWORD needLength = ::GetFullPathName(fileName, MAX_PATH + 1, buffer, &fileNamePointer);
  resultPath.ReleaseBuffer();
  if (needLength == 0 || needLength >= MAX_PATH)
    return false;
  if (fileNamePointer == 0)
    fileNamePartStartIndex = lstrlen(fileName);
  else
    fileNamePartStartIndex = (int)(fileNamePointer - buffer);
  return true;
}

#ifndef _UNICODE
bool MyGetFullPathName(LPCWSTR fileName, UString &resultPath, int &fileNamePartStartIndex)
{
  resultPath.Empty();
  if (g_IsNT)
  {
    LPWSTR fileNamePointer = 0;
    LPWSTR buffer = resultPath.GetBuffer(MAX_PATH);
    DWORD needLength = ::GetFullPathNameW(fileName, MAX_PATH + 1, buffer, &fileNamePointer);
    resultPath.ReleaseBuffer();
    if (needLength == 0 || needLength >= MAX_PATH)
      return false;
    if (fileNamePointer == 0)
      fileNamePartStartIndex = MyStringLen(fileName);
    else
      fileNamePartStartIndex = (int)(fileNamePointer - buffer);
  }
  else
  {
    CSysString sysPath;
    if (!MyGetFullPathName(GetSysPath(fileName), sysPath, fileNamePartStartIndex))
      return false;
    UString resultPath1 = GetUnicodePath(sysPath.Left(fileNamePartStartIndex));
    UString resultPath2 = GetUnicodePath(sysPath.Mid(fileNamePartStartIndex));
    fileNamePartStartIndex = resultPath1.Length();
    resultPath = resultPath1 + resultPath2;
  }
  return true;
}
#endif


bool MyGetFullPathName(LPCTSTR fileName, CSysString &path)
{
  int index;
  return MyGetFullPathName(fileName, path, index);
}

#ifndef _UNICODE
bool MyGetFullPathName(LPCWSTR fileName, UString &path)
{
  int index;
  return MyGetFullPathName(fileName, path, index);
}
#endif

bool GetOnlyName(LPCTSTR fileName, CSysString &resultName)
{
  int index;
  if (!MyGetFullPathName(fileName, resultName, index))
    return false;
  resultName = resultName.Mid(index);
  return true;
}

#ifndef _UNICODE
bool GetOnlyName(LPCWSTR fileName, UString &resultName)
{
  int index;
  if (!MyGetFullPathName(fileName, resultName, index))
    return false;
  resultName = resultName.Mid(index);
  return true;
}
#endif

bool GetOnlyDirPrefix(LPCTSTR fileName, CSysString &resultName)
{
  int index;
  if (!MyGetFullPathName(fileName, resultName, index))
    return false;
  resultName = resultName.Left(index);
  return true;
}

#ifndef _UNICODE
bool GetOnlyDirPrefix(LPCWSTR fileName, UString &resultName)
{
  int index;
  if (!MyGetFullPathName(fileName, resultName, index))
    return false;
  resultName = resultName.Left(index);
  return true;
}
#endif

bool MyGetCurrentDirectory(CSysString &path)
{
  DWORD needLength = ::GetCurrentDirectory(MAX_PATH + 1, path.GetBuffer(MAX_PATH + 1));
  path.ReleaseBuffer();
  return (needLength > 0 && needLength <= MAX_PATH);
}

#ifndef _UNICODE
bool MySetCurrentDirectory(LPCWSTR path)
{
  if (g_IsNT)
    return BOOLToBool(::SetCurrentDirectoryW(path));
  return MySetCurrentDirectory(GetSysPath(path));
}
bool MyGetCurrentDirectory(UString &path)
{
  if (g_IsNT)
  {
    DWORD needLength = ::GetCurrentDirectoryW(MAX_PATH + 1, path.GetBuffer(MAX_PATH + 1));
    path.ReleaseBuffer();
    return (needLength > 0 && needLength <= MAX_PATH);
  }
  CSysString sysPath;
  if (!MyGetCurrentDirectory(sysPath))
    return false;
  path = GetUnicodePath(sysPath);
  return true;
}
#endif
#endif

bool MySearchPath(LPCTSTR path, LPCTSTR fileName, LPCTSTR extension, 
  CSysString &resultPath, UINT32 &filePart)
{
  LPTSTR filePartPointer;
  DWORD value = ::SearchPath(path, fileName, extension, 
    MAX_PATH, resultPath.GetBuffer(MAX_PATH + 1), &filePartPointer);
  filePart = (UINT32)(filePartPointer - (LPCTSTR)resultPath);
  resultPath.ReleaseBuffer();
  return (value > 0 && value <= MAX_PATH);
}

#ifndef _UNICODE
bool MySearchPath(LPCWSTR path, LPCWSTR fileName, LPCWSTR extension, 
  UString &resultPath, UINT32 &filePart)
{
  if (g_IsNT)
  {
    LPWSTR filePartPointer = 0;
    DWORD value = ::SearchPathW(path, fileName, extension, 
        MAX_PATH, resultPath.GetBuffer(MAX_PATH + 1), &filePartPointer);
    filePart = (UINT32)(filePartPointer - (LPCWSTR)resultPath);
    resultPath.ReleaseBuffer();
    return (value > 0 && value <= MAX_PATH);
  }
  
  CSysString sysPath;
  if (!MySearchPath(
      path != 0 ? (LPCTSTR)GetSysPath(path): 0,
      fileName != 0 ? (LPCTSTR)GetSysPath(fileName): 0,
      extension != 0 ? (LPCTSTR)GetSysPath(extension): 0,
      sysPath, filePart))
    return false;
  UString resultPath1 = GetUnicodePath(sysPath.Left(filePart));
  UString resultPath2 = GetUnicodePath(sysPath.Mid(filePart));
  filePart = resultPath1.Length();
  resultPath = resultPath1 + resultPath2;
  return true;
}
#endif

bool MyGetTempPath(CSysString &path)
{
  DWORD needLength = ::GetTempPath(MAX_PATH + 1, path.GetBuffer(MAX_PATH + 1));
  path.ReleaseBuffer();
  return (needLength > 0 && needLength <= MAX_PATH);
}

#ifndef _UNICODE
bool MyGetTempPath(UString &path)
{
  path.Empty();
  if (g_IsNT)
  {
    DWORD needLength = ::GetTempPathW(MAX_PATH + 1, path.GetBuffer(MAX_PATH + 1));
    path.ReleaseBuffer();
    return (needLength > 0 && needLength <= MAX_PATH);
  }
  CSysString sysPath;
  if (!MyGetTempPath(sysPath))
    return false;
  path = GetUnicodePath(sysPath);
  return true;
}
#endif

UINT MyGetTempFileName(LPCTSTR dirPath, LPCTSTR prefix, CSysString &path)
{
  UINT number = ::GetTempFileName(dirPath, prefix, 0, path.GetBuffer(MAX_PATH + 1));
  path.ReleaseBuffer();
  return number;
}

#ifndef _UNICODE
UINT MyGetTempFileName(LPCWSTR dirPath, LPCWSTR prefix, UString &path)
{
  if (g_IsNT)
  {
    UINT number = ::GetTempFileNameW(dirPath, prefix, 0, path.GetBuffer(MAX_PATH));
    path.ReleaseBuffer();
    return number;
  }
  CSysString sysPath;
  UINT number = MyGetTempFileName(
      dirPath ? (LPCTSTR)GetSysPath(dirPath): 0, 
      prefix ? (LPCTSTR)GetSysPath(prefix): 0, 
      sysPath);
  path = GetUnicodePath(sysPath);
  return number;
}
#endif

UINT CTempFile::Create(LPCTSTR dirPath, LPCTSTR prefix, CSysString &resultPath)
{
  Remove();
  UINT number = MyGetTempFileName(dirPath, prefix, resultPath);
  if(number != 0)
  {
    _fileName = resultPath;
    _mustBeDeleted = true;
  }
  return number;
}

bool CTempFile::Create(LPCTSTR prefix, CSysString &resultPath)
{
  CSysString tempPath;
  if(!MyGetTempPath(tempPath))
    return false;
  if (Create(tempPath, prefix, resultPath) != 0)
    return true;
  if(!MyGetWindowsDirectory(tempPath))
    return false;
  return (Create(tempPath, prefix, resultPath) != 0);
}

bool CTempFile::Remove()
{
  if (!_mustBeDeleted)
    return true;
  _mustBeDeleted = !DeleteFileAlways(_fileName);
  return !_mustBeDeleted;
}

#ifndef _UNICODE

UINT CTempFileW::Create(LPCWSTR dirPath, LPCWSTR prefix, UString &resultPath)
{
  Remove();
  UINT number = MyGetTempFileName(dirPath, prefix, resultPath);
  if(number != 0)
  {
    _fileName = resultPath;
    _mustBeDeleted = true;
  }
  return number;
}

bool CTempFileW::Create(LPCWSTR prefix, UString &resultPath)
{
  UString tempPath;
  if(!MyGetTempPath(tempPath))
    return false;
  if (Create(tempPath, prefix, resultPath) != 0)
    return true;
  if(!MyGetWindowsDirectory(tempPath))
    return false;
  return (Create(tempPath, prefix, resultPath) != 0);
}

bool CTempFileW::Remove()
{
  if (!_mustBeDeleted)
    return true;
  _mustBeDeleted = !DeleteFileAlways(_fileName);
  return !_mustBeDeleted;
}

#endif

bool CreateTempDirectory(LPCTSTR prefix, CSysString &dirName)
{
  /*
  CSysString prefix = tempPath + prefixChars;
  CRandom random;
  random.Init();
  */
  while(true)
  {
    CTempFile tempFile;
    if (!tempFile.Create(prefix, dirName))
      return false;
    if (!::DeleteFile(dirName))
      return false;
    /*
    UINT32 randomNumber = random.Generate();
    TCHAR randomNumberString[32];
    _stprintf(randomNumberString, _T("%04X"), randomNumber);
    dirName = prefix + randomNumberString;
    */
    if(NFind::DoesFileExist(dirName))
      continue;
    if (MyCreateDirectory(dirName))
      return true;
    if (::GetLastError() != ERROR_ALREADY_EXISTS)
      return false;
  }
}

bool CTempDirectory::Create(LPCTSTR prefix)
{ 
  Remove();
  return (_mustBeDeleted = CreateTempDirectory(prefix, _tempDir)); 
}

#ifndef _UNICODE

bool CreateTempDirectory(LPCWSTR prefix, UString &dirName)
{
  /*
  CSysString prefix = tempPath + prefixChars;
  CRandom random;
  random.Init();
  */
  while(true)
  {
    CTempFileW tempFile;
    if (!tempFile.Create(prefix, dirName))
      return false;
    if (!DeleteFileAlways(dirName))
      return false;
    /*
    UINT32 randomNumber = random.Generate();
    TCHAR randomNumberString[32];
    _stprintf(randomNumberString, _T("%04X"), randomNumber);
    dirName = prefix + randomNumberString;
    */
    if(NFind::DoesFileExist(dirName))
      continue;
    if (MyCreateDirectory(dirName))
      return true;
    if (::GetLastError() != ERROR_ALREADY_EXISTS)
      return false;
  }
}

bool CTempDirectoryW::Create(LPCWSTR prefix)
{ 
  Remove();
  return (_mustBeDeleted = CreateTempDirectory(prefix, _tempDir)); 
}

#endif

}}}
