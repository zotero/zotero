// FileStreams.cpp

#include "StdAfx.h"

#ifndef _WIN32
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#endif

#include "FileStreams.h"

static inline HRESULT ConvertBoolToHRESULT(bool result)
{
  // return result ? S_OK: E_FAIL;
  #ifdef _WIN32
  return result ? S_OK: (::GetLastError());
  #else
  return result ? S_OK: E_FAIL;
  #endif
}

bool CInFileStream::Open(LPCTSTR fileName)
{
  return File.Open(fileName);
}

#ifdef _WIN32
#ifndef _UNICODE
bool CInFileStream::Open(LPCWSTR fileName)
{
  return File.Open(fileName);
}
#endif
#endif

STDMETHODIMP CInFileStream::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  #ifdef _WIN32
  
  UInt32 realProcessedSize;
  bool result = File.ReadPart(data, size, realProcessedSize);
  if(processedSize != NULL)
    *processedSize = realProcessedSize;
  return ConvertBoolToHRESULT(result);
  
  #else
  
  if(processedSize != NULL)
    *processedSize = 0;
  ssize_t res = File.Read(data, (size_t)size);
  if (res == -1)
    return E_FAIL;
  if(processedSize != NULL)
    *processedSize = (UInt32)res;
  return S_OK;

  #endif
}

#ifndef _WIN32_WCE
STDMETHODIMP CStdInFileStream::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  #ifdef _WIN32
  UInt32 realProcessedSize;
  BOOL res = ::ReadFile(GetStdHandle(STD_INPUT_HANDLE), 
      data, size, (DWORD *)&realProcessedSize, NULL);
  if(processedSize != NULL)
    *processedSize = realProcessedSize;
  if (res == FALSE && GetLastError() == ERROR_BROKEN_PIPE)
    return S_OK;
  return ConvertBoolToHRESULT(res != FALSE);
  
  #else

  if(processedSize != NULL)
    *processedSize = 0;
  ssize_t res;
  do 
  {
    res = read(0, data, (size_t)size);
  } 
  while (res < 0 && (errno == EINTR));
  if (res == -1)
    return E_FAIL;
  if(processedSize != NULL)
    *processedSize = (UInt32)res;
  return S_OK;
  
  #endif
}
  
#endif

STDMETHODIMP CInFileStream::Seek(Int64 offset, UInt32 seekOrigin, 
    UInt64 *newPosition)
{
  if(seekOrigin >= 3)
    return STG_E_INVALIDFUNCTION;

  #ifdef _WIN32

  UInt64 realNewPosition;
  bool result = File.Seek(offset, seekOrigin, realNewPosition);
  if(newPosition != NULL)
    *newPosition = realNewPosition;
  return ConvertBoolToHRESULT(result);
  
  #else
  
  off_t res = File.Seek(offset, seekOrigin);
  if (res == -1)
    return E_FAIL;
  if(newPosition != NULL)
    *newPosition = (UInt64)res;
  return S_OK;
  
  #endif
}

STDMETHODIMP CInFileStream::GetSize(UInt64 *size)
{
  return ConvertBoolToHRESULT(File.GetLength(*size));
}


//////////////////////////
// COutFileStream

bool COutFileStream::Create(LPCTSTR fileName, bool createAlways)
{
  return File.Create(fileName, createAlways);
}

#ifdef _WIN32
#ifndef _UNICODE
bool COutFileStream::Create(LPCWSTR fileName, bool createAlways)
{
  return File.Create(fileName, createAlways);
}
#endif
#endif

STDMETHODIMP COutFileStream::Write(const void *data, UInt32 size, UInt32 *processedSize)
{
  #ifdef _WIN32

  UInt32 realProcessedSize;
  bool result = File.WritePart(data, size, realProcessedSize);
  if(processedSize != NULL)
    *processedSize = realProcessedSize;
  return ConvertBoolToHRESULT(result);
  
  #else
  
  if(processedSize != NULL)
    *processedSize = 0;
  ssize_t res = File.Write(data, (size_t)size);
  if (res == -1)
    return E_FAIL;
  if(processedSize != NULL)
    *processedSize = (UInt32)res;
  return S_OK;
  
  #endif
}
  
STDMETHODIMP COutFileStream::Seek(Int64 offset, UInt32 seekOrigin, 
    UInt64 *newPosition)
{
  if(seekOrigin >= 3)
    return STG_E_INVALIDFUNCTION;
  #ifdef _WIN32

  UInt64 realNewPosition;
  bool result = File.Seek(offset, seekOrigin, realNewPosition);
  if(newPosition != NULL)
    *newPosition = realNewPosition;
  return ConvertBoolToHRESULT(result);
  
  #else
  
  off_t res = File.Seek(offset, seekOrigin);
  if (res == -1)
    return E_FAIL;
  if(newPosition != NULL)
    *newPosition = (UInt64)res;
  return S_OK;
  
  #endif
}

STDMETHODIMP COutFileStream::SetSize(Int64 newSize)
{
  #ifdef _WIN32
  UInt64 currentPos;
  if(!File.Seek(0, FILE_CURRENT, currentPos))
    return E_FAIL;
  bool result = File.SetLength(newSize);
  UInt64 currentPos2;
  result = result && File.Seek(currentPos, currentPos2);
  return result ? S_OK : E_FAIL;
  #else
  return E_FAIL;
  #endif
}

#ifndef _WIN32_WCE
STDMETHODIMP CStdOutFileStream::Write(const void *data, UInt32 size, UInt32 *processedSize)
{
  if(processedSize != NULL)
    *processedSize = 0;

  #ifdef _WIN32
  UInt32 realProcessedSize;
  BOOL res = TRUE;
  if (size > 0)
  {
    // Seems that Windows doesn't like big amounts writing to stdout.
    // So we limit portions by 32KB.
    UInt32 sizeTemp = (1 << 15); 
    if (sizeTemp > size)
      sizeTemp = size;
    res = ::WriteFile(GetStdHandle(STD_OUTPUT_HANDLE), 
        data, sizeTemp, (DWORD *)&realProcessedSize, NULL);
    size -= realProcessedSize;
    data = (const void *)((const Byte *)data + realProcessedSize);
    if(processedSize != NULL)
      *processedSize += realProcessedSize;
  }
  return ConvertBoolToHRESULT(res != FALSE);

  #else
  
  ssize_t res;
  do 
  {
    res = write(1, data, (size_t)size);
  } 
  while (res < 0 && (errno == EINTR));
  if (res == -1)
    return E_FAIL;
  if(processedSize != NULL)
    *processedSize = (UInt32)res;
  return S_OK;
  
  return S_OK;
  #endif
}
  
#endif
