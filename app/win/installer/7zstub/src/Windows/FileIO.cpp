// Windows/FileIO.cpp

#include "StdAfx.h"

#include "FileIO.h"
#include "Defs.h"
#ifndef _UNICODE
#include "../Common/StringConvert.h"
#endif

#ifndef _UNICODE
extern bool g_IsNT;
#endif

namespace NWindows {
namespace NFile {
namespace NIO {

CFileBase::~CFileBase() { Close(); }

bool CFileBase::Create(LPCTSTR fileName, DWORD desiredAccess,
    DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
{
  Close();
  _handle = ::CreateFile(fileName, desiredAccess, shareMode, 
      (LPSECURITY_ATTRIBUTES)NULL, creationDisposition, 
      flagsAndAttributes, (HANDLE) NULL);
  return (_fileIsOpen = (_handle != INVALID_HANDLE_VALUE));
}

#ifndef _UNICODE
bool CFileBase::Create(LPCWSTR fileName, DWORD desiredAccess,
    DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
{
  if (g_IsNT)
  {
    Close();
    _handle = ::CreateFileW(fileName, desiredAccess, shareMode, 
      (LPSECURITY_ATTRIBUTES)NULL, creationDisposition, 
      flagsAndAttributes, (HANDLE) NULL);
    return (_fileIsOpen = (_handle != INVALID_HANDLE_VALUE));
  }
  return Create(UnicodeStringToMultiByte(fileName, ::AreFileApisANSI() ? CP_ACP : CP_OEMCP), 
    desiredAccess, shareMode, creationDisposition, flagsAndAttributes);
}
#endif

bool CFileBase::Close()
{
  if(!_fileIsOpen)
    return true;
  bool result = BOOLToBool(::CloseHandle(_handle));
  _fileIsOpen = !result;
  return result;
}

bool CFileBase::GetPosition(UInt64 &position) const
{
  return Seek(0, FILE_CURRENT, position);
}

bool CFileBase::GetLength(UInt64 &length) const
{
  DWORD sizeHigh;
  DWORD sizeLow = ::GetFileSize(_handle, &sizeHigh);
  if(sizeLow == 0xFFFFFFFF)
    if(::GetLastError() != NO_ERROR)
      return false;
  length = (((UInt64)sizeHigh) << 32) + sizeLow;
  return true;
}

bool CFileBase::Seek(Int64 distanceToMove, DWORD moveMethod, UInt64 &newPosition) const
{
  LARGE_INTEGER value;
  value.QuadPart = distanceToMove;
  value.LowPart = ::SetFilePointer(_handle, value.LowPart, &value.HighPart, moveMethod);
  if (value.LowPart == 0xFFFFFFFF)
    if(::GetLastError() != NO_ERROR) 
      return false;
  newPosition = value.QuadPart;
  return true;
}

bool CFileBase::Seek(UInt64 position, UInt64 &newPosition)
{
  return Seek(position, FILE_BEGIN, newPosition);
}

bool CFileBase::SeekToBegin()
{
  UInt64 newPosition;
  return Seek(0, newPosition);
}

bool CFileBase::SeekToEnd(UInt64 &newPosition)
{
  return Seek(0, FILE_END, newPosition);
}

bool CFileBase::GetFileInformation(CByHandleFileInfo &fileInfo) const
{
  BY_HANDLE_FILE_INFORMATION winFileInfo;
  if(!::GetFileInformationByHandle(_handle, &winFileInfo))
    return false;
  fileInfo.Attributes = winFileInfo.dwFileAttributes;
  fileInfo.CreationTime = winFileInfo.ftCreationTime;
  fileInfo.LastAccessTime = winFileInfo.ftLastAccessTime;
  fileInfo.LastWriteTime = winFileInfo.ftLastWriteTime;
  fileInfo.VolumeSerialNumber = winFileInfo.dwFileAttributes; 
  fileInfo.Size = (((UInt64)winFileInfo.nFileSizeHigh) << 32) +  winFileInfo.nFileSizeLow;
  fileInfo.NumberOfLinks = winFileInfo.nNumberOfLinks;
  fileInfo.FileIndex = (((UInt64)winFileInfo.nFileIndexHigh) << 32) + winFileInfo.nFileIndexLow;
  return true;
}

/////////////////////////
// CInFile

bool CInFile::Open(LPCTSTR fileName, DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
  { return Create(fileName, GENERIC_READ, shareMode, creationDisposition, flagsAndAttributes); }

bool CInFile::Open(LPCTSTR fileName)
  { return Open(fileName, FILE_SHARE_READ, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL); }

#ifndef _UNICODE
bool CInFile::Open(LPCWSTR fileName, DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
  { return Create(fileName, GENERIC_READ, shareMode, creationDisposition, flagsAndAttributes); }

bool CInFile::Open(LPCWSTR fileName)
  { return Open(fileName, FILE_SHARE_READ, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL); }
#endif

// ReadFile and WriteFile functions in Windows have BUG:
// If you Read or Write 64MB or more (probably min_failure_size = 64MB - 32KB + 1) 
// from/to Network file, it returns ERROR_NO_SYSTEM_RESOURCES 
// (Insufficient system resources exist to complete the requested service).

static UInt32 kChunkSizeMax = (1 << 24);

bool CInFile::ReadPart(void *data, UInt32 size, UInt32 &processedSize)
{
  if (size > kChunkSizeMax)
    size = kChunkSizeMax;
  DWORD processedLoc = 0;
  bool res = BOOLToBool(::ReadFile(_handle, data, size, &processedLoc, NULL));
  processedSize = (UInt32)processedLoc;
  return res;
}

bool CInFile::Read(void *data, UInt32 size, UInt32 &processedSize)
{
  processedSize = 0;
  do
  {
    UInt32 processedLoc = 0;
    bool res = ReadPart(data, size, processedLoc);
    processedSize += processedLoc;
    if (!res)
      return false;
    if (processedLoc == 0)
      return true;
    data = (void *)((unsigned char *)data + processedLoc);
    size -= processedLoc;
  }
  while (size > 0);
  return true;
}

/////////////////////////
// COutFile

bool COutFile::Open(LPCTSTR fileName, DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
  { return CFileBase::Create(fileName, GENERIC_WRITE, shareMode, creationDisposition, flagsAndAttributes); }

static inline DWORD GetCreationDisposition(bool createAlways)
  { return createAlways? CREATE_ALWAYS: CREATE_NEW; }

bool COutFile::Open(LPCTSTR fileName, DWORD creationDisposition)
  { return Open(fileName, FILE_SHARE_READ, creationDisposition, FILE_ATTRIBUTE_NORMAL); }

bool COutFile::Create(LPCTSTR fileName, bool createAlways)
  { return Open(fileName, GetCreationDisposition(createAlways)); }

#ifndef _UNICODE

bool COutFile::Open(LPCWSTR fileName, DWORD shareMode, DWORD creationDisposition, DWORD flagsAndAttributes)
  { return CFileBase::Create(fileName, GENERIC_WRITE, shareMode,      creationDisposition, flagsAndAttributes); }

bool COutFile::Open(LPCWSTR fileName, DWORD creationDisposition)
  { return Open(fileName, FILE_SHARE_READ,  creationDisposition, FILE_ATTRIBUTE_NORMAL); }

bool COutFile::Create(LPCWSTR fileName, bool createAlways)
  { return Open(fileName, GetCreationDisposition(createAlways)); }

#endif

bool COutFile::SetTime(const FILETIME *creationTime, const FILETIME *lastAccessTime, const FILETIME *lastWriteTime)
  { return BOOLToBool(::SetFileTime(_handle, creationTime, lastAccessTime, lastWriteTime)); }

bool COutFile::SetLastWriteTime(const FILETIME *lastWriteTime)
  {  return SetTime(NULL, NULL, lastWriteTime); }

bool COutFile::WritePart(const void *data, UInt32 size, UInt32 &processedSize)
{
  if (size > kChunkSizeMax)
    size = kChunkSizeMax;
  DWORD processedLoc = 0;
  bool res = BOOLToBool(::WriteFile(_handle, data, size, &processedLoc, NULL));
  processedSize = (UInt32)processedLoc;
  return res;
}

bool COutFile::Write(const void *data, UInt32 size, UInt32 &processedSize)
{
  processedSize = 0;
  do
  {
    UInt32 processedLoc = 0;
    bool res = WritePart(data, size, processedLoc);
    processedSize += processedLoc;
    if (!res)
      return false;
    if (processedLoc == 0)
      return true;
    data = (const void *)((const unsigned char *)data + processedLoc);
    size -= processedLoc;
  }
  while (size > 0);
  return true;
}

bool COutFile::SetEndOfFile() { return BOOLToBool(::SetEndOfFile(_handle)); }

bool COutFile::SetLength(UInt64 length)
{
  UInt64 newPosition;
  if(!Seek(length, newPosition))
    return false;
  if(newPosition != length)
    return false;
  return SetEndOfFile();
}

}}}
