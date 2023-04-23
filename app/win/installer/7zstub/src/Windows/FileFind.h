// Windows/FileFind.h

#ifndef __WINDOWS_FILEFIND_H
#define __WINDOWS_FILEFIND_H

#include "../Common/String.h"
#include "../Common/Types.h"
#include "FileName.h"
#include "Defs.h"

namespace NWindows {
namespace NFile {
namespace NFind {

namespace NAttributes
{
  inline bool IsReadOnly(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_READONLY) != 0; }
  inline bool IsHidden(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_HIDDEN) != 0; }
  inline bool IsSystem(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_SYSTEM) != 0; }
  inline bool IsDirectory(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0; }
  inline bool IsArchived(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_ARCHIVE) != 0; }
  inline bool IsCompressed(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_COMPRESSED) != 0; }
  inline bool IsEncrypted(DWORD attributes) { return (attributes & FILE_ATTRIBUTE_ENCRYPTED) != 0; }
}

class CFileInfoBase
{ 
  bool MatchesMask(UINT32 mask) const  { return ((Attributes & mask) != 0); }
public:
  DWORD Attributes;
  FILETIME CreationTime;  
  FILETIME LastAccessTime; 
  FILETIME LastWriteTime;
  UInt64 Size;
  
  #ifndef _WIN32_WCE
  UINT32 ReparseTag;
  #else
  DWORD ObjectID; 
  #endif

  bool IsArchived() const { return MatchesMask(FILE_ATTRIBUTE_ARCHIVE); }
  bool IsCompressed() const { return MatchesMask(FILE_ATTRIBUTE_COMPRESSED); }
  bool IsDirectory() const { return MatchesMask(FILE_ATTRIBUTE_DIRECTORY); }
  bool IsEncrypted() const { return MatchesMask(FILE_ATTRIBUTE_ENCRYPTED); }
  bool IsHidden() const { return MatchesMask(FILE_ATTRIBUTE_HIDDEN); }
  bool IsNormal() const { return MatchesMask(FILE_ATTRIBUTE_NORMAL); }
  bool IsOffline() const { return MatchesMask(FILE_ATTRIBUTE_OFFLINE); }
  bool IsReadOnly() const { return MatchesMask(FILE_ATTRIBUTE_READONLY); }
  bool HasReparsePoint() const { return MatchesMask(FILE_ATTRIBUTE_REPARSE_POINT); }
  bool IsSparse() const { return MatchesMask(FILE_ATTRIBUTE_SPARSE_FILE); }
  bool IsSystem() const { return MatchesMask(FILE_ATTRIBUTE_SYSTEM); }
  bool IsTemporary() const { return MatchesMask(FILE_ATTRIBUTE_TEMPORARY); }
};

class CFileInfo: public CFileInfoBase
{ 
public:
  CSysString Name;
  bool IsDots() const;
};

#ifdef _UNICODE
typedef CFileInfo CFileInfoW;
#else
class CFileInfoW: public CFileInfoBase
{ 
public:
  UString Name;
  bool IsDots() const;
};
#endif

class CFindFile
{
  friend class CEnumerator;
  HANDLE _handle;
  bool _handleAllocated;
public:
  bool IsHandleAllocated() const { return _handleAllocated; }
  CFindFile(): _handleAllocated(false) {}
  ~CFindFile() {  Close(); }
  bool FindFirst(LPCTSTR wildcard, CFileInfo &fileInfo);
  bool FindNext(CFileInfo &fileInfo);
  #ifndef _UNICODE
  bool FindFirst(LPCWSTR wildcard, CFileInfoW &fileInfo);
  bool FindNext(CFileInfoW &fileInfo);
  #endif
  bool Close();
};

bool FindFile(LPCTSTR wildcard, CFileInfo &fileInfo);

bool DoesFileExist(LPCTSTR name);
#ifndef _UNICODE
bool FindFile(LPCWSTR wildcard, CFileInfoW &fileInfo);
bool DoesFileExist(LPCWSTR name);
#endif

class CEnumerator
{
  CFindFile _findFile;
  CSysString _wildcard;
  bool NextAny(CFileInfo &fileInfo);
public:
  CEnumerator(): _wildcard(NName::kAnyStringWildcard) {}
  CEnumerator(const CSysString &wildcard): _wildcard(wildcard) {}
  bool Next(CFileInfo &fileInfo);
  bool Next(CFileInfo &fileInfo, bool &found);
};

#ifdef _UNICODE
typedef CEnumerator CEnumeratorW;
#else
class CEnumeratorW
{
  CFindFile _findFile;
  UString _wildcard;
  bool NextAny(CFileInfoW &fileInfo);
public:
  CEnumeratorW(): _wildcard(NName::kAnyStringWildcard) {}
  CEnumeratorW(const UString &wildcard): _wildcard(wildcard) {}
  bool Next(CFileInfoW &fileInfo);
  bool Next(CFileInfoW &fileInfo, bool &found);
};
#endif

class CFindChangeNotification
{
  HANDLE _handle;
public:
  operator HANDLE () { return _handle; }
  CFindChangeNotification(): _handle(INVALID_HANDLE_VALUE) {}
  ~CFindChangeNotification() {  Close(); }
  bool Close();
  HANDLE FindFirst(LPCTSTR pathName, bool watchSubtree, DWORD notifyFilter);
  #ifndef _UNICODE
  HANDLE FindFirst(LPCWSTR pathName, bool watchSubtree, DWORD notifyFilter);
  #endif
  bool FindNext()
    { return BOOLToBool(::FindNextChangeNotification(_handle)); }
};

#ifndef _WIN32_WCE
bool MyGetLogicalDriveStrings(CSysStringVector &driveStrings);
#ifndef _UNICODE
bool MyGetLogicalDriveStrings(UStringVector &driveStrings);
#endif
#endif

inline bool MyGetCompressedFileSize(LPCTSTR fileName, UInt64 &size)
{
  DWORD highPart;
  DWORD lowPart = ::GetCompressedFileSize(fileName, &highPart);
  if (lowPart == INVALID_FILE_SIZE)
    if (::GetLastError() != NO_ERROR)
      return false;
  size = (UInt64(highPart) << 32) | lowPart;
  return true;
}

inline bool MyGetCompressedFileSizeW(LPCWSTR fileName, UInt64 &size)
{
  DWORD highPart;
  DWORD lowPart = ::GetCompressedFileSizeW(fileName, &highPart);
  if (lowPart == INVALID_FILE_SIZE)
    if (::GetLastError() != NO_ERROR)
      return false;
  size = (UInt64(highPart) << 32) | lowPart;
  return true;
}

}}}

#endif

