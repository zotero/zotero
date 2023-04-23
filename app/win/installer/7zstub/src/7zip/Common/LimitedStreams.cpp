// LimitedStreams.cpp

#include "StdAfx.h"

#include "LimitedStreams.h"
#include "../../Common/Defs.h"

void CLimitedSequentialInStream::Init(ISequentialInStream *stream, UInt64 streamSize)
{
  _stream = stream;
  _size = streamSize;
}

STDMETHODIMP CLimitedSequentialInStream::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  UInt32 processedSizeReal;
  UInt32 sizeToRead = UInt32(MyMin(_size, UInt64(size)));
  HRESULT result = _stream->Read(data, sizeToRead, &processedSizeReal);
  _size -= processedSizeReal;
  if(processedSize != NULL)
    *processedSize = processedSizeReal;
  return result;
}

