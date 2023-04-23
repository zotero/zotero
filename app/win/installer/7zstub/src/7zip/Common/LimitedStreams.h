// LimitedStreams.h

#ifndef __LIMITEDSTREAMS_H
#define __LIMITEDSTREAMS_H

#include "../../Common/MyCom.h"
#include "../IStream.h"

class CLimitedSequentialInStream: 
  public ISequentialInStream,
  public CMyUnknownImp
{
  UInt64 _size;
  CMyComPtr<ISequentialInStream> _stream;
public:
  void Init(ISequentialInStream *stream, UInt64 streamSize);
 
  MY_UNKNOWN_IMP

  STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize);
};

#endif
