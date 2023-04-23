// Compress/CopyCoder.cpp

#include "StdAfx.h"

#include "CopyCoder.h"
#include "../../../Common/Alloc.h"
#include "../../Common/StreamUtils.h"

namespace NCompress {

static const UInt32 kBufferSize = 1 << 17;

CCopyCoder::~CCopyCoder()
{
  ::MidFree(_buffer);
}

STDMETHODIMP CCopyCoder::Code(ISequentialInStream *inStream,
    ISequentialOutStream *outStream, 
    const UInt64 *inSize, const UInt64 *outSize,
    ICompressProgressInfo *progress)
{
  if (_buffer == 0)
  {
    _buffer = (Byte *)::MidAlloc(kBufferSize);
    if (_buffer == 0)
      return E_OUTOFMEMORY;
  }

  TotalSize = 0;
  while(true)
  {
    UInt32 realProcessedSize;
    UInt32 size = kBufferSize;
    if (outSize != 0)
      if (size > *outSize - TotalSize)
        size = (UInt32)(*outSize - TotalSize);
    RINOK(inStream->Read(_buffer, size, &realProcessedSize));
    if(realProcessedSize == 0)
      break;
    RINOK(WriteStream(outStream, _buffer, realProcessedSize, NULL));
    TotalSize += realProcessedSize;
    if (progress != NULL)
    {
      RINOK(progress->SetRatioInfo(&TotalSize, &TotalSize));
    }
  }
  return S_OK;
}

}

