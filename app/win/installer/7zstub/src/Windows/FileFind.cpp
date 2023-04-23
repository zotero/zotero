// Windows/FileFind.cpp

#include "StdAfx.h"

#include "FileFind.h"
#ifndef _UNICODE
#include "../Common/StringConvert.h"
#endif

#ifndef _UNICODE
extern bool g_IsNT;
#endif

namespace NWindows {
namespace NFile {
namespace NFind {

static const TCHAR kDot = TEXT('.');

bool CFileInfo::IsDots() const
{ 
  if (!IsDirectory() || Name.IsEmpty())
    return false;
  if (Name[0] != kDot)
    return false;
  return Name.Length() == 1 || (Name[1] == kDot && Name.Length() == 2);
}

#ifndef _UNICODE
bool CFileInfoW::IsDots() const
{ 
  if (!IsDirectory() || Name.IsEmpty())
    return false;
  if (Name[0] != kDot)
    return false;
  return Name.Length() == 1 || (Name[1] == kDot && Name.Length() == 2);
}
#endif

static void ConvertWIN32_FIND_DATA_To_FileInfo(
    const WIN32_FIND_DATA &findData,
    CFileInfo &fileInfo)
{
  fileInfo.Attributes = findData.dwFileAttributes; 
  fileInfo.CreationTime = findData.ftCreationTime;  
  fileInfo.LastAccessTime = findData.ftLastAccessTime; 
  fileInfo.LastWriteTime = findData.ftLastWriteTime;
  fileInfo.Size  = (((UInt64)findData.nFileSizeHigh) << 32) + findData.nFileSizeLow; 
  fileInfo.Name = findData.cFileName;
  #ifndef _WIN32_WCE
  fileInfo.ReparseTag = findData.dwReserved0;
  #else
  fileInfo.ObjectID = findData.dwOID;
  #endif
}

#ifndef _UNICODE

static inline UINT GetCurrentCodePage() { return ::AreFileApisANSI() ? CP_ACP : CP_OEMCP; } 

static void ConvertWIN32_FIND_DATA_To_FileInfo(
    const WIN32_FIND_DATAW &findData,
    CFileInfoW &fileInfo)
{
  fileInfo.Attributes = findData.dwFileAttributes; 
  fileInfo.CreationTime = findData.ftCreationTime;  
  fileInfo.LastAccessTime = findData.ftLastAccessTime; 
  fileInfo.LastWriteTime = findData.ftLastWriteTime;
  fileInfo.Size  = (((UInt64)findData.nFileSizeHigh) << 32) + findData.nFileSizeLow; 
  fileInfo.Name = findData.cFileName;
  #ifndef _WIN32_WCE
  fileInfo.ReparseTag = findData.dwReserved0;
  #else
  fileInfo.ObjectID = findData.dwOID;
  #endif
}

static void ConvertWIN32_FIND_DATA_To_FileInfo(
    const WIN32_FIND_DATA &findData,
    CFileInfoW &fileInfo)
{
  fileInfo.Attributes = findData.dwFileAttributes; 
  fileInfo.CreationTime = findData.ftCreationTime;  
  fileInfo.LastAccessTime = findData.ftLastAccessTime; 
  fileInfo.LastWriteTime = findData.ftLastWriteTime;
  fileInfo.Size  = (((UInt64)findData.nFileSizeHigh) << 32) + findData.nFileSizeLow; 
  fileInfo.Name = GetUnicodeString(findData.cFileName, GetCurrentCodePage());
  #ifndef _WIN32_WCE
  fileInfo.ReparseTag = findData.dwReserved0;
  #else
  fileInfo.ObjectID = findData.dwOID;
  #endif
}
#endif
  
////////////////////////////////
// CFindFile

bool CFindFile::Close()
{
  if(!_handleAllocated)
    return true;
  bool result = BOOLToBool(::FindClose(_handle));
  _handleAllocated = !result;
  return result;
}
           
bool CFindFile::FindFirst(LPCTSTR wildcard, CFileInfo &fileInfo)
{
  Close();
  WIN32_FIND_DATA findData;
  _handle = ::FindFirstFile(wildcard, &findData);
  if (_handleAllocated = (_handle != INVALID_HANDLE_VALUE))
    ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  return _handleAllocated;
}

#ifndef _UNICODE
bool CFindFile::FindFirst(LPCWSTR wildcard, CFileInfoW &fileInfo)
{
  Close();
  if (g_IsNT)
  {
    WIN32_FIND_DATAW findData;
    _handle = ::FindFirstFileW(wildcard, &findData);
    if (_handleAllocated = (_handle != INVALID_HANDLE_VALUE))
      ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  }
  else
  {
    WIN32_FIND_DATAA findData;
    _handle = ::FindFirstFileA(UnicodeStringToMultiByte(wildcard, 
        GetCurrentCodePage()), &findData);
    if (_handleAllocated = (_handle != INVALID_HANDLE_VALUE))
      ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  }
  return _handleAllocated;
}
#endif

bool CFindFile::FindNext(CFileInfo &fileInfo)
{
  WIN32_FIND_DATA findData;
  bool result = BOOLToBool(::FindNextFile(_handle, &findData));
  if (result)
    ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  return result;
}

#ifndef _UNICODE
bool CFindFile::FindNext(CFileInfoW &fileInfo)
{
  if (g_IsNT)
  {
    WIN32_FIND_DATAW findData;
    if (!::FindNextFileW(_handle, &findData))
      return false;
    ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  }
  else
  {
    WIN32_FIND_DATAA findData;
    if (!::FindNextFileA(_handle, &findData))
      return false;
    ConvertWIN32_FIND_DATA_To_FileInfo(findData, fileInfo);
  }
  return true;
}
#endif

bool FindFile(LPCTSTR wildcard, CFileInfo &fileInfo)
{
  CFindFile finder;
  return finder.FindFirst(wildcard, fileInfo);
}

#ifndef _UNICODE
bool FindFile(LPCWSTR wildcard, CFileInfoW &fileInfo)
{
  CFindFile finder;
  return finder.FindFirst(wildcard, fileInfo);
}
#endif

bool DoesFileExist(LPCTSTR name)
{
  CFileInfo fileInfo;
  return FindFile(name, fileInfo);
}

#ifndef _UNICODE
bool DoesFileExist(LPCWSTR name)
{
  CFileInfoW fileInfo;
  return FindFile(name, fileInfo);
}
#endif

/////////////////////////////////////
// CEnumerator

bool CEnumerator::NextAny(CFileInfo &fileInfo)
{
  if(_findFile.IsHandleAllocated())
    return _findFile.FindNext(fileInfo);
  else
    return _findFile.FindFirst(_wildcard, fileInfo);
}

bool CEnumerator::Next(CFileInfo &fileInfo)
{
  while(true)
  {
    if(!NextAny(fileInfo))
      return false;
    if(!fileInfo.IsDots())
      return true;
  }
}

bool CEnumerator::Next(CFileInfo &fileInfo, bool &found)
{
  if (Next(fileInfo))
  {
    found = true;
    return true;
  }
  found = false;
  return (::GetLastError() == ERROR_NO_MORE_FILES);
}

#ifndef _UNICODE
bool CEnumeratorW::NextAny(CFileInfoW &fileInfo)
{
  if(_findFile.IsHandleAllocated())
    return _findFile.FindNext(fileInfo);
  else
    return _findFile.FindFirst(_wildcard, fileInfo);
}

bool CEnumeratorW::Next(CFileInfoW &fileInfo)
{
  while(true)
  {
    if(!NextAny(fileInfo))
      return false;
    if(!fileInfo.IsDots())
      return true;
  }
}

bool CEnumeratorW::Next(CFileInfoW &fileInfo, bool &found)
{
  if (Next(fileInfo))
  {
    found = true;
    return true;
  }
  found = false;
  return (::GetLastError() == ERROR_NO_MORE_FILES);
}

#endif

////////////////////////////////
// CFindChangeNotification

bool CFindChangeNotification::Close()
{
  if(_handle == INVALID_HANDLE_VALUE || _handle == 0)
    return true;
  bool result = BOOLToBool(::FindCloseChangeNotification(_handle));
  if (result)
    _handle = INVALID_HANDLE_VALUE;
  return result;
}
           
HANDLE CFindChangeNotification::FindFirst(LPCTSTR pathName, bool watchSubtree, 
    DWORD notifyFilter)
{
  _handle = ::FindFirstChangeNotification(pathName, 
      BoolToBOOL(watchSubtree), notifyFilter);
  return _handle;
}

#ifndef _UNICODE
HANDLE CFindChangeNotification::FindFirst(LPCWSTR pathName, bool watchSubtree, 
    DWORD notifyFilter)
{
  if (g_IsNT)
    return (_handle = ::FindFirstChangeNotificationW(pathName, BoolToBOOL(watchSubtree), notifyFilter));
  return FindFirst(UnicodeStringToMultiByte(pathName, GetCurrentCodePage()), watchSubtree, notifyFilter);
}
#endif

#ifndef _WIN32_WCE
bool MyGetLogicalDriveStrings(CSysStringVector &driveStrings)
{
  driveStrings.Clear();
  UINT32 size = GetLogicalDriveStrings(0, NULL); 
  if(size == 0)
    return false;
  CSysString buffer;
  UINT32 newSize = GetLogicalDriveStrings(size, buffer.GetBuffer(size)); 
  if(newSize == 0)
    return false;
  if(newSize > size)
    return false;
  CSysString string;
  for(UINT32 i = 0; i < newSize; i++)
  {
    TCHAR c = buffer[i];
    if(c == TEXT('\0'))
    {
      driveStrings.Add(string);
      string.Empty();
    }
    else
      string += c;
  }
  if(!string.IsEmpty())
    return false;
  return true;
}

#ifndef _UNICODE
bool MyGetLogicalDriveStrings(UStringVector &driveStrings)
{
  driveStrings.Clear();
  if (g_IsNT)
  {
    UINT32 size = GetLogicalDriveStringsW(0, NULL); 
    if (size == 0)
      return false;
    UString buffer;
    UINT32 newSize = GetLogicalDriveStringsW(size, buffer.GetBuffer(size)); 
    if(newSize == 0)
      return false;
    if(newSize > size)
      return false;
    UString string;
    for(UINT32 i = 0; i < newSize; i++)
    {
      WCHAR c = buffer[i];
      if(c == L'\0')
      {
        driveStrings.Add(string);
        string.Empty();
      }
      else
        string += c;
    }
    return string.IsEmpty();
  }
  CSysStringVector driveStringsA;
  bool res = MyGetLogicalDriveStrings(driveStringsA);
  for (int i = 0; i < driveStringsA.Size(); i++)
    driveStrings.Add(GetUnicodeString(driveStringsA[i]));
  return res;
}
#endif

#endif

}}}
