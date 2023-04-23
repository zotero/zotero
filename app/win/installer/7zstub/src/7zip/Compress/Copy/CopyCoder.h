// Compress/CopyCoder.h

#ifndef __COMPRESS_COPYCODER_H
#define __COMPRESS_COPYCODER_H

#include "../../ICoder.h"
#include "../../../Common/MyCom.h"

namespace NCompress {

class CCopyCoder: 
  public ICompressCoder,
  public CMyUnknownImp
{
  Byte *_buffer;
public:
  UInt64 TotalSize;
  CCopyCoder(): TotalSize(0) , _buffer(0) {};
  ~CCopyCoder();

  MY_UNKNOWN_IMP

  STDMETHOD(Code)(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, 
      const UInt64 *inSize, const UInt64 *outSize,
      ICompressProgressInfo *progress);
};

}

#endif
