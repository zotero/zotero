// StreamUtils.cpp

#include "StdAfx.h"

#include "../../Common/MyCom.h"
#include "StreamUtils.h"

HRESULT ReadStream(ISequentialInStream *stream, void *data, UInt32 size, UInt32 *processedSize)
{
  if (processedSize != 0)
    *processedSize = 0;
  while(size != 0)
  {
    UInt32 processedSizeLoc; 
    HRESULT res = stream->Read(data, size, &processedSizeLoc);
    if (processedSize != 0)
      *processedSize += processedSizeLoc;
    data = (Byte *)((Byte *)data + processedSizeLoc);
    size -= processedSizeLoc;
    RINOK(res);
    if (processedSizeLoc == 0)
      return S_OK;
  }
  return S_OK;
}

HRESULT WriteStream(ISequentialOutStream *stream, const void *data, UInt32 size, UInt32 *processedSize)
{
  if (processedSize != 0)
    *processedSize = 0;
  while(size != 0)
  {
    UInt32 processedSizeLoc; 
    HRESULT res = stream->Write(data, size, &processedSizeLoc);
    if (processedSize != 0)
      *processedSize += processedSizeLoc;
    data = (const void *)((const Byte *)data + processedSizeLoc);
    size -= processedSizeLoc;
    RINOK(res);
    if (processedSizeLoc == 0)
      break;
  }
  return S_OK;
}
