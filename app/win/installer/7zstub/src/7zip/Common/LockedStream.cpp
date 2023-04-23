// LockedStream.cpp

#include "StdAfx.h"

#include "LockedStream.h"

HRESULT CLockedInStream::Read(UInt64 startPos, void *data, UInt32 size, 
  UInt32 *processedSize)
{
  NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
  RINOK(_stream->Seek(startPos, STREAM_SEEK_SET, NULL));
  return _stream->Read(data, size, processedSize);
}

STDMETHODIMP CLockedSequentialInStreamImp::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  UInt32 realProcessedSize = 0;
  HRESULT result = _lockedInStream->Read(_pos, data, size, &realProcessedSize);
  _pos += realProcessedSize;
  if (processedSize != NULL)
    *processedSize = realProcessedSize;
  return result;
}
